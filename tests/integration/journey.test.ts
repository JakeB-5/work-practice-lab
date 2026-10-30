import {describe,it,expect,afterAll,beforeAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../../apps/server/src/app.ts';
import {WebSocket} from 'ws';
import Ajv2020 from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
const spec=JSON.parse(fs.readFileSync('packages/contracts/openapi.json','utf8')),ajv=new Ajv2020({strict:false,allErrors:true});addFormats(ajv);const validators=new Map<string,any>();
function checkResponse(url:string,method:string,status:number,value:any){const pathname=url.split('?')[0];const entry=Object.entries<any>(spec.paths).find(([p])=>new RegExp('^'+p.replace(/\{[^}]+\}/g,'[^/]+')+'$').test(pathname));const schema=entry?.[1][method.toLowerCase()]?.responses?.[String(status)]?.content?.['application/json']?.schema;if(!schema)return;const key=entry![0]+method+status;let v=validators.get(key);if(!v){v=ajv.compile({components:spec.components,...schema});validators.set(key,v);}expect(v(value),key+' '+JSON.stringify(v.errors)).toBe(true);}
let instance:Awaited<ReturnType<typeof createApp>>,base:string,cookie:string,csrf:string,root:string;
async function request(url:string,body?:any,method=body===undefined?'GET':'POST',extra:Record<string,string>={}){const response=await fetch(base+'/api/v1'+url,{method,headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':crypto.randomUUID(),...extra},body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text();let value:any;try{value=JSON.parse(text);}catch{value=text;}checkResponse(url,method,response.status,value);return {status:response.status,value,headers:response.headers};}
async function ok(url:string,body?:any,method?:string,extra?:Record<string,string>){const r=await request(url,body,method,extra);expect(r.status,JSON.stringify(r.value)).toBeLessThan(300);return r.value;}
async function operation(url:string,body:any){const r=await ok(url,body);await instance.runtime.promises.get(r.operationId);const op=instance.store.get('operations',r.operationId);expect(op.status,JSON.stringify(op.error)).toBe('succeeded');return op.result;}
beforeAll(async()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'wpl-integration-'));instance=await createApp({repoRoot:process.cwd(),dataRoot:root});base=await instance.listen(0);const r=await request('/bootstrap',{launchToken:instance.issueLaunch()});csrf=r.value.csrfToken;cookie=r.headers.get('set-cookie')!.split(';')[0];},30000);
afterAll(async()=>{await instance.close();fs.rmSync(root,{recursive:true,force:true});});
describe('authenticated local control and complete journey',()=>{
 it('rejects missing session, cross origin and missing CSRF; validates schemas',async()=>{expect((await fetch(base+'/api/v1/scenarios')).status).toBe(401);expect((await fetch(base+'/api/v1/scenarios',{headers:{Cookie:cookie,Origin:'http://localhost:9000'}})).status).toBe(403);expect((await request('/attempts',{},'POST',{'X-CSRF-Token':''})).status).toBe(403);expect((await request('/attempts',{bad:true})).status).toBe(400);});
 it('performs creation, replay dialogs, CAS edits, PTY, preview, sealing, validation, interview, evaluation, export and delete',async()=>{
  const scenario=(await ok('/scenarios')).items.find((s:any)=>s.scenarioId==='retail-coaching');const key=crypto.randomUUID(),input={scenarioVersionId:scenario.versionId,mode:'developer',executionMode:'replay',priorSolutionSeen:false};
  const [one,two]=await Promise.all([request('/attempts',input,'POST',{'Idempotency-Key':key}),request('/attempts',input,'POST',{'Idempotency-Key':key})]);expect(one.value.id).toBe(two.value.id);const id=one.value.id,baseA='/attempts/'+id;
  expect((await request('/attempts',{...input,mode:'exam'},'POST',{'Idempotency-Key':key})).status).toBe(409);
  expect((await request('/attempts',input)).status).toBe(409);
  await operation(baseA+'/prepare',{version:one.value.version});let a=await ok(baseA);expect(a.state).toBe('ready');await operation(baseA+'/start',{version:a.version});
  expect(JSON.stringify(await ok('/scenarios/'+scenario.versionId))).not.toMatch(/private|rubric|facts/);
  const privateView=await ok('/developer/'+id+'/private-materials');expect(privateView.condition.code).toBe('private_material_exposed');
  const latest=instance.store.events(id).at(-1).seq;const controller=new AbortController();const stream=await fetch(base+'/api/v1'+baseA+'/events?after='+(latest-1),{headers:{Cookie:cookie},signal:controller.signal});const reader=stream.body!.getReader();const chunk=new TextDecoder().decode((await reader.read()).value);expect(chunk).toContain('id: '+latest);expect(chunk).not.toContain('id: '+(latest-1)+'\n');controller.abort();
  expect((await request(baseA+'/file?path=../state.sqlite')).status).toBeGreaterThanOrEqual(400);
  const f=await ok(baseA+'/file?path=DECISIONS.md');await ok(baseA+'/file',{path:f.path,content:'# 나의 판단\n고객의 질문에 맞춰 연습합니다.'},'PUT',{'If-Match':'"'+f.sha256+'"'});
  expect((await request(baseA+'/file',{path:f.path,content:'lost update'},'PUT',{'If-Match':'"'+f.sha256+'"'})).status).toBe(409);
  await operation(baseA+'/messages',{role:'stakeholder',content:'현재 가장 중요한 문제와 성공 기준은 무엇인가요?',sourceMessageIds:[]});const messages=(await ok(baseA+'/messages?role=stakeholder')).items;expect(messages.at(-1).content).toContain('[재생]');expect((await ok(baseA+'/messages?role=coder')).items).toHaveLength(0);
  await operation(baseA+'/share-message',{messageId:messages.at(-1).id,comment:'이 기준을 확인해주세요.'});expect((await ok(baseA+'/messages?role=coder')).items[0].sourceMessageIds).toContain(messages.at(-1).id);
  const terminal=await ok(baseA+'/terminals',{cols:100,rows:20}),ticket=await ok(baseA+'/terminals/'+terminal.id+'/ticket');
  await new Promise<void>((resolve,reject)=>{const ws=new WebSocket(ticket.url,{headers:{Origin:base,Cookie:cookie}});const timeout=setTimeout(()=>{ws.terminate();reject(new Error('PTY did not respond'));},10000);ws.on('open',()=>ws.send(JSON.stringify({type:'input',text:'printf WPL_TERMINAL_OK\\n\r'})));ws.on('message',raw=>{if(raw.toString().includes('WPL_TERMINAL_OK')){clearTimeout(timeout);ws.close();resolve();}});ws.on('error',reject);});
  const pv=await operation(baseA+'/preview/start',{});expect(pv.ready).toBe(true);expect((await fetch(pv.url)).status).toBe(200);
  a=await ok(baseA);await operation(baseA+'/pause',{version:a.version});expect((await request(baseA+'/messages',{role:'coder',content:'modify',sourceMessageIds:[]})).status).toBe(409);a=await ok(baseA);await operation(baseA+'/resume',{version:a.version});a=await ok(baseA);
  const [j1,j2]=await Promise.all([ok(baseA+'/submit',{reason:'manual',version:a.version}),ok(baseA+'/submit',{reason:'manual',version:a.version})]);expect(j1.operationId).toBe(j2.operationId);await instance.runtime.promises.get(j1.operationId);
  const sub=await ok(baseA+'/submission');expect(sub.status).toBe('sealed');expect(sub.files.some((x:any)=>x.path.includes('node_modules'))).toBe(false);expect(JSON.stringify(sub)).not.toContain(root);expect((await request(baseA+'/file',{path:f.path,content:'after'},'PUT',{'If-Match':'"'+f.sha256+'"'})).status).toBe(409);
  const fixed=await ok('/submissions/'+sub.id+'/file?path=DECISIONS.md');fs.writeFileSync(path.join(instance.workspace.root(id),'DECISIONS.md'),'externally changed');expect((await ok('/submissions/'+sub.id+'/file?path=DECISIONS.md')).sha256).toBe(fixed.sha256);
  await operation('/submissions/'+sub.id+'/validate',{});const validations=(await ok('/submissions/'+sub.id+'/validations')).items;expect(validations[0].status).toBe('not_run');expect(validations[0].artifactHashBefore).toBe(validations[0].artifactHashAfter);
  await operation('/submissions/'+sub.id+'/interview',{});const overview=await ok(baseA+'/overview'),interview=overview.interview;for(const q of interview.questions)await ok('/interviews/'+interview.id+'/answers/'+q.id,{text:'고객 문제를 확인하고 공개 자료를 근거로 선택했습니다.',status:'answered'},'PUT');await ok('/interviews/'+interview.id+'/finalize',{});
  await operation('/submissions/'+sub.id+'/evaluations',{interviewId:interview.id});const report=(await ok('/submissions/'+sub.id+'/evaluations')).items[0];expect(report.judgments).toHaveLength(12);expect(report.scores.total).toBe(0);expect(report.scores.assessedCount).toBe(12);expect(report.isDemo).toBe(true);
  const exported=await operation('/evaluations/'+report.id+'/exports',{includeSubmittedFiles:true});expect((await ok('/exports/'+exported.exportId)).status).toBe('completed');const zip=await fetch(base+'/api/v1/exports/'+exported.exportId+'/download',{headers:{Cookie:cookie}});expect(zip.status).toBe(200);expect((await zip.arrayBuffer()).byteLength).toBeGreaterThan(500);
  await operation('/submissions/'+sub.id+'/evaluations',{interviewId:interview.id});const versions=(await ok('/submissions/'+sub.id+'/evaluations')).items;expect(versions).toHaveLength(2);expect(versions[1].id).toBe(report.id);const comparison=await ok('/comparison?ids='+versions.map((e:any)=>e.id).join(','));expect(comparison.comparable).toBe(true);
  await ok(baseA,undefined,'DELETE');expect((await request(baseA)).status).toBe(404);
 },60000);
});
