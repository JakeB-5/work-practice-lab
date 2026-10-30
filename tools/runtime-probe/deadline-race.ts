import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {createApp} from '../../apps/server/src/app.ts';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'wpl-live-deadline-')),app=await createApp({repoRoot:process.cwd(),dataRoot:root});await app.listen(0);
const evidence:any={startedAt:new Date().toISOString(),realModel:true,realChildProcess:true,passed:false};
async function wait(predicate:()=>boolean,timeout=30000){const until=Date.now()+timeout;while(!predicate()&&Date.now()<until)await new Promise(r=>setTimeout(r,40));if(!predicate())throw new Error('condition timeout');}
async function settle(job:any){await app.runtime.promises.get(job.operationId);return app.store.get('operations',job.operationId);}
try{
 await app.runtime.inferenceCheck();evidence.runtimeGate=await app.runtime.probe();
 const scenario=app.scenarios.list().find(s=>s.scenarioId==='retail-coaching')!;
 let a:any=app.attempts.create({scenarioVersionId:scenario.versionId,mode:'practice',executionMode:'live',priorSolutionSeen:true,durationSeconds:600});await settle(app.attempts.prepare(a.id,a.version));a=app.store.requireAttempt(a.id);await settle(app.attempts.start(a.id,a.version));a=app.store.requireAttempt(a.id);
 const writer=path.join(a.workspaceRoot,'writer.mjs');fs.writeFileSync(writer,`import fs from 'node:fs';process.on('SIGTERM',()=>{});setInterval(()=>fs.appendFileSync('progress.txt','x'),25);`);
 const child=await app.workspace.launch(a.id,[process.execPath,writer],a.workspaceRoot,{},'terminal');await wait(()=>fs.existsSync(path.join(a.workspaceRoot,'progress.txt')));
 const request=app.agents.send(a.id,'coder','For runtime interruption verification, explain numbers 1 through 100 in detail, with several sentences for each. Do not use tools or change files.');
 await wait(()=>!!app.runtime.activeWire?.turnId,60000);evidence.modelWasRunning=app.runtime.active?.op.id===request.operationId;
 const current=app.store.requireAttempt(a.id);current.deadlineAt=new Date(Date.now()+100).toISOString();app.store.saveAttempt(current);
 await wait(()=>app.store.requireAttempt(a.id).state==='submitted'||app.store.requireAttempt(a.id).state==='submission_failed',30000);
 const state=app.store.requireAttempt(a.id);evidence.attemptState=state.state;evidence.operationStatus=app.store.get('operations',request.operationId).status;evidence.childLive=await app.workspace.living([child.pid!]);
 if(state.state!=='submitted')throw new Error('deadline submission failed');
 const sub=app.submissions.forAttempt(a.id);evidence.cutoffAt=sub.cutoffAt;evidence.sealedAt=sub.sealedAt;evidence.conditions=sub.conditions;evidence.manifestHash=sub.manifestHash;
 evidence.snapshotVerified=app.submissions.verify(sub.id);const before=app.submissions.file(sub.id,'progress.txt').sha256;await new Promise(r=>setTimeout(r,200));evidence.stable=app.submissions.file(sub.id,'progress.txt').sha256===before;
 try{app.workspace.write(a.id,'late.txt','late',undefined,true);evidence.lateWriteRejected=false;}catch{evidence.lateWriteRejected=true;}
 evidence.passed=evidence.modelWasRunning&&evidence.operationStatus==='interrupted'&&evidence.childLive.length===0&&evidence.snapshotVerified&&evidence.stable&&evidence.lateWriteRejected;
 if(!evidence.passed)process.exitCode=1;
}catch(e:any){evidence.error=e.message;process.exitCode=1;}finally{evidence.completedAt=new Date().toISOString();fs.writeFileSync('docs/evidence/live-deadline-race.json',JSON.stringify(evidence,null,2)+'\n');await app.close();fs.rmSync(root,{recursive:true,force:true});console.log(JSON.stringify(evidence));}
