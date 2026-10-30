import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Store,uid,now,AppError,assert} from '../core.ts';
import {Scenarios} from './scenarios.ts';
import {Workspace} from './workspace.ts';
import {Runtime} from './runtime.ts';
const exec=promisify(execFile);
export class Attempts{
 timer:ReturnType<typeof setInterval>|null=null;onDeadline:(id:string)=>Promise<any>=async()=>{};expiring=new Set<string>();
 constructor(public store:Store,public scenarios:Scenarios,public workspace:Workspace,public runtime:Runtime){}
 dto(a:any){return {id:a.id,scenarioVersionId:a.scenarioVersionId,mode:a.mode,executionMode:a.executionMode,state:a.state,version:a.version,durationSeconds:a.durationSeconds,startedAt:a.startedAt,deadlineAt:a.deadlineAt,pausedAt:a.pausedAt,pausedTotalMs:a.pausedTotalMs,conditions:a.conditions,createdAt:a.createdAt,model:a.model??null};}
 list(){return {items:this.store.all('attempts','1=1 ORDER BY created_at DESC').map(a=>this.dto(a)),nextCursor:null};}
 selectedModel(input:any){
  const s=this.scenarios.get(input.scenarioVersionId),allowed=s.allowedModels as string[]|null|undefined;
  const model=input.model??(allowed?.includes(this.runtime.model||'')?this.runtime.model:allowed?.[0]??this.runtime.model);
  assert(model===undefined||model===null||(typeof model==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(model)),400,'VALIDATION_ERROR','모델 ID를 확인해주세요.');
  assert(!allowed||allowed.includes(model),403,'MODEL_NOT_ALLOWED','이 과제에서 허용하지 않은 모델입니다.');
  return model;
 }
 async createChecked(input:any,source?:any){const model=this.selectedModel(input);if(input.executionMode==='live')await this.runtime.requireModel(model);return this.create({...input,model},source);}
 create(input:any,source?:any){
  const s=this.scenarios.get(input.scenarioVersionId),active=this.store.all('attempts',"state NOT IN ('completed','abandoned')")[0];assert(!active,409,'ACTIVE_ATTEMPT_EXISTS','현재 연습을 완료하거나 종료한 뒤 새 시도를 시작해주세요.');
  const id=uid('att'),createdAt=now(),conditions:any[]=[];if(input.mode==='developer')conditions.push({code:'developer_run',occurredAt:createdAt,note:'개발 모드'});if(input.priorSolutionSeen)conditions.push({code:'prior_solution_seen',occurredAt:createdAt,note:'풀이 사전 노출'});if(source)conditions.push({code:'continued_attempt',occurredAt:createdAt,note:source.attemptId+'에서 이어 연습'});
  const a={id,scenarioVersionId:s.id,mode:input.mode,executionMode:input.executionMode,state:'preparing',version:1,durationSeconds:input.mode==='exam'?s.durationSeconds:input.durationSeconds||s.durationSeconds,startedAt:null,deadlineAt:null,pausedAt:null,pausedTotalMs:0,conditions,createdAt,model:this.selectedModel(input),workspaceRoot:path.join(this.store.dataRoot,'attempts',id,'workspace'),sourceAttemptId:source?.attemptId||null,sourceSubmissionId:source?.id||null,templatePrepared:false};
  assert(Number.isInteger(a.durationSeconds)&&a.durationSeconds>=60&&a.durationSeconds<=86400,400,'VALIDATION_ERROR','연습 시간을 확인해주세요.');
  try{this.store.insert('attempts',a,{id,scenario_version_id:s.id,mode:a.mode,execution_mode:a.executionMode,state:a.state,version:1,duration_seconds:a.durationSeconds,paused_total_ms:0,condition_json:JSON.stringify(conditions),runtime_snapshot_json:JSON.stringify({...this.runtime.config(),model:a.model}),workspace_root:a.workspaceRoot,source_attempt_id:a.sourceAttemptId,created_at:createdAt,updated_at:createdAt});}catch(e:any){if(e.message.includes('UNIQUE'))throw new AppError(409,'ACTIVE_ATTEMPT_EXISTS','이미 활성 연습이 있습니다.');throw e;}
  this.store.event(id,'attempt.created',{scenarioVersionId:s.id,mode:a.mode,executionMode:a.executionMode,model:a.model});return this.dto(a);
 }
 background(kind:string,id:string,fn:()=>Promise<any>){
  const op=this.store.operation(kind,id);this.store.setOperation(op.id,{status:'running'});
  const promise=Promise.resolve().then(async()=>{try{const result=await fn();this.store.setOperation(op.id,{status:'succeeded',result,resultRef:result?.resultRef||null});return result;}catch(e:any){if(e.code==='INTERRUPTED')this.store.setOperation(op.id,{status:'interrupted'});else this.store.failOperation(op.id,e);throw e;}});promise.catch(()=>{});this.runtime.promises.set(op.id,promise);return {operationId:op.id};
 }
 expectVersion(a:any,version:number){assert(a.version===version,409,'VERSION_CONFLICT','상태가 바뀌었습니다. 새로고침 후 다시 시도해주세요.');}
 prepare(id:string,version:number){
  const a=this.store.requireAttempt(id);this.expectVersion(a,version);assert(!this.store.all('operations',"attempt_id=? AND kind='attempt.prepare' AND state IN ('queued','running')",[id]).length,409,'PROCESS_BUSY','환경 준비가 이미 진행 중입니다.');assert(['preparing','preparation_failed'].includes(a.state),409,'INVALID_STATE','이미 준비된 연습입니다.');
  if(a.state==='preparation_failed')Object.assign(a,this.store.transition(id,['preparation_failed'],'preparing'));
  return this.background('attempt.prepare',id,async()=>{
   try{
    if(a.executionMode==='live'){await this.runtime.requireModel(a.model);const probe=await this.runtime.probe();assert(probe.inferenceState==='passed'&&probe.capabilities.restrictedRole&&probe.capabilities.coderWorkspace&&probe.capabilities.interrupt&&probe.capabilities.resume,422,'RUNTIME_CAPABILITY_MISSING','설정에서 실제 Codex 연결·권한 검사를 먼저 실행해주세요.');}
    const scenario=this.scenarios.get(a.scenarioVersionId);
    if(!a.templatePrepared){if(fs.existsSync(a.workspaceRoot))fs.rmSync(a.workspaceRoot,{recursive:true,force:true});await this.workspace.create(a,scenario);a.templatePrepared=true;a.version++;this.store.saveAttempt(a);}
    if(a.sourceSubmissionId){const sub=this.store.get('submissions',a.sourceSubmissionId);assert(sub,404,'NOT_FOUND','이전 제출본이 없습니다.');fs.cpSync(path.join(sub.root,'files'),a.workspaceRoot,{recursive:true});}
    for(const command of scenario.prepare){const argv=command.argv.map((x:string)=>x.replaceAll('$'+'{WORKSPACE}',a.workspaceRoot));const output=await exec(argv[0],argv.slice(1),{cwd:path.join(a.workspaceRoot,command.cwdRelative),env:this.workspace.childEnv(),timeout:command.timeoutSeconds*1000,maxBuffer:1024*1024});this.store.event(id,'prepare.check',{argv,exitCode:0,output:this.store.redact(output.stdout+output.stderr)});}
    if(scenario.scenarioId==='equipment-booking')await this.workspace.postgres(id);
    return {attempt:this.dto(this.store.transition(id,['preparing'],'ready')),resultRef:'/api/v1/attempts/'+id};
   }catch(e){const current=this.store.requireAttempt(id);if(current.state==='preparing')this.store.transition(id,['preparing'],'preparation_failed');throw e;}
  });
 }
 start(id:string,version:number){const a=this.store.requireAttempt(id);this.expectVersion(a,version);return this.background('attempt.start',id,async()=>{const timestamp=now();const next=this.store.transition(id,['ready'],'running',{startedAt:timestamp,deadlineAt:new Date(Date.now()+a.durationSeconds*1000).toISOString()});return {attempt:this.dto(next),resultRef:'/api/v1/attempts/'+id};});}
 pause(id:string,version:number){const a=this.store.requireAttempt(id);this.expectVersion(a,version);assert(a.mode!=='exam',403,'ROLE_SCOPE_DENIED','시험 연습에서는 시간을 멈출 수 없습니다.');this.store.transition(id,['running'],'pausing');return this.background('attempt.pause',id,async()=>{try{await this.runtime.stopAttempt(id);await this.workspace.quiesce(id);const next=this.store.transition(id,['pausing'],'paused',{pausedAt:now()});return this.dto(next);}catch(e){if(this.store.requireAttempt(id).state==='pausing')this.store.transition(id,['pausing'],'running');throw e;}});}
 resume(id:string,version:number){const a=this.store.requireAttempt(id);this.expectVersion(a,version);assert(a.mode!=='exam',403,'ROLE_SCOPE_DENIED','시험 연습에서는 재개 동작을 사용할 수 없습니다.');return this.background('attempt.resume',id,async()=>{const elapsed=Date.now()-Date.parse(a.pausedAt);return this.dto(this.store.transition(id,['paused'],'running',{pausedAt:null,pausedTotalMs:a.pausedTotalMs+elapsed,deadlineAt:new Date(Date.parse(a.deadlineAt)+elapsed).toISOString()}));});}
 abandon(id:string,version:number){const a=this.store.requireAttempt(id);this.expectVersion(a,version);assert(!['completed','abandoned','sealing'].includes(a.state),409,'INVALID_STATE','현재 종료할 수 없습니다.');return this.background('attempt.abandon',id,async()=>{await this.runtime.stopAttempt(id);await this.workspace.quiesce(id);const current=this.store.requireAttempt(id);this.store.db.prepare('UPDATE scoped_tokens SET revoked_at=? WHERE attempt_id=?').run(now(),id);return this.dto(this.store.transition(id,[current.state],'abandoned'));});}
 fork(id:string,mode:string){const a=this.store.requireAttempt(id),sub=this.store.all('submissions','attempt_id=?',[id])[0];assert(sub,409,'INVALID_STATE','고정 제출본이 필요합니다.');return this.createChecked({scenarioVersionId:a.scenarioVersionId,mode,executionMode:a.executionMode,priorSolutionSeen:true,model:a.model},sub);}
 adjust(id:string,seconds:number,reason:string){const a=this.store.requireAttempt(id);assert(a.mode==='developer',403,'ROLE_SCOPE_DENIED','개발 모드에서만 시간을 변경할 수 있습니다.');if(a.deadlineAt)a.deadlineAt=new Date(Date.parse(a.deadlineAt)+seconds*1000).toISOString();else a.durationSeconds=Math.max(60,Math.min(86400,a.durationSeconds+seconds));a.version++;this.store.saveAttempt(a);return this.dto(this.store.condition(id,'time_changed',reason+' ('+seconds+'초)'));}
 runClock(){this.timer=setInterval(()=>{for(const a of this.store.all('attempts',"state IN ('running','pausing')")){if(a.deadlineAt&&Date.now()>=Date.parse(a.deadlineAt)&&!this.expiring.has(a.id)){this.expiring.add(a.id);this.onDeadline(a.id).catch(()=>{}).finally(()=>this.expiring.delete(a.id));}}},500);this.timer.unref();}
 recover(){
  for(const o of this.store.all('operations',"state IN ('running','awaiting_approval','interrupting')"))this.store.setOperation(o.id,{status:'uncertain',error:{code:'RUNTIME_UNCERTAIN',message:'서버가 재시작됐습니다. 접수 상태 확인이 필요합니다.',retryable:false,requestId:o.id}});
  for(const approval of this.store.all('approvals',"state='pending'")){approval.status='expired';this.store.update('approvals',approval.id,approval,{state:'expired',resolved_at:now()});}
  for(const o of this.store.all('operations',"state='queued'"))this.store.setOperation(o.id,{status:'interrupted'});
  for(const m of this.store.all('messages',"author='assistant' AND state IN ('queued','streaming')")){
    const op=this.store.get('operations',m.operationId);if(!op||!['uncertain','interrupted'].includes(op.status))continue;
    m.status=op.status;m.content=m.content||(op.status==='uncertain'?'서버가 재시작되어 실행 상태 확인이 필요합니다.':'서버 재시작으로 대기가 취소됐습니다.');
    this.store.update('messages',m.id,m,{state:m.status,content:m.content,updated_at:now()});this.store.event(m.attemptId,'message.completed',m,m.role);
  }
  for(const a of this.store.all('attempts')){
    this.workspace.watch(a.id);
    if(a.state==='pausing')this.store.transition(a.id,['pausing'],'running');
    if(a.state==='sealing')this.store.transition(a.id,['sealing'],'submission_failed');
    if(a.state==='evaluating')this.store.transition(a.id,['evaluating'],'evaluation_failed');
  }
 }
 async remove(id:string){
  const a=this.store.requireAttempt(id);assert(['completed','abandoned'].includes(a.state),409,'INVALID_STATE','완료하거나 종료한 연습만 삭제할 수 있습니다.');
  assert(!this.store.all('attempts','source_attempt_id=?',[id]).length,409,'DEPENDENT_ATTEMPTS','이 시도를 이어 만든 연습을 먼저 삭제해주세요.');
  await this.workspace.quiesce(id);
  const exportFiles=this.store.all('exports','evaluation_id IN (SELECT e.id FROM evaluations e JOIN submissions s ON s.id=e.submission_id WHERE s.attempt_id=?)',[id]).map(e=>e.file).filter(Boolean);
  this.store.txn(()=>{
   const run=(sql:string)=>this.store.db.prepare(sql).run(id);
   run('DELETE FROM exports WHERE evaluation_id IN (SELECT e.id FROM evaluations e JOIN submissions s ON s.id=e.submission_id WHERE s.attempt_id=?)');
   run('DELETE FROM evaluations WHERE submission_id IN (SELECT id FROM submissions WHERE attempt_id=?)');
   run('DELETE FROM interview_answers WHERE interview_id IN (SELECT i.id FROM interviews i JOIN submissions s ON s.id=i.submission_id WHERE s.attempt_id=?)');
   run('DELETE FROM interviews WHERE submission_id IN (SELECT id FROM submissions WHERE attempt_id=?)');
   for(const table of ['evidence','scoped_tokens','validation_runs','submission_jobs','submissions','fact_disclosures','context_manifests','messages','notes','managed_processes','approvals','usage_observations','agent_sessions'])run('DELETE FROM '+table+' WHERE attempt_id=?');
   run('DELETE FROM outbox WHERE event_id IN (SELECT id FROM events WHERE attempt_id=?)');run('DELETE FROM events WHERE attempt_id=?');run('DELETE FROM request_receipts WHERE operation_id IN (SELECT id FROM operations WHERE attempt_id=?)');run('DELETE FROM request_receipts WHERE attempt_id=?');run('DELETE FROM operations WHERE attempt_id=?');run('DELETE FROM attempts WHERE id=?');
  });
  this.workspace.unwatch(id);
  const owned=path.join(this.store.dataRoot,'attempts',id);assert(path.dirname(owned)===path.join(this.store.dataRoot,'attempts'),403,'ROLE_SCOPE_DENIED','삭제 경로가 잘못됐습니다.');fs.rmSync(owned,{recursive:true,force:true});
  for(const file of exportFiles)if(path.dirname(file)===path.join(this.store.dataRoot,'exports'))fs.rmSync(file,{force:true});
  for(const blob of this.store.db.prepare('SELECT sha256,owned_relative_path FROM blobs WHERE sha256 NOT IN (SELECT sha256 FROM evidence WHERE sha256 IS NOT NULL)').all() as any[]){const file=path.join(this.store.dataRoot,blob.owned_relative_path);if(path.dirname(file)===path.join(this.store.dataRoot,'blobs'))fs.rmSync(file,{force:true});this.store.db.prepare('DELETE FROM blobs WHERE sha256=?').run(blob.sha256);}
  await this.workspace.dropDatabase(id).catch(()=>{});
 }
 close(){if(this.timer)clearInterval(this.timer);}
}
