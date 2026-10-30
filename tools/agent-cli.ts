import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {applicationBuildId} from '../apps/server/src/build-id.ts';
import {hash} from '../apps/server/src/core.ts';
import {validateDraft} from '../apps/server/src/modules/scenario-drafts.ts';
const root=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const dataRoot=path.resolve(process.env.WPL_DATA_DIR||path.join(root,'.wpl-data'));
fs.mkdirSync(dataRoot,{recursive:true,mode:0o700});
const stateFile=path.join(dataRoot,'agent-server.json'),instanceId=hash(root+'\0'+fs.realpathSync(dataRoot));
const {values,positionals}=(()=>{try{return parseArgs({allowPositionals:true,options:{brief:{type:'string'},'brief-file':{type:'string'},duration:{type:'string',default:'90'},model:{type:'string'},binary:{type:'string'},'allowed-models':{type:'string'},file:{type:'string'},url:{type:'string'},port:{type:'string'},id:{type:'string'},json:{type:'boolean'},'no-wait':{type:'boolean'},timeout:{type:'string',default:'600'},help:{type:'boolean'}}});}catch(e:any){console.log(JSON.stringify({status:'error',code:'INVALID_ARGUMENT',message:e.message}));process.exit(1);}})();
const command=positionals[0]||'help';
function failure(message:string,code='AGENT_COMMAND_FAILED'){return Object.assign(new Error(message),{code});}
const deadlineMs=Number(values.timeout)*1000;if(!Number.isFinite(deadlineMs)||deadlineMs<1000||deadlineMs>1800000){console.log(JSON.stringify({status:'error',code:'INVALID_ARGUMENT',message:'--timeout must be 1..1800 seconds'}));process.exit(1);}
async function connect(url:string,allowOutdated=false){
 const target=new URL(url);if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw failure('Only an http://127.0.0.1:<port> app URL is allowed.','INVALID_URL');
 const base=target.origin,response=await fetch(base,{signal:AbortSignal.timeout(3000)}),html=await response.text();
 if(!html.includes('Work Practice Lab'))throw failure('This port belongs to another application.','OTHER_APPLICATION');
 const token=html.match(/name="wpl-launch" content="([^"]+)"/)?.[1];if(!token)throw failure('No app bootstrap token.','OTHER_APPLICATION');
 const boot=await fetch(base+'/api/v1/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchToken:token}),signal:AbortSignal.timeout(5000)}),body=await boot.json(),cookie=boot.headers.get('set-cookie')?.split(';')[0];
 if(!boot.ok||!cookie||!body.csrfToken)throw failure('Could not authenticate with the local app.','AUTH_REQUIRED');
 const request=async(route:string,payload?:any,method=payload===undefined?'GET':'POST')=>{const r=await fetch(base+'/api/v1'+route,{method,headers:{Cookie:cookie,'Content-Type':'application/json','X-WPL-CSRF':body.csrfToken,'Idempotency-Key':crypto.randomUUID()},body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});const result=await r.json();if(!r.ok)throw Object.assign(failure(result.error?.message||'Local request failed',result.error?.code),{details:result.error?.details,status:r.status});return result;};
 const info=await request('/agent');if(info.instanceId!==instanceId)throw failure('This app uses a different checkout or data directory. Start this checkout on another port.','OTHER_INSTANCE');if(!allowOutdated&&info.buildId!==applicationBuildId(root))throw failure('The server is running older code. Check active work, then use pnpm lab stop and pnpm lab start to apply the installed update.','APP_UPDATE_REQUIRED');return {base,info,request};
}
async function portFree(port:number){return new Promise<boolean>(resolve=>{const server=net.createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});}
async function start(){
 if(values.url)return connect(values.url);
 try{const saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(!values.port||Number(values.port)===saved.port)return await connect(saved.url);}catch(e:any){if(e.code==='APP_UPDATE_REQUIRED')throw e;}
 if(!fs.existsSync(path.join(root,'dist/index.html')))throw failure('Build the app first: run node tools/setup.mjs.','BUILD_REQUIRED');
 const lock=path.join(dataRoot,'agent-start.lock');let acquired=false;
 for(let i=0;i<120;i++){try{fs.writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600});acquired=true;break;}catch(e:any){if(e.code!=='EEXIST')throw e;try{const pid=Number(fs.readFileSync(lock,'utf8'));if(Number.isInteger(pid)&&pid>0)process.kill(pid,0);}catch(e:any){if(e.code==='ESRCH'||e.code==='ENOENT'){fs.rmSync(lock,{force:true});continue;}}await new Promise(r=>setTimeout(r,250));}}
 if(!acquired)throw failure('Another agent is starting this app. Retry shortly.','START_BUSY');
 try{
  try{const saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(!values.port||Number(values.port)===saved.port)return await connect(saved.url);}catch(e:any){if(e.code==='APP_UPDATE_REQUIRED')throw e;}
  const preferred=Number(values.port||4310);if(!Number.isInteger(preferred)||preferred<1024||preferred>65500)throw failure('--port must be 1024..65500','INVALID_PORT');
  let port=preferred,found=false;
  for(;port<=Math.min(65500,preferred+(values.port?0:20));port++){if(await portFree(port)){found=true;break;}try{const client=await connect('http://127.0.0.1:'+port);fs.writeFileSync(stateFile,JSON.stringify({url:client.base,port,instanceId}),{mode:0o600});return client;}catch(e:any){if(e.code==='APP_UPDATE_REQUIRED')throw e;}}
  if(!found)throw failure('No unused local port. Specify --port.','PORT_BUSY');
  const logfile=path.join(dataRoot,'server.log'),fd=fs.openSync(logfile,'a',0o600),child=spawn(process.execPath,['--import','tsx',path.join(root,'apps/server/src/index.ts')],{cwd:root,env:{...process.env,NODE_ENV:'production',PORT:String(port),WPL_DATA_DIR:dataRoot},detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);child.unref();let spawnError:any;child.once('error',e=>spawnError=e);
  const url='http://127.0.0.1:'+port;for(let i=0;i<120;i++){if(spawnError)throw spawnError;try{const client=await connect(url);fs.writeFileSync(stateFile,JSON.stringify({url,port,pid:child.pid,instanceId}),{mode:0o600});return client;}catch(e:any){if(['OTHER_INSTANCE','OTHER_APPLICATION'].includes(e.code))throw e;}await new Promise(r=>setTimeout(r,250));}
  if(child.pid){try{process.kill(-child.pid,'SIGTERM');}catch{}}throw failure('Startup timed out. Inspect '+logfile,'START_FAILED');
 }finally{fs.rmSync(lock,{force:true});}
}
async function wait(client:Awaited<ReturnType<typeof connect>>,id:string){
 const until=Date.now()+deadlineMs;for(;;){const op=await client.request('/operations/'+id);if(op.status==='succeeded')return {operationId:id,...op.result};if(['failed','interrupted','uncertain'].includes(op.status))throw Object.assign(failure(op.error?.message||op.status,op.error?.code||'OPERATION_FAILED'),{operationId:id});if(Date.now()>until)return {status:'pending',operationId:id,nextCommand:['pnpm','lab','operation','--id',id]};await new Promise(r=>setTimeout(r,700));}
}
async function main(){
 if(command==='help'||values.help)return {commands:{start:'Start or reuse this checkout; never stop another app.',stop:'Gracefully stop only the verified server started by this CLI.',doctor:'Check runtime installation/authentication and connection gate.',models:'List actual Codex models.',configure:'[--model id] [--binary path]; preserve unspecified settings.',list:'List registered problems.',generate:'--brief <request> [--duration 90] [--model id] [--allowed-models id,id]',validate:'--file <scenario-draft.json>; schema and references, no inference.',import:'--file <scenario-draft.json>; register into the local app.',operation:'--id <operationId>; wait for an existing operation.',interrupt:'--id <operationId>; cancel pending generation.', 'check-runtime':'Run actual connection/permissions check when not already verified.'},schema:'packages/contracts/scenario-draft.schema.json',setup:'node tools/setup.mjs',output:'JSON. Exit 2 means user action is required; exit 1 means failure.'};
 if(command==='validate'){if(!values.file)throw failure('--file is required');const d=validateDraft(JSON.parse(fs.readFileSync(path.resolve(values.file),'utf8')));return {valid:true,title:d.title,scenarioId:d.scenarioId,workflows:d.workflows.length};}
 if(command==='stop'){
  let saved:any;try{saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{return {status:'stopped',message:'No managed server record.'};}
  let client;try{client=await connect(saved.url,true);}catch(e:any){if(e.code==='OTHER_INSTANCE'||e.code==='OTHER_APPLICATION')throw e;throw failure('Could not verify the recorded server; no process was stopped.','SERVER_UNVERIFIED');}
  if(client.info.activeWork)throw failure('This app has active work. Complete or abandon it before stopping the server.','ACTIVE_WORK');
  if(!Number.isInteger(saved.pid)||saved.pid!==client.info.processId)throw failure('This server was not started by this CLI; no process was stopped.','SERVER_NOT_OWNED');
  process.kill(saved.pid,'SIGTERM');for(let n=0;n<80;n++){try{process.kill(saved.pid,0);}catch(e:any){if(e.code==='ESRCH'){fs.rmSync(stateFile,{force:true});return {status:'stopped',url:client.base};}throw e;}await new Promise(r=>setTimeout(r,100));}
  return {status:'pending',message:'Graceful shutdown requested; process has not exited yet.',url:client.base};
 }
 if(!['start','status','doctor','models','configure','list','generate','import','operation','interrupt','check-runtime'].includes(command))throw failure('Unknown command: '+command,'UNKNOWN_COMMAND');
 const client=await start();
 if(command==='start'||command==='status')return {status:'ready',url:client.base,...client.info};
 if(command==='doctor'){const runtime=await client.request('/runtime/probe'),config=await client.request('/runtime/config');return {status:runtime.authState==='signed_in'?'ready':'needs_user_action',url:client.base,runtime,loginCommand:[config.binaryPath,'login']};}
 if(command==='configure'){if(!values.model&&!values.binary)throw failure('--model or --binary is required');const old=await client.request('/runtime/config');return client.request('/runtime/config',{...old,...(values.model?{model:values.model}:{}),...(values.binary?{binaryPath:values.binary}:{})},'PUT');}
 if(command==='models')return client.request('/runtime/models');
 if(command==='list')return client.request('/scenarios');
 if(command==='import'){if(!values.file)throw failure('--file is required');const draft=JSON.parse(fs.readFileSync(path.resolve(values.file),'utf8'));validateDraft(draft);const scenario=await client.request('/scenario-drafts/import',draft);return {scenario,url:client.base+'/setup/'+scenario.versionId};}
 if(command==='interrupt'){if(!values.id)throw failure('--id is required');return client.request('/operations/'+encodeURIComponent(values.id)+'/interrupt',{});}
 if(command==='operation'){if(!values.id)throw failure('--id is required');return wait(client,values.id);}
 let job:any;
 if(command==='check-runtime'){const probe=await client.request('/runtime/probe');if(probe.inferenceState==='passed')return {status:'ready',runtime:probe};if(probe.authState!=='signed_in')return {status:'needs_user_action',reason:'Codex login is required before the connection check.'};job=await client.request('/runtime/inference-check',{});}
 else{const brief=values['brief-file']?fs.readFileSync(path.resolve(values['brief-file']),'utf8'):values.brief;if(!brief)throw failure('--brief or --brief-file is required');job=await client.request('/scenario-drafts/generate',{brief,durationMinutes:Number(values.duration),...(values.model?{model:values.model}:{}),allowedModels:values['allowed-models']?values['allowed-models'].split(',').map(x=>x.trim()):null});}
 if(values['no-wait'])return {status:'pending',operationId:job.operationId,url:client.base};const result=await wait(client,job.operationId);if(command==='check-runtime'&&result.status!=='pending'&&result.inferenceState!=='passed')throw failure('The actual connection/capability check did not pass. Inspect pnpm lab doctor before proceeding.','RUNTIME_CAPABILITY_MISSING');return {...result,...(result.scenario?{url:client.base+'/setup/'+result.scenario.versionId}:{url:client.base})};
}
try{const result=await main();console.log(JSON.stringify(result,null,2));if(result.status==='needs_user_action')process.exitCode=2;}catch(e:any){console.log(JSON.stringify({status:'error',code:e.code||'AGENT_COMMAND_FAILED',message:e.message,...(e.details?{details:e.details}:{}),...(e.operationId?{operationId:e.operationId}:{})},null,2));process.exitCode=1;}
