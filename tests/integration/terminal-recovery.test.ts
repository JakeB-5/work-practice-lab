import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import WebSocket from 'ws';import {createApp} from '../../apps/server/src/app.ts';
let app:Awaited<ReturnType<typeof createApp>>,root:string,url:string,cookie:string,csrf:string,id:string,terminal:any;
const clients:WebSocket[]=[];
async function req(route:string,body?:any){const r=await fetch(url+'/api/v1'+route,{method:body?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':crypto.randomUUID()},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(await r.text());return r.json();}
async function connect(after=0){const ticket=await req('/attempts/'+id+'/terminals/'+terminal.id+'/ticket'),frames:any[]=[];const ws=new WebSocket(ticket.url+'&afterSeq='+after,{headers:{Origin:url,Cookie:cookie}});clients.push(ws);ws.on('message',data=>frames.push(JSON.parse(data.toString())));await expect.poll(()=>frames.some(f=>f.type==='replay-complete')).toBe(true);return {ws,frames};}
beforeAll(async()=>{
 root=fs.mkdtempSync(path.join(os.tmpdir(),'wpl-terminal-recovery-'));app=await createApp({repoRoot:process.cwd(),dataRoot:root});url=await app.listen(0);
 const response=await fetch(url+'/api/v1/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchToken:app.issueLaunch()})});csrf=(await response.json()).csrfToken;cookie=response.headers.get('set-cookie')!.split(';')[0];
 const s=app.scenarios.list().find(s=>s.scenarioId==='retail-coaching')!;let a=app.attempts.create({scenarioVersionId:s.versionId,mode:'developer',executionMode:'replay',priorSolutionSeen:false});id=a.id;
 await app.runtime.promises.get(app.attempts.prepare(id,a.version).operationId);a=app.store.requireAttempt(id);await app.runtime.promises.get(app.attempts.start(id,a.version).operationId);terminal=await app.workspace.terminal(id,100,25);
 const primed=new Promise<void>((resolve,reject)=>{const listener=(e:any)=>{if(e.attemptId===id&&e.type==='terminal.output'&&e.payload.text.includes('RECOVERY_ready')){clearTimeout(timer);app.store.off('event',listener);resolve();}};const timer=setTimeout(()=>{app.store.off('event',listener);reject(new Error('Terminal did not print fixture marker'));},5000);app.store.on('event',listener);});
 app.workspace.input(id,terminal.id,'printf "RECOVERY_%s\\n" ready\r');await primed;
});
afterAll(async()=>{clients.forEach(ws=>ws.terminate());await app.close();fs.rmSync(root,{recursive:true,force:true});});
it('replays dimensions with output and brackets history with explicit boundaries',async()=>{
 const {frames}=await connect();expect(frames[0].type).toBe('replay-start');expect(frames.at(-1).type).toBe('replay-complete');
 const data=frames.filter(f=>f.seq);expect(data.length).toBeGreaterThan(0);for(const frame of data){expect(frame.cols).toBe(100);expect(frame.rows).toBe(25);}
});
it('broadcasts one ordered size to all viewers and replays it on reconnect',async()=>{
 const a=await connect(),b=await connect();a.ws.send(JSON.stringify({type:'resize',cols:72,rows:18}));
 await expect.poll(()=>a.frames.some(f=>f.cols===72&&f.rows===18)).toBe(true);await expect.poll(()=>b.frames.some(f=>f.cols===72&&f.rows===18)).toBe(true);
 const marker=a.frames.find(f=>f.cols===72&&f.rows===18);expect(b.frames.find(f=>f.seq===marker.seq)).toEqual(marker);
 app.workspace.input(id,terminal.id,'printf "AFTER_%s\\n" resize\r');await expect.poll(()=>a.frames.some(f=>f.text?.includes('AFTER_resize'))).toBe(true);
 const restored=await connect(marker.seq);expect(restored.frames.filter(f=>f.seq).every(f=>f.seq>marker.seq&&f.cols===72&&f.rows===18)).toBe(true);
});
