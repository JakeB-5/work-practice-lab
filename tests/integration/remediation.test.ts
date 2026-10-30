import {it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createApp} from '../../apps/server/src/app.ts';
import {checkDefinitions} from '../../apps/server/src/modules/check-definitions.ts';
let app:Awaited<ReturnType<typeof createApp>>,root:string,scenario:any,base:string;
const wait=async(predicate:()=>boolean,ms=10000)=>{const end=Date.now()+ms;while(!predicate()&&Date.now()<end)await new Promise(r=>setTimeout(r,40));expect(predicate()).toBe(true);};
async function settle(j:any){await app.runtime.promises.get(j.operationId)?.catch(()=>{});return app.store.get('operations',j.operationId);}
async function fresh(scenarioVersionId=scenario.versionId){for(const a of app.store.all('attempts',"state NOT IN ('completed','abandoned')"))await settle(app.attempts.abandon(a.id,a.version));let a=app.attempts.create({scenarioVersionId,mode:'developer',executionMode:'replay',priorSolutionSeen:true,durationSeconds:600});await settle(app.attempts.prepare(a.id,a.version));a=app.store.requireAttempt(a.id);await settle(app.attempts.start(a.id,a.version));return app.store.requireAttempt(a.id);}
beforeAll(async()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'wpl-remediation-'));app=await createApp({repoRoot:process.cwd(),dataRoot:root});base=await app.listen(0);scenario=app.scenarios.list().find(s=>s.scenarioId==='retail-coaching');});
afterAll(async()=>{await app.close();fs.rmSync(root,{recursive:true,force:true});});
it('rejects duplicate/unsupported check definitions and executes only selected authored checks',async()=>{
 expect(()=>checkDefinitions({version:'1',checks:[{id:'x1',kind:'http',description:'x',runner:'arbitrary-shell'}]})).toThrow();
 const check={id:'custom-page',kind:'browser',runner:'browser-page',description:'사용자 제작 첫 화면 검사'};
 expect(()=>checkDefinitions({version:'1',checks:[check,check]})).toThrow();
 const draft=app.scenarios.authoring(scenario.versionId);const authored=app.scenarios.author(scenario.versionId,{...draft,version:'0.9.0',validation:{version:'2',checks:[check,...draft.validation.checks]}});
 const a=await fresh(authored.versionId);await settle(app.submissions.submit(a.id));const sub=app.submissions.forAttempt(a.id);
 expect(()=>app.validation.start(sub.id,['missing'])).toThrow();expect(()=>app.validation.start(sub.id,[])).toThrow();
 const job=app.validation.start(sub.id,['custom-page']);expect(()=>app.validation.start(sub.id,['custom-page'])).toThrow();expect((await settle(job)).status).toBe('succeeded');
 const rows=app.store.all('validation_runs','submission_id=?',[sub.id]);expect(rows).toHaveLength(1);expect(rows[0].checkId).toBe('custom-page');expect(rows[0].checkVersion).toMatch(/^2:/);expect(rows[0].status).toBe('passed');expect(rows[0].artifactHashAfter).toBe(sub.manifestHash);
});
it('does not mask a browser crash with successful workflow API responses',async()=>{
 const a=await fresh();const f=app.workspace.read(a.id,'server.mjs');app.workspace.write(a.id,'server.mjs',`import http from 'node:http';http.createServer((req,res)=>{if(req.url==='/api/practice'){res.setHeader('content-type','application/json');res.end(JSON.stringify({reply:'test fixture response'}));}else{res.setHeader('content-type','text/html');res.end('<html><body><script>throw new Error("FIXTURE_PAGE_CRASH")</script></body></html>');}}).listen(Number(process.env.PORT),'127.0.0.1');`,f.sha256);
 await settle(app.submissions.submit(a.id));const sub=app.submissions.forAttempt(a.id);await settle(app.validation.start(sub.id,['retail-page']));const row=app.store.all('validation_runs','submission_id=?',[sub.id])[0];expect(row.status).toBe('failed');expect(row.detail).toContain('첫 화면 실행 실패');
});
it('stops a TERM-resistant child before deadline snapshot and rejects late edits',async()=>{
 const a=await fresh();const script=path.join(a.workspaceRoot,'writer.mjs');fs.writeFileSync(script,`import fs from 'node:fs';import{spawn}from'node:child_process';if(process.argv[2]==='child'){process.on('SIGTERM',()=>{});setInterval(()=>fs.appendFileSync('progress.txt','x'),20);}else{const c=spawn(process.execPath,[import.meta.filename,'child'],{stdio:'ignore'});fs.writeFileSync('child.pid',String(c.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);}`);
 const rec=await app.workspace.launch(a.id,[process.execPath,script],a.workspaceRoot,{},'terminal');await wait(()=>fs.existsSync(path.join(a.workspaceRoot,'progress.txt')));const child=Number(fs.readFileSync(path.join(a.workspaceRoot,'child.pid'),'utf8'));
 const expired=app.store.requireAttempt(a.id);expired.deadlineAt=new Date(Date.now()-1).toISOString();app.store.saveAttempt(expired);
 expect(()=>app.workspace.write(a.id,'too-late.txt','no',undefined,true)).toThrow();
 await wait(()=>app.store.requireAttempt(a.id).state==='submitted',15000);
 expect(await app.workspace.living([rec.pid!,child])).toEqual([]);const sub=app.submissions.forAttempt(a.id),before=app.submissions.file(sub.id,'progress.txt').sha256;await new Promise(r=>setTimeout(r,100));expect(app.submissions.file(sub.id,'progress.txt').sha256).toBe(before);expect(app.submissions.verify(sub.id)).toBe(true);
},20000);
it('recovers an owned process only after observed exit',async()=>{
 const a=await fresh();const rec=await app.workspace.launch(a.id,[process.execPath,'-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],a.workspaceRoot,{});await new Promise(r=>setTimeout(r,150));app.workspace.children.delete(rec.id);await app.workspace.recoverOwnedProcesses(a.id);expect(app.store.get('managed_processes',rec.id).state).toBe('exited');expect(await app.workspace.living([rec.pid!])).toEqual([]);
},10000);
it('runs authored argv with fixed provenance, records timeout and supports cancellation',async()=>{
 const draft=app.scenarios.authoring(scenario.versionId),checks=[{id:'custom-command',kind:'command',description:'실제 명령',argv:['${NODE}','-e','process.stdout.write("COMMAND_PROOF");'],timeoutSeconds:5},{id:'timed-command',kind:'command',description:'제한 시간',argv:['${NODE}','-e','setInterval(()=>{},1000)'],timeoutSeconds:1},{id:'cancel-command',kind:'command',description:'취소',argv:['${NODE}','-e','setInterval(()=>{},1000)'],timeoutSeconds:30}];
 const authored=app.scenarios.author(scenario.versionId,{...draft,version:'0.9.1',validation:{version:'3',checks}}),a=await fresh(authored.versionId);await settle(app.submissions.submit(a.id));const sub=app.submissions.forAttempt(a.id);
 await settle(app.validation.start(sub.id,['custom-command','timed-command']));let rows=app.store.all('validation_runs','submission_id=?',[sub.id]);expect(rows.map(r=>r.status)).toEqual(['passed','timed_out']);expect(rows.every(r=>r.origin==='fixed_check'&&r.artifactHashAfter===sub.manifestHash)).toBe(true);expect(app.validation.content(rows[0].evidenceIds[0]).bytes.toString()).toContain('COMMAND_PROOF');
 const job=app.validation.start(sub.id,['cancel-command']);await wait(()=>app.store.all('validation_runs',"submission_id=? AND state='running'",[sub.id]).length===1);app.validation.interrupt(job.operationId);expect((await settle(job)).status).toBe('interrupted');rows=app.store.all('validation_runs','submission_id=?',[sub.id]);expect(rows.at(-1).status).toBe('cancelled');expect(app.store.all('managed_processes',"attempt_id=? AND state='running'",[a.id])).toHaveLength(0);
},10000);

it('isolates authentication cookies between local app ports',async()=>{
 const second=await createApp({repoRoot:process.cwd(),dataRoot:path.join(root,'second-instance')});try{
  const other=await second.listen(0);
  const boot=async(url:string,token:string)=>{const r=await fetch(url+'/api/v1/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchToken:token})});return r.headers.get('set-cookie')!.split(';')[0];};
  const firstCookie=await boot(base,app.issueLaunch()),otherCookie=await boot(other,second.issueLaunch());expect(firstCookie.split('=')[0]).not.toBe(otherCookie.split('=')[0]);
  const both=firstCookie+'; '+otherCookie;
  expect((await fetch(base+'/api/v1/scenarios',{headers:{Cookie:both}})).status).toBe(200);
  expect((await fetch(other+'/api/v1/scenarios',{headers:{Cookie:both}})).status).toBe(200);
  expect((await fetch(base+'/api/v1/scenarios',{headers:{Cookie:otherCookie}})).status).toBe(401);
 }finally{await second.close();}
});
it('deduplicates repeated explicit retries even with different request keys',async()=>{
 const a=await fresh(),original=app.store.operation('coder.reply',a.id,'coder');app.store.setOperation(original.id,{status:'failed'});app.store.setSetting('retry:'+original.id,{name:'sendMessage',params:{attemptId:a.id},body:{role:'coder',content:'재시도 중복 검사',sourceMessageIds:[]}});
 const boot=await fetch(base+'/api/v1/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchToken:app.issueLaunch()})}),cookie=boot.headers.get('set-cookie')!.split(';')[0],csrf=(await boot.json()).csrfToken;
 const retry=async()=>{const response=await fetch(base+'/api/v1/operations/'+original.id+'/retry',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'X-WPL-CSRF':csrf,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({acknowledgeUncertain:false})});expect(response.status).toBeLessThan(300);return response.json();};
 const [one,two]=await Promise.all([retry(),retry()]);expect(one.operationId).toBe(two.operationId);await settle(one);expect((await retry()).operationId).toBe(one.operationId);expect(app.agents.history(a.id,'coder').filter(m=>m.author==='user')).toHaveLength(1);
});
it('restores partial messages as uncertain and cancels queued messages on server restart',async()=>{
 const a=await fresh(),running=app.store.operation('coder.reply',a.id,'coder'),queued=app.store.operation('stakeholder.reply',a.id,'stakeholder');app.store.setOperation(running.id,{status:'running'});
 const partial=app.agents.message(a.id,'coder','assistant','부분 응답',[],running.id);partial.status='streaming';app.store.update('messages',partial.id,partial,{state:'streaming'});const waiting=app.agents.message(a.id,'stakeholder','assistant','',[],queued.id);
 await app.close();app=await createApp({repoRoot:process.cwd(),dataRoot:root});base=await app.listen(0);
 expect(app.store.get('messages',partial.id).status).toBe('uncertain');expect(app.store.get('messages',partial.id).content).toBe('부분 응답');expect(app.store.get('messages',waiting.id).status).toBe('interrupted');expect(app.store.get('messages',waiting.id).content).toContain('대기가 취소');
});
it('verifies bytes after snapshot rename and recovers a committed submission after response loss',async()=>{
 const a=await fresh(),commit=app.submissions.commit.bind(app.submissions);app.submissions.commit=()=>{throw new Error('injected crash after rename before commit');};
 const first=await settle(app.submissions.submit(a.id));expect(first.status).toBe('failed');const job=app.store.all('submission_jobs','attempt_id=?',[a.id])[0],snapshot=path.join(root,'attempts',a.id,'submissions',job.submissionId,'files','DECISIONS.md'),original=fs.readFileSync(snapshot);app.submissions.commit=commit;
 fs.writeFileSync(snapshot,'corrupted while down');expect((await settle(app.submissions.submit(a.id))).status).toBe('failed');expect(app.store.all('submissions','attempt_id=?',[a.id])).toHaveLength(0);
 fs.writeFileSync(snapshot,original);expect((await settle(app.submissions.submit(a.id))).status).toBe('succeeded');expect(app.submissions.forAttempt(a.id).id).toBe(job.submissionId);expect(app.submissions.forAttempt(a.id).cutoffAt).toBe(job.cutoffAt);
 const b=await fresh();app.submissions.commit=(...args:any[])=>{commit(args[0],args[1],args[2]);throw new Error('injected response loss after DB commit');};const lost=app.submissions.submit(b.id);expect((await settle(lost)).status).toBe('failed');app.submissions.commit=commit;const recovered=app.submissions.submit(b.id);expect(recovered.operationId).toBe(lost.operationId);expect(app.store.get('operations',lost.operationId).status).toBe('succeeded');expect(app.submissions.verify(app.submissions.forAttempt(b.id).id)).toBe(true);
});
it('preserves work when files keep changing during snapshot and allows retry at the original cutoff',async()=>{
 const a=await fresh(),resolve=app.workspace.resolve.bind(app.workspace);let n=0;app.workspace.resolve=(id,rel,missing=false)=>{const file=resolve(id,rel,missing);if(id===a.id&&rel==='DECISIONS.md')fs.writeFileSync(file,'concurrent write '+(++n));return file;};
 expect((await settle(app.submissions.submit(a.id))).status).toBe('failed');app.workspace.resolve=resolve;const job=app.store.all('submission_jobs','attempt_id=?',[a.id])[0];expect(fs.readFileSync(path.join(a.workspaceRoot,'DECISIONS.md'),'utf8')).toContain('concurrent write');expect(app.store.all('submissions','attempt_id=?',[a.id])).toHaveLength(0);expect((await settle(app.submissions.submit(a.id))).status).toBe('succeeded');expect(app.submissions.forAttempt(a.id).cutoffAt).toBe(job.cutoffAt);
});
it('never kills an unowned PID or declares its cleanup successful',async()=>{
 const a=await fresh(),rec=app.workspace.register(a.id,'terminal',['unowned-test'],a.workspaceRoot,process.pid,null,'not-the-process-owner');await app.workspace.recoverOwnedProcesses(a.id);expect(app.store.get('managed_processes',rec.id).state).toBe('orphaned');await expect(app.workspace.quiesce(a.id)).rejects.toThrow();expect(process.kill(process.pid,0)).toBe(true);app.workspace.update(rec,{state:'exited'});
});
it('marks a real output stream truncated at the 50MiB cap and excludes later bytes',async()=>{
 const a=await fresh(),rec=await app.workspace.launch(a.id,[process.execPath,'-e',`const chunk='x'.repeat(1024*1024);for(let i=0;i<51;i++)process.stdout.write(chunk);process.stdout.write('AFTER_CAP_MARKER');`],a.workspaceRoot,{},'terminal');await wait(()=>app.workspace.children.get(rec.id)?.exited,30000);
 const rows=app.store.all('events',"attempt_id=? AND event_type='terminal.output'",[a.id]).filter(e=>e.payload.processId===rec.id),truncated=app.store.all('events',"attempt_id=? AND event_type='output.truncated'",[a.id]);expect(truncated).toHaveLength(1);expect(rows.reduce((n,e)=>n+Buffer.byteLength(e.payload.text),0)).toBeLessThanOrEqual(50*1024*1024);expect(rows.some(e=>e.payload.text.includes('AFTER_CAP_MARKER'))).toBe(false);
},40000);
it('does not consume an external file-change event when the file is read before watcher delivery',async()=>{
 const a=await fresh(),file=path.join(a.workspaceRoot,'DECISIONS.md');const before=app.workspace.read(a.id,'DECISIONS.md').sha256;fs.writeFileSync(file,'external before event');const read=app.workspace.read(a.id,'DECISIONS.md');expect(read.sha256).not.toBe(before);
 await wait(()=>app.store.events(a.id).some(e=>e.type==='workspace.changed'&&e.payload.path==='DECISIONS.md'&&e.payload.beforeHash===before&&e.payload.afterHash===read.sha256));fs.unlinkSync(file);
 await wait(()=>app.store.events(a.id).some(e=>e.type==='workspace.changed'&&e.payload.path==='DECISIONS.md'&&e.payload.afterHash===null));
});
it('downloads only authorized registered files even under a hidden data directory',async()=>{
 const a=await fresh();app.workspace.write(a.id,'.download-proof.txt','HIDDEN_DOWNLOAD_PROOF',undefined,true);
 const boot=await fetch(base+'/api/v1/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchToken:app.issueLaunch()})}),cookie=boot.headers.get('set-cookie')!.split(';')[0];
 const response=await fetch(base+'/api/v1/attempts/'+a.id+'/file/download?path=.download-proof.txt',{headers:{Cookie:cookie}});expect(response.status).toBe(200);expect(await response.text()).toBe('HIDDEN_DOWNLOAD_PROOF');
 expect((await fetch(base+'/api/v1/attempts/'+a.id+'/file/download?path=../state.sqlite',{headers:{Cookie:cookie}})).status).toBe(400);
 await settle(app.submissions.submit(a.id));const sub=app.submissions.forAttempt(a.id);await settle(app.evaluation.createInterview(sub.id));const i=app.store.all('interviews','submission_id=?',[sub.id])[0];for(const q of i.questions)app.evaluation.answer(i.id,q.id,{text:'',status:'skipped'});app.evaluation.finalize(i.id);await settle(app.evaluation.evaluate(sub.id,i.id));const e=app.store.all('evaluations','submission_id=?',[sub.id])[0];const out=await settle(app.evaluation.export(e.id,true)),exp=app.store.get('exports',out.result.exportId),hidden=path.join(root,'.hidden-download','report.zip');fs.mkdirSync(path.dirname(hidden),{recursive:true});fs.copyFileSync(exp.file,hidden);exp.file=hidden;app.store.update('exports',exp.id,exp);
 const zip=await fetch(base+exp.downloadPath,{headers:{Cookie:cookie}});expect(zip.status).toBe(200);expect(zip.headers.get('content-disposition')).toContain('work-practice-report.zip');expect((await zip.arrayBuffer()).byteLength).toBeGreaterThan(500);
});
it('redacts host paths in exports, updates evidence hashes, and emits working relative evidence links',async()=>{
 const completed=app.store.all('evaluations',"state='completed'").at(-1),sub=app.submissions.get(completed.submissionId);const e=app.validation.evidence(sub.attemptId,sub.id,'command','system',{kind:'event',attemptId:sub.attemptId,seq:1},'local path '+path.join(root,'private-host-path.txt'));
 const result=await settle(app.evaluation.export(completed.id,true)),exp=app.store.get('exports',result.result.exportId);const JSZip=(await import('jszip')).default,zip=await JSZip.loadAsync(fs.readFileSync(exp.file)),bytes=await zip.file('evidence/'+e.id+'.txt')!.async('nodebuffer');expect(bytes.toString()).not.toContain(root);expect(bytes.toString()).toContain('[LOCAL_DATA]');const metadata=JSON.parse(await zip.file('evidence.json')!.async('string')).find((x:any)=>x.id===e.id);expect(metadata.redacted).toBe(true);expect(metadata.sha256).toBe((await import('../../apps/server/src/core.ts')).hash(bytes));
 const md=await zip.file('report.md')!.async('string');for(const match of md.matchAll(/\]\((evidence\/[^)]+)\)/g))expect(zip.file(match[1])).not.toBeNull();expect(app.submissions.verify(sub.id)).toBe(true);
});

it('recovers file edits and new files when native watcher delivery is unavailable',async()=>{
 const a=await fresh();app.workspace.watchers.get(a.id)?.close();const before=app.workspace.read(a.id,'DECISIONS.md').sha256;
 fs.writeFileSync(path.join(a.workspaceRoot,'DECISIONS.md'),'polling fallback edit');fs.writeFileSync(path.join(a.workspaceRoot,'new-proof.txt'),'new file while native events are unavailable');const after=app.workspace.read(a.id,'DECISIONS.md').sha256;
 await wait(()=>app.store.events(a.id).some(e=>e.type==='workspace.changed'&&e.payload.path==='DECISIONS.md'&&e.payload.beforeHash===before&&e.payload.afterHash===after),5000);
 await wait(()=>app.store.events(a.id).some(e=>e.type==='workspace.changed'&&e.payload.path==='new-proof.txt'&&e.payload.beforeHash===null),5000);
});
