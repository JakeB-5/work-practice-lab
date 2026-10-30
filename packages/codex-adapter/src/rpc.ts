import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parse } from 'smol-toml';

const tomlValue=(value:any):string=>value&&typeof value==='object'&&!Array.isArray(value)?'{'+Object.entries(value).map(([k,v])=>JSON.stringify(k)+' = '+tomlValue(v)).join(', ')+'}':JSON.stringify(value);
export type Wire = {id?: number|string; method?:string; params?:any; result?:any; error?:any};
export function localSettings() {
  try {
    const c:any=parse(readFileSync(path.join(homedir(),'.codex','config.toml'),'utf8'));
    return {model:typeof c.model==='string'?c.model:undefined,
      mcpNames:Object.keys(c.mcp_servers||{}), pluginNames:Object.keys(c.plugins||{})};
  } catch { return {model:undefined,mcpNames:[],pluginNames:[]}; }
}
export class CodexRpc extends EventEmitter {
  proc: ChildProcessWithoutNullStreams|null=null;
  pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  serial=0; buffer=''; stderr=''; exited=false;
  constructor(public binary='codex',public cwd=process.cwd(),public restricted=false,public overrides:Record<string,unknown>={}) {super();}
  async start() {
    const settings=localSettings();
    const cfg:Record<string,unknown>={
      'project_doc_max_bytes':0,'features.daemon_auto_start':false,'features.apps':false,'features.plugins':false,
      'features.remote_plugin':false,'features.browser_use':false,'features.browser_use_external':false,
      'features.computer_use':false,'features.in_app_browser':false,'features.hooks':false,
      'features.multi_agent':false,'features.goals':false,'features.skill_search':false,
      'features.skip_host_skill_discovery':true,'features.workspace_dependencies':false,
      'features.sleep_tool':false,'features.image_generation':false,'web_search':'disabled',
      'features.shell_tool':!this.restricted,'features.view_image':!this.restricted,
      'apps._default.enabled':false,
      ...this.overrides,
    };
    for(const key of settings.mcpNames) cfg['mcp_servers.'+key+'.enabled']=false;
    const args=['app-server','--listen','stdio://'];
    for(const [key,value] of Object.entries(cfg)) args.push('-c',key+'='+tomlValue(value));
    const inheritedNames=new Set(['PATH','HOME','USER','LOGNAME','LANG','LC_ALL','TERM','SHELL','TMPDIR','CODEX_HOME','CODEX_CA_CERTIFICATE','SSL_CERT_FILE','SSL_CERT_DIR']);
    const childEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>inheritedNames.has(key)));
    childEnv.OPENSSL_CONF='/dev/null';
    this.proc=spawn(this.binary,args,{cwd:this.cwd,stdio:['pipe','pipe','pipe'],env:childEnv,shell:false});
    this.proc.stdout.setEncoding('utf8');this.proc.stderr.setEncoding('utf8');
    this.proc.stdout.on('data',(chunk:string)=>{
      this.buffer+=chunk;
      if(this.buffer.length>8*1024*1024){this.emit('protocolError',new Error('Wire line exceeded limit'));this.close();return;}
      let n:number;
      while((n=this.buffer.indexOf('\n'))>=0) {
        const line=this.buffer.slice(0,n);this.buffer=this.buffer.slice(n+1);
        if(!line.trim())continue;
        try {
          const msg:Wire=JSON.parse(line);
          if(msg.id!==undefined&&typeof msg.id==='number'&&this.pending.has(msg.id)&&!msg.method){
            const p=this.pending.get(msg.id)!;clearTimeout(p.timer);this.pending.delete(msg.id);
            if(msg.error)p.reject(Object.assign(new Error(msg.error.message||'Codex error'),{details:msg.error}));else p.resolve(msg.result);
          } else this.emit('message',msg);
        } catch(error){this.emit('protocolError',error);}
      }
    });
    this.proc.stderr.on('data',(s:string)=>{this.stderr=(this.stderr+s).slice(-24000);this.emit('diagnostic',s);});
    this.proc.on('error',(error)=>this.fail(error));
    this.proc.on('exit',(code,signal)=>{this.exited=true;this.fail(new Error('Codex exited '+String(code)+' '+String(signal)));this.emit('exit',{code,signal});});
    const result=await this.call('initialize',{clientInfo:{name:'work_practice_lab',title:'Work Practice Lab',version:'0.1.1'},capabilities:{experimentalApi:true,requestAttestation:false}},20000);
    this.notify('initialized',{});
    return result;
  }
  call(method:string,params:unknown={},timeoutMs=30000):Promise<any>{
    if(!this.proc||this.exited)return Promise.reject(new Error('Codex is not connected'));
    const id=++this.serial;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('RPC timeout: '+method));},timeoutMs);
      this.pending.set(id,{resolve,reject,timer});this.send({id,method,params});
    });
  }
  notify(method:string,params:unknown={}){this.send({method,params});}
  respond(id:number|string,result:unknown){this.send({id,result});}
  send(message:unknown){this.proc?.stdin.write(JSON.stringify(message)+'\n');}
  fail(error:Error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
  close(){this.proc?.stdin.end();const p=this.proc;if(p&&!p.killed){p.kill('SIGTERM');setTimeout(()=>{if(!this.exited)p.kill('SIGKILL');},3000).unref();}}
}
export function turnResult(rpc:CodexRpc,threadId:string,params:any,timeoutMs=180000) {
  return new Promise<{text:string;finalText:string;turn:any;messages:Wire[]}>((resolve,reject)=>{
    let text='';const messages:Wire[]=[];
    const timer=setTimeout(()=>{cleanup();reject(new Error('Turn timeout'));},timeoutMs);
    const handler=(m:Wire)=>{
      if(m.params?.threadId!==threadId)return;
      messages.push(m);
      if(m.method==='item/agentMessage/delta')text+=m.params.delta||'';
      if(m.method==='turn/completed'){cleanup();resolve({text,finalText:messages.filter(x=>x.method==='item/completed'&&x.params?.item?.type==='agentMessage').at(-1)?.params.item.text||text,turn:m.params.turn,messages});}
    };
    const cleanup=()=>{clearTimeout(timer);rpc.off('message',handler);};
    rpc.on('message',handler);
    rpc.call('turn/start',{threadId,...params}).catch(e=>{cleanup();reject(e);});
  });
}
