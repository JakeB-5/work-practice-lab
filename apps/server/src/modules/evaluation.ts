import {evaluationPolicy,scoringPolicyVersion,interviewCoverageVersion,assessmentQuestions,assessmentRubric} from './evaluation-policy.ts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {Store,uid,now,hash,assert,AppError} from '../core.ts';
import {Runtime,finalJson} from './runtime.ts';
import {Scenarios} from './scenarios.ts';
import {Submissions} from './submissions.ts';
import {Validation} from './validation.ts';
import {Attempts} from './attempts.ts';
const object=(properties:any)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function calculateScores(judgments:any[]){
 assert(judgments.length===12&&new Set(judgments.map(j=>j.criterionId)).size===12,422,'INVALID_EVALUATION','12개 항목이 필요합니다.');
 const scores:any={};
 for(const axis of ['technology','intent','cognition']){
  const rows=judgments.filter(j=>j.axis===axis);assert(rows.length===4,422,'INVALID_EVALUATION','축마다 4개 항목이 필요합니다.');
  for(const r of rows)assert(r.status==='rated'&&Number.isInteger(r.rating)&&r.rating>=0&&r.rating<=4&&r.evidenceIds?.length,422,'INCOMPLETE_GRADING','최종 평가에는 근거가 있는 12개 항목의 점수가 모두 필요합니다.');
  scores[axis]=rows.reduce((n,r)=>n+r.rating,0)/16*100;
 }
 return {...scores,total:scores.technology+scores.intent+scores.cognition,assessedCount:12};
}
export class Evaluation{
 validator:any;
 constructor(public store:Store,public runtime:Runtime,public scenarios:Scenarios,public submissions:Submissions,public validation:Validation,public attempts:Attempts,public repoRoot:string){
  const schema=JSON.parse(fs.readFileSync(path.join(repoRoot,'packages/contracts/domain.schema.json'),'utf8'));const ajv=new Ajv2020({strict:false,allErrors:true});addFormats(ajv);this.validator=ajv.compile({$defs:schema.$defs,$ref:'#/$defs/EvaluationDraft'});
 }
 context(sub:any){
  this.validation.collect(sub);const all=this.store.all('evidence','submission_id=?',[sub.id]),included:any[]=[],excluded:string[]=[],images:string[]=[];let size=0;
  const ordered=all.filter(e=>e.locator.kind!=='assessment_inventory').sort((a,b)=>({message:0,command:1,browser_capture:2,file:3}[a.kind as string]??4)-({message:0,command:1,browser_capture:2,file:3}[b.kind as string]??4)||(a.kind==='browser_capture'?b.observedAt.localeCompare(a.observedAt):0));
  for(const e of ordered){
    if(e.kind==='browser_capture'){if(images.length<2&&e.sha256){const blob=this.store.db.prepare('SELECT owned_relative_path FROM blobs WHERE sha256=?').get(e.sha256) as any;images.push(path.join(this.store.dataRoot,blob.owned_relative_path));included.push({id:e.id,kind:e.kind,source:e.source,locator:e.locator,note:'이미지 첨부'});}else excluded.push(e.id);continue;}
    const content=this.validation.content(e.id);const text=content.bytes.toString('utf8');if(text.length>65536||size+text.length>160000){excluded.push(e.id);continue;}size+=text.length;included.push({id:e.id,kind:e.kind,source:e.source,locator:e.locator,content:text});
  }
  return {evidence:included,excludedEvidenceIds:excluded,images,conditions:sub.conditions,validationRuns:this.store.all('validation_runs','submission_id=?',[sub.id]).map(r=>({checkId:r.checkId,status:r.status,origin:r.origin,detail:r.detail,evidenceIds:r.evidenceIds}))};
 }
 createInterview(subId:string,supplemental=false){
  const sub=this.submissions.get(subId),a=this.store.requireAttempt(sub.attemptId),existing=this.store.all('interviews','submission_id=? ORDER BY version DESC',[subId])[0];
  if(existing&&(!supplemental||existing.status==='answering'))return {operationId:existing.operationId};
  assert(['submitted','interviewing','completed','evaluation_failed'].includes(a.state),409,'INVALID_STATE','제출 후에 질문을 만들 수 있습니다.');
  assert(!this.store.all('attempts',"state NOT IN ('completed','abandoned') AND id<>?",[a.id]).length,409,'ACTIVE_ATTEMPT_EXISTS','다른 응시가 진행 중입니다.');
  const pending=this.store.all('operations',"attempt_id=? AND kind='interview.generate' AND state IN ('queued','running')",[a.id])[0];if(pending)return {operationId:pending.id};
  assert(!this.store.all('validation_runs',"submission_id=? AND state='running'",[subId]).length,409,'PROCESS_BUSY','검증이 끝난 뒤 진행해주세요.');
  if(a.state!=='interviewing')this.store.transition(a.id,[a.state],'interviewing');
  const job=this.runtime.enqueue('interview.generate',a.id,'evaluator',async op=>{
   const context=this.context(sub);let prefaces:string[]=assessmentQuestions.map(()=> '');
   if(a.executionMode!=='replay'){
    const old=this.runtime.sessions.get(a.id+':evaluator');if(old){old.rpc.close();this.runtime.sessions.delete(a.id+':evaluator');}
    const schema=object({prefaces:{type:'array',minItems:5,maxItems:5,items:{type:'string'}}});
    const prompt=JSON.stringify({purpose:'Write five brief Korean context sentences, one per supplied mandatory question, grounded in the submitted evidence. Each is at most 100 Korean characters. Do not answer the questions, reveal scoring anchors, or assume missing functionality. An empty sentence is allowed. The system appends the mandatory questions unchanged.',mandatoryQuestions:assessmentQuestions.map(q=>q.text),brief:this.scenarios.resource(a.scenarioVersionId,'brief').content,...context,images:undefined});
    prefaces=finalJson(await this.runtime.raw(a.id,'evaluator',prompt,schema,op,undefined,context.images)).prefaces;
    assert(Array.isArray(prefaces)&&prefaces.length===5&&prefaces.every(p=>typeof p==='string'&&p.length<=100),502,'INVALID_INTERVIEW','질문 맥락의 형식을 확인해주세요.');
   }
   const questions=assessmentQuestions.map((q,index)=>({...q,id:uid('qst'),text:(prefaces[index]?prefaces[index]+'\n':'')+q.text,evidenceIds:context.evidence.filter(e=>e.kind==='file').slice(0,2).map(e=>e.id)}));
   const record={id:uid('int'),submissionId:subId,version:(existing?.version||0)+1,coverageVersion:interviewCoverageVersion,supplementsInterviewId:existing?.id||null,status:'answering',questions,answers:[],createdAt:now(),finalizedAt:null,operationId:op.id};
   this.store.txn(()=>{this.store.insert('interviews',record,{id:record.id,submission_id:subId,version:record.version,state:'answering',questions_json:JSON.stringify(record.questions),created_at:record.createdAt});this.store.event(a.id,'interview.ready',{interviewId:record.id});});
   return {interviewId:record.id,resultRef:'/api/v1/interviews/'+record.id};
  });return {operationId:job.operationId};
 }
 interview(id:string){const i=this.store.get('interviews',id);assert(i,404,'NOT_FOUND','질문을 찾지 못했습니다.');const {operationId,...dto}=i;return dto;}
 answer(id:string,qid:string,input:any){
  const i=this.store.get('interviews',id);assert(i?.status==='answering',409,'INVALID_STATE','답변을 수정할 수 없습니다.');assert(i.questions.some((q:any)=>q.id===qid),404,'NOT_FOUND','질문이 없습니다.');
  assert(['draft','answered','skipped'].includes(input.status)&&typeof input.text==='string'&&input.text.length<=8000,400,'VALIDATION_ERROR','답변 형식을 확인해주세요.');if(input.status==='answered')assert(input.text.trim(),400,'VALIDATION_ERROR','답변을 입력하거나 건너뛰기를 선택해주세요.');
  const answer={questionId:qid,text:input.text,status:input.status,updatedAt:now()};i.answers=i.answers.filter((x:any)=>x.questionId!==qid);i.answers.push(answer);
  this.store.txn(()=>{this.store.db.prepare('INSERT INTO interview_answers(interview_id,question_id,content,state,updated_at,data_json) VALUES (?,?,?,?,?,?) ON CONFLICT(interview_id,question_id) DO UPDATE SET content=excluded.content,state=excluded.state,updated_at=excluded.updated_at,data_json=excluded.data_json').run(id,qid,answer.text,answer.status,answer.updatedAt,JSON.stringify(answer));this.store.update('interviews',id,i);});return answer;
 }
 finalize(id:string){const i=this.store.get('interviews',id);assert(i,404,'NOT_FOUND','질문이 없습니다.');if(i.status==='finalized')return this.interview(id);assert(i.questions.every((q:any)=>i.answers.some((a:any)=>a.questionId===q.id&&['answered','skipped'].includes(a.status))),409,'INCOMPLETE_ANSWERS','모든 질문에 답하거나 건너뛰기를 선택해주세요.');i.status='finalized';i.finalizedAt=now();this.store.update('interviews',id,i,{state:'finalized',finalized_at:i.finalizedAt});return this.interview(id);}
 readiness(sub:any,interview:any){
  assert(interview.coverageVersion===interviewCoverageVersion&&assessmentQuestions.every(required=>required.criterionIds.every(id=>interview.questions.some((q:any)=>q.criterionIds?.includes(id)))),409,'INTERVIEW_UPGRADE_REQUIRED','최종 채점을 위해 보완 질문 5개에 먼저 답해주세요.');
  const a=this.store.requireAttempt(sub.attemptId);if(a.executionMode==='replay')return;
  const definition=this.scenarios.private(a.scenarioVersionId,'validation.json');
  const runs=this.store.all('validation_runs','submission_id=? ORDER BY started_at',[sub.id]);
  for(const check of definition.checks){const last=runs.filter(r=>r.checkId===check.id&&r.origin==='fixed_check').at(-1);assert(last&&['passed','failed'].includes(last.status),409,'ASSESSMENT_REQUIRES_VALIDATION','채점 전에 고정 검사를 완료해주세요. 실행 환경 오류·중단·미실행은 재검증이 필요합니다.');}
 }
 evidenceInventory(sub:any,interview:any,context:any){
  const inventory={submissionId:sub.id,manifestHash:sub.manifestHash,interviewId:interview.id,coverageVersion:interview.coverageVersion,scoringPolicyVersion,
   criterionOpportunities:interview.questions.map((q:any)=>({criterionIds:q.criterionIds,questionId:q.id,text:q.text,answerStatus:interview.answers.find((a:any)=>a.questionId===q.id)?.status})),
   includedEvidenceIds:context.evidence.map((e:any)=>e.id),excludedEvidenceIds:context.excludedEvidenceIds,
   validationRuns:context.validationRuns,statement:'수집된 제출·대화·검사·확정 답변의 목록입니다. 표준 기회 이후 입증하지 못했다는 판정의 참조로만 사용할 수 있으며 역량 보유·실행 성공을 증명하지 않습니다.'};
  const bytes=JSON.stringify(inventory),digest=hash(bytes),locator={kind:'assessment_inventory',submissionId:sub.id,interviewId:interview.id,digest};
  const existing=this.store.all('evidence','submission_id=?',[sub.id]).find(e=>e.locator.kind==='assessment_inventory'&&e.locator.digest===digest);
  const e=existing||this.validation.evidence(sub.attemptId,sub.id,'condition','system',locator,bytes);
  context.evidence.push({id:e.id,kind:e.kind,source:e.source,locator,content:bytes});return e.id;
 }
 evaluate(subId:string,interviewId:string){
  const sub=this.submissions.get(subId),a=this.store.requireAttempt(sub.attemptId),interview=this.store.get('interviews',interviewId);assert(interview?.submissionId===subId&&interview.status==='finalized',409,'INVALID_STATE','사후 답변을 먼저 확정해주세요.');
  assert(['interviewing','evaluation_failed','completed'].includes(a.state),409,'INVALID_STATE','지금은 평가할 수 없습니다.');assert(!this.store.all('attempts',"state NOT IN ('completed','abandoned') AND id<>?",[a.id]).length,409,'ACTIVE_ATTEMPT_EXISTS','다른 응시가 진행 중입니다.');
  this.submissions.verify(subId);this.readiness(sub,interview);
  const sourceRubric=this.scenarios.private(a.scenarioVersionId,'rubric.json'),rubric=assessmentRubric(sourceRubric),context=this.context(sub);
  // Optional extra captures may exceed the image budget. Textual observations
  // may not silently disappear and then become a candidate's zero score.
  const omitted=context.excludedEvidenceIds.filter(id=>this.validation.get(id).kind!=='browser_capture');
  assert(!omitted.length,409,'EVIDENCE_CONTEXT_INCOMPLETE','채점 입력에 일부 기록이 누락됐습니다. 기록 크기·수집 상태를 복구한 뒤 다시 평가해주세요.');
  const inventoryId=this.evidenceInventory(sub,interview,context);
  this.store.transition(a.id,[a.state],'evaluating');
  const version=(this.store.all('evaluations','submission_id=?',[subId]).reduce((n,r)=>Math.max(n,r.version),0))+1,id=uid('eva');
  const initial={id,submissionId:subId,interviewId,version,status:'queued',executionMode:a.executionMode,isDemo:a.executionMode==='replay',scoringPolicyVersion,rubricVersion:rubric.version,model:a.executionMode==='replay'?'replay':a.model||this.runtime.model||'unknown',promptVersion:'0.2.1',judgments:[],scores:{technology:null,intent:null,cognition:null,total:null,assessedCount:0},nextActions:[],conditions:this.store.requireAttempt(a.id).conditions,createdAt:now(),inputCoverage:{included:context.evidence.length,excluded:context.excludedEvidenceIds}};
  this.store.insert('evaluations',initial,{id,submission_id:subId,interview_id:interviewId,version,state:'queued',rubric_version:initial.rubricVersion,model:initial.model,prompt_version:initial.promptVersion,condition_json:JSON.stringify(initial.conditions),created_at:initial.createdAt});
  const job=this.runtime.enqueue('evaluation.run',a.id,'evaluator',async op=>{
   try{
    let draft:any;initial.status='running';this.store.update('evaluations',id,initial,{state:'running'});
    if(a.executionMode==='replay')draft={judgments:rubric.criteria.map((c:any)=>({criterionId:c.id,axis:c.axis,status:'rated',rating:0,basis:'not_demonstrated',rationale:'재생 모드의 고정 0점 예시입니다. 실제 응시자 채점이 아닙니다.',evidenceIds:[inventoryId],limitation:'화면·계산 흐름 검증용 데이터'})),nextActions:['실제 평가에는 로컬 Codex 실행 모드를 사용하세요.']};
    else{
      const entry=object({criterionId:{type:'string',enum:rubric.criteria.map((c:any)=>c.id)},axis:{type:'string',enum:['technology','intent','cognition']},status:{type:'string',enum:['rated']},rating:{type:'integer',enum:[0,1,2,3,4]},basis:{type:'string',enum:['observed','not_demonstrated']},rationale:{type:'string'},evidenceIds:{type:'array',items:{type:'string'},minItems:1},limitation:{type:['string','null']}});
      const schema=object({judgments:{type:'array',items:entry,minItems:12,maxItems:12},nextActions:{type:'array',items:{type:'string'},maxItems:3}});
      const prompt=JSON.stringify({purpose:evaluationPolicy,rubric,interview,assessmentInventoryId:inventoryId,...context,images:undefined});
      const old=this.runtime.sessions.get(a.id+':evaluator');if(old){old.rpc.close();this.runtime.sessions.delete(a.id+':evaluator');}
      draft=finalJson(await this.runtime.raw(a.id,'evaluator',prompt,schema,op,undefined,context.images));
      try{this.checkDraft(draft,sub,rubric,context);}catch(e:any){draft=finalJson(await this.runtime.raw(a.id,'evaluator',prompt+'\nPrevious result failed validation: '+e.message+'. Repair with all 12 numeric ratings, only supplied evidence, and the stated scoring policy.',schema,op,undefined,context.images));}
    }
    if(this.store.consumeFault(a.id,'invalid_evidence'))draft.judgments[0].evidenceIds=['evi_injected_nonexistent'];
    this.checkDraft(draft,sub,rubric,context);const scores=calculateScores(draft.judgments);const complete={...initial,status:'completed',judgments:draft.judgments,scores,nextActions:draft.nextActions};
    this.store.txn(()=>{this.store.update('evaluations',id,complete,{state:'completed',response_json:JSON.stringify(draft),scores_json:JSON.stringify(scores)});this.store.transition(a.id,['evaluating'],'completed');this.store.event(a.id,'evaluation.completed',{evaluationId:id});});
    return {evaluationId:id,resultRef:'/api/v1/evaluations/'+id};
   }catch(e){initial.status='failed';this.store.update('evaluations',id,initial,{state:'failed'});if(this.store.requireAttempt(a.id).state==='evaluating')this.store.transition(a.id,['evaluating'],'evaluation_failed');throw e;}
  });return {operationId:job.operationId};
 }
 checkDraft(draft:any,sub:any,rubric:any,context:any){
  assert(this.validator(draft),422,'INVALID_EVALUATION','평가 응답의 필드 또는 형식이 올바르지 않습니다.');
  assert(draft.judgments.length===12&&new Set(draft.judgments.map((j:any)=>j.criterionId)).size===12,422,'INVALID_EVALUATION','평가 항목이 중복되거나 누락됐습니다.');
  for(const j of draft.judgments){
   const c=rubric.criteria.find((c:any)=>c.id===j.criterionId);assert(c?.axis===j.axis,422,'INVALID_EVALUATION','평가 축이 일치하지 않습니다.');
   const cited=j.evidenceIds.map((id:string)=>{const e=context.evidence.find((e:any)=>e.id===id);assert(e,422,'INVALID_EVIDENCE','입력에 없는 근거를 인용했습니다.');this.validation.validateReference(this.validation.get(id),sub);return e;});
   if(j.basis==='not_demonstrated')assert(j.rating===0&&cited.some((e:any)=>e.locator.kind==='assessment_inventory'||e.locator.kind==='interview'),422,'INVALID_EVIDENCE','입증하지 못함 판정은 0점이며 확정 답변 또는 평가자료 목록을 인용해야 합니다.');
   if(j.axis==='technology'&&j.rating>0)assert(cited.some((e:any)=>e.kind==='file'&&e.locator.kind==='file'||e.kind==='command'&&['system','coder'].includes(e.source)||e.kind==='browser_capture'&&e.source==='system'),422,'INVALID_EVIDENCE','기술 점수에는 제출 코드 또는 실제 실행·화면 근거가 필요합니다. 설명만으로 점수를 줄 수 없습니다.');
   if(j.basis==='observed'&&['cognition','intent'].includes(j.axis))assert(cited.some((e:any)=>{if(e.source!=='user')return false;if(e.locator.kind!=='interview')return true;const answer=JSON.parse(e.content);return answer.status==='answered'&&answer.text?.trim();}),422,'INVALID_EVIDENCE','사용자 의도·이해 판정에는 사용자가 작성한 근거가 필요합니다.');
   if(j.basis==='observed')assert(cited.some((e:any)=>e.locator.kind!=='assessment_inventory'),422,'INVALID_EVIDENCE','평가자료 목록만으로 역량을 입증할 수 없습니다.');
  }
  calculateScores(draft.judgments);
 }
 get(id:string){const e=this.store.get('evaluations',id);assert(e,404,'NOT_FOUND','평가가 없습니다.');return e;}
 compare(ids:string[]){
  assert(ids.length===2,400,'VALIDATION_ERROR','평가 2개를 선택해주세요.');const [left,right]=ids.map(id=>this.get(id));const la=this.store.requireAttempt(this.submissions.get(left.submissionId).attemptId),ra=this.store.requireAttempt(this.submissions.get(right.submissionId).attemptId),reasons:string[]=[];
  for(const [label,x,y]of[['과제 버전',la.scenarioVersionId,ra.scenarioVersionId],['평가 기준',left.rubricVersion,right.rubricVersion],['채점 정책',left.scoringPolicyVersion||'legacy',right.scoringPolicyVersion||'legacy'],['모델',left.model,right.model],['모드',la.mode,ra.mode],['실행 방식',la.executionMode,ra.executionMode],['사전 조건',JSON.stringify(la.conditions.map((c:any)=>c.code).sort()),JSON.stringify(ra.conditions.map((c:any)=>c.code).sort())]])if(x!==y)reasons.push(String(label)+' 다름');
  const comparable=!reasons.length;return {left,right,comparable,reasons,scoreDifference:comparable&&left.scores.total!==null&&right.scores.total!==null?right.scores.total-left.scores.total:null};
 }
 export(id:string,includeFiles:boolean){
  const evaluation=this.get(id);assert(evaluation.status==='completed',409,'INVALID_STATE','완료된 평가만 내보낼 수 있습니다.');const sub=this.submissions.get(evaluation.submissionId);
  this.submissions.verify(sub.id);
  return this.attempts.background('evaluation.export',sub.attemptId,async()=>{
   const record={id:uid('exp'),evaluationId:id,status:'running',downloadPath:null,sha256:null};this.store.insert('exports',record,{id:record.id,evaluation_id:id,state:'running',created_at:now()});
   try{const zip=new JSZip(),evidence=this.store.all('evidence','submission_id=?',[sub.id]),omitted:string[]=[];
    const redactExport=(text:string)=>{let result=this.store.redact(text);const replacements:[[string,string],...Array<[string,string]>]=[[this.store.requireAttempt(sub.attemptId).workspaceRoot,'[SUBMISSION]'],[this.store.dataRoot,'[LOCAL_DATA]'],[this.repoRoot,'[APP_ROOT]'],[os.homedir(),'[HOME]']];for(const [from,to]of replacements.sort((a,b)=>b[0].length-a[0].length))if(from)result=result.split(from).join(to);return result;};
    const evidencePath=(id:string)=>'evidence/'+id+(evidence.find(e=>e.id===id)?.kind==='browser_capture'?'.png':'.txt');
    const md=['# 비공식 연습 평가','', '평가 버전: '+evaluation.version,'실행 방식: '+(evaluation.executionMode==='replay'?'재생 데이터 · 실제 모델 평가 없음':'로컬 Codex 실연결'),'모델: '+evaluation.model,'채점 정책: '+(evaluation.scoringPolicyVersion||'이전 정책'),'결과 구분: '+(evaluation.isDemo?'재생 예시 · 실제 성적 아님':'실제 채점'),'총점: '+(evaluation.scores.total===null?'이전 정책 결과 · 새 채점 필요':evaluation.scores.total+'/300'),'',...evaluation.judgments.flatMap((j:any)=>['## '+j.criterionId+' · '+j.axis,'',j.status==='rated'?'판정: '+j.rating+'/4':'판정: 이전 정책의 점수 미확정',j.rationale,j.limitation||'','근거: '+j.evidenceIds.map((id:string)=>'[근거 '+id.slice(-6)+']('+evidencePath(id)+')').join(', '),'']),'## 다음 연습','',...evaluation.nextActions.map((s:string)=>'- '+s),'','## 조건','',...evaluation.conditions.map((c:any)=>'- '+c.code+': '+c.note)].join('\n');
    zip.file('report.md',redactExport(md));zip.file('report.json',redactExport(JSON.stringify(evaluation,null,2)));
    const exportedEvidence=[];
    for(const e of evidence){const exported={...e};if(e.sha256){const content=this.validation.content(e.id),bytes=content.mediaType==='image/png'?content.bytes:Buffer.from(redactExport(content.bytes.toString('utf8')));if(!bytes.equals(content.bytes)){exported.redacted=true;exported.sha256=hash(bytes);exported.confidenceNote='내보내기에서 인증 정보·로컬 경로를 가렸습니다. 원본 SHA-256: '+e.sha256;}zip.file(evidencePath(e.id),bytes);}exportedEvidence.push(exported);}
    zip.file('evidence.json',redactExport(JSON.stringify(exportedEvidence,null,2)));
    if(includeFiles)for(const f of sub.files){const bytes=fs.readFileSync(path.join(sub.root,'files',f.path));const text=bytes.toString('utf8');if(!bytes.includes(0)&&redactExport(text)!==text){omitted.push(f.path);continue;}zip.file('submission/'+f.path,bytes);}
    zip.file('export-notes.json',JSON.stringify({omittedSensitiveFiles:omitted,submissionId:sub.id,manifestHash:sub.manifestHash,notOfficialScore:true},null,2));
    const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),file=path.join(this.store.dataRoot,'exports',record.id+'.zip');this.store.atomicFile(file,bytes);
    Object.assign(record,{status:'completed',downloadPath:'/api/v1/exports/'+record.id+'/download',sha256:hash(bytes),file});this.store.update('exports',record.id,record,{state:'completed',owned_relative_path:path.relative(this.store.dataRoot,file),sha256:record.sha256});return {exportId:record.id,resultRef:'/api/v1/exports/'+record.id};
   }catch(e){this.store.update('exports',record.id,{...record,status:'failed'},{state:'failed'});throw e;}
  });
 }
}
