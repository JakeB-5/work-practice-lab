import {it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createApp} from '../../apps/server/src/app.ts';
import {assessmentRubric,assessmentQuestions} from '../../apps/server/src/modules/evaluation-policy.ts';
import {uid,now} from '../../apps/server/src/core.ts';
let app:Awaited<ReturnType<typeof createApp>>,root:string,scenario:any;
async function settle(j:any){await app.runtime.promises.get(j.operationId)?.catch(()=>{});return app.store.get('operations',j.operationId);}
async function fresh(){
 for(const a of app.store.all('attempts',"state NOT IN ('completed','abandoned')"))await settle(app.attempts.abandon(a.id,a.version));
 let a=app.attempts.create({scenarioVersionId:scenario.versionId,mode:'developer',executionMode:'replay',priorSolutionSeen:false,durationSeconds:600});await settle(app.attempts.prepare(a.id,a.version));a=app.store.requireAttempt(a.id);await settle(app.attempts.start(a.id,a.version));await settle(app.submissions.submit(a.id));const sub=app.submissions.forAttempt(a.id);await settle(app.evaluation.createInterview(sub.id));const interview=app.store.all('interviews','submission_id=? ORDER BY version DESC',[sub.id])[0];
 for(const q of interview.questions)app.evaluation.answer(interview.id,q.id,{text:'',status:'skipped'});app.evaluation.finalize(interview.id);return {a:app.store.requireAttempt(a.id),sub,interview:app.evaluation.interview(interview.id)};
}
// These are synthetic boundary tests, never evidence of real provider execution.
function validationFixture(sub:any,status='passed'){
 for(const check of app.scenarios.private(scenario.versionId,'validation.json').checks){const id=uid('val'),time=now(),r={id,attemptId:sub.attemptId,submissionId:sub.id,checkId:check.id,checkVersion:'test-fixture',status,origin:'fixed_check',startedAt:time,endedAt:time,evidenceIds:[],detail:'SYNTHETIC TEST ONLY',artifactHashBefore:sub.manifestHash,artifactHashAfter:sub.manifestHash};app.store.insert('validation_runs',r,{id,attempt_id:sub.attemptId,submission_id:sub.id,check_id:r.checkId,check_version:r.checkVersion,state:status,origin:r.origin,started_at:time,hash_before:sub.manifestHash,hash_after:sub.manifestHash});}
}
function setLive(a:any){a=app.store.requireAttempt(a.id);a.executionMode='live';app.store.saveAttempt(a);}
beforeAll(async()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'wpl-assessment-'));app=await createApp({repoRoot:process.cwd(),dataRoot:root});await app.listen(0);scenario=app.scenarios.list().find(s=>s.scenarioId==='retail-coaching');});
afterAll(async()=>{await app.close();fs.rmSync(root,{recursive:true,force:true});});
it('asks five complete opportunities and labels replay numeric results as demonstration only',async()=>{
 const {sub,interview}=await fresh();expect(interview.questions).toHaveLength(5);for(const id of ['INT-1','INT-2','INT-3','INT-4','COG-1','COG-2','COG-3','COG-4'])expect(interview.questions.some((q:any)=>q.criterionIds.includes(id))).toBe(true);
 expect((await settle(app.evaluation.evaluate(sub.id,interview.id))).status).toBe('succeeded');const e=app.store.all('evaluations','submission_id=?',[sub.id])[0];expect(e.scores).toEqual({technology:0,intent:0,cognition:0,total:0,assessedCount:12});expect(e.isDemo).toBe(true);expect(e.judgments.every((j:any)=>j.status==='rated'&&j.basis==='not_demonstrated')).toBe(true);
 const inventory=app.store.all('evidence','submission_id=?',[sub.id]).find(e=>e.locator.kind==='assessment_inventory');expect(JSON.parse(app.validation.content(inventory.id).bytes.toString()).criterionOpportunities.every((q:any)=>q.answerStatus==='skipped')).toBe(true);
});
it('rejects absent ratings, missing IDs, inventory-only positive credit, and AI-only understanding',async()=>{
 const {sub,interview}=await fresh();await settle(app.evaluation.evaluate(sub.id,interview.id));const e=app.store.all('evaluations','submission_id=?',[sub.id])[0],context=app.evaluation.context(sub);app.evaluation.evidenceInventory(sub,interview,context);const rubric=assessmentRubric(app.scenarios.private(scenario.versionId,'rubric.json')),base={judgments:e.judgments,nextActions:[]};
 const missing=structuredClone(base);missing.judgments[0].rating=null;missing.judgments[0].status='unassessed';expect(()=>app.evaluation.checkDraft(missing,sub,rubric,context)).toThrow();
 const fake=structuredClone(base);fake.judgments[0].evidenceIds=[uid('evi')];expect(()=>app.evaluation.checkDraft(fake,sub,rubric,context)).toThrow('없는 근거');
 const positive=structuredClone(base);positive.judgments[0].rating=4;positive.judgments[0].basis='observed';expect(()=>app.evaluation.checkDraft(positive,sub,rubric,context)).toThrow('기술 점수');
 const ai=structuredClone(base),file=context.evidence.find(e=>e.kind==='file')!;ai.judgments[4]={...ai.judgments[4],rating:4,basis:'observed',evidenceIds:[file.id]};expect(()=>app.evaluation.checkDraft(ai,sub,rubric,context)).toThrow('사용자가 작성한');
});
it('blocks live grades on missing or broken validation before any score record is created',async()=>{
 const {a,sub,interview}=await fresh();setLive(a);expect(()=>app.evaluation.evaluate(sub.id,interview.id)).toThrow('고정 검사');expect(app.store.all('evaluations','submission_id=?',[sub.id])).toHaveLength(0);validationFixture(sub,'error');expect(()=>app.evaluation.evaluate(sub.id,interview.id)).toThrow('실행 환경');expect(app.store.requireAttempt(a.id).state).toBe('interviewing');
});
it('does not convert persistent model null output into a completed or zero result',async()=>{
 const {a,sub,interview}=await fresh();setLive(a);validationFixture(sub);const raw=app.runtime.raw;let calls=0;app.runtime.raw=async()=>{calls++;return JSON.stringify({judgments:[],nextActions:[]});};
 try{expect((await settle(app.evaluation.evaluate(sub.id,interview.id))).status).toBe('failed');expect(calls).toBe(2);const e=app.store.all('evaluations','submission_id=?',[sub.id])[0];expect(e.status).toBe('failed');expect(e.scores.total).toBeNull();expect(app.store.requireAttempt(a.id).state).toBe('evaluation_failed');}finally{app.runtime.raw=raw;}
});
it('allows actual failed task checks to be graded without mistaking them for infrastructure errors',async()=>{
 const {a,sub,interview}=await fresh();setLive(a);validationFixture(sub,'failed');const raw=app.runtime.raw;app.runtime.raw=async(_a,_r,prompt)=>{const p=JSON.parse(prompt);return JSON.stringify({judgments:p.rubric.criteria.map((c:any)=>({criterionId:c.id,axis:c.axis,status:'rated',rating:0,basis:'not_demonstrated',rationale:'테스트용 기록: 표준 기회 이후 입증하지 못함',evidenceIds:[p.assessmentInventoryId],limitation:null})),nextActions:[]});};
 try{expect((await settle(app.evaluation.evaluate(sub.id,interview.id))).status).toBe('succeeded');const e=app.store.all('evaluations','submission_id=?',[sub.id])[0];expect(e.scores.total).toBe(0);expect(e.isDemo).toBe(false);expect(e.scoringPolicyVersion).toBe('1.0.0');}finally{app.runtime.raw=raw;}
});
it('preserves old answers and reports while supplementing an old interview',async()=>{
 const {sub,interview}=await fresh();await settle(app.evaluation.evaluate(sub.id,interview.id));const original=app.store.all('evaluations','submission_id=?',[sub.id])[0],old=app.store.get('interviews',interview.id);delete old.coverageVersion;app.store.update('interviews',old.id,old);expect(()=>app.evaluation.evaluate(sub.id,old.id)).toThrow('보완 질문');
 const job=app.evaluation.createInterview(sub.id,true);expect(app.evaluation.createInterview(sub.id,true).operationId).toBe(job.operationId);await settle(job);const newer=app.store.all('interviews','submission_id=? ORDER BY version DESC',[sub.id])[0];expect(newer.version).toBe(2);expect(newer.supplementsInterviewId).toBe(old.id);expect(app.store.get('interviews',old.id).answers).toEqual(interview.answers);expect(app.evaluation.get(original.id)).toEqual(original);expect(app.store.requireAttempt(sub.attemptId).state).toBe('interviewing');
});
it('rejects silently omitted textual evidence and keeps the attempt ready for recovery',async()=>{
 const {sub,interview}=await fresh();const ev=app.validation.evidence(sub.attemptId,sub.id,'message','user',{kind:'event',attemptId:sub.attemptId,seq:1},'x'.repeat(70000));expect(()=>app.evaluation.evaluate(sub.id,interview.id)).toThrow('일부 기록이 누락');expect(app.store.all('evaluations','submission_id=?',[sub.id])).toHaveLength(0);expect(app.store.requireAttempt(sub.attemptId).state).toBe('interviewing');expect(app.evaluation.context(sub).excludedEvidenceIds).toContain(ev.id);
});
it('accepts maintaining a justified working approach in the effective rubric',()=>{const c=assessmentRubric(app.scenarios.private(scenario.versionId,'rubric.json')).criteria.find((c:any)=>c.id==='INT-4');expect(c.targetBehavior).toContain('유지');expect(assessmentQuestions[1].text).toContain('수정할 문제가 없었다면');});

it('rejects positive technology credit based only on an actual user design explanation',async()=>{
 const {sub,interview}=await fresh();await settle(app.evaluation.evaluate(sub.id,interview.id));const report=app.store.all('evaluations','submission_id=?',[sub.id])[0],context=app.evaluation.context(sub);app.evaluation.evidenceInventory(sub,interview,context);
 const user=context.evidence.find(e=>e.source==='user')!;const draft={judgments:structuredClone(report.judgments),nextActions:[]};draft.judgments[1]={...draft.judgments[1],rating:1,basis:'observed',evidenceIds:[user.id],rationale:'설명한 설계가 좋다는 이유로 기술 점수를 주려는 잘못된 판정'};
 expect(()=>app.evaluation.checkDraft(draft,sub,assessmentRubric(app.scenarios.private(scenario.versionId,'rubric.json')),context)).toThrow('기술 점수');
});
