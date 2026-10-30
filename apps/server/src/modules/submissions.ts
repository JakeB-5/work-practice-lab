import fs from 'node:fs';
import path from 'node:path';
import {Store,uid,now,hash,AppError,assert,cleanRelative} from '../core.ts';
import {Workspace} from './workspace.ts';
import {Runtime} from './runtime.ts';
import {Attempts} from './attempts.ts';
import {Agents} from './agents.ts';
export class Submissions{
 constructor(public store:Store,public workspace:Workspace,public runtime:Runtime,public attempts:Attempts,public agents:Agents){attempts.onDeadline=async id=>{const r=this.submit(id,'deadline');await runtime.promises.get(r.operationId);};}
 dto(s:any){const {root,...publicData}=s;return publicData;}
 get(id:string){const s=this.store.get('submissions',id);assert(s,404,'NOT_FOUND','제출본이 없습니다.');return s;}
 forAttempt(id:string){const s=this.store.all('submissions','attempt_id=?',[id])[0];assert(s,404,'NOT_FOUND','아직 제출하지 않았습니다.');return s;}
 inventory(root:string){
  const files:{path:string,size:number,sha256:string}[]=[],excludedFiles:{path:string,reason:string}[]=[];let total=0;
  const excluded=new Set(['node_modules','.git','dist','build','coverage','.next','.cache','runtime']);
  const walk=(dir:string)=>{
   for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name),relative=path.relative(root,full).split(path.sep).join('/');
    if(excluded.has(entry.name)||(entry.name.startsWith('.env')&&entry.name!=='.env.example')){excludedFiles.push({path:relative,reason:'dependency, generated output, or sensitive environment'});continue;}
    if(entry.isSymbolicLink())throw new AppError(422,'SNAPSHOT_UNSAFE_FILE','제출본에 심볼릭 링크를 포함할 수 없습니다: '+relative);
    if(entry.isDirectory())walk(full);else if(entry.isFile()){
      const st=fs.statSync(full);assert(st.size<=20*1024*1024,413,'PAYLOAD_TOO_LARGE','파일이 제출 한도를 초과합니다: '+relative);total+=st.size;assert(total<=200*1024*1024,413,'PAYLOAD_TOO_LARGE','전체 제출 한도 200MiB를 초과했습니다.');
      const fd=fs.openSync(full,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const bytes=fs.readFileSync(fd);files.push({path:relative,size:bytes.length,sha256:hash(bytes)});}finally{fs.closeSync(fd);}
    }else throw new AppError(422,'SNAPSHOT_UNSAFE_FILE','일반 파일만 제출할 수 있습니다.');
   }
  };walk(root);files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);excludedFiles.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);return {files,excludedFiles};
 }
 submit(id:string,reason='manual',version?:number){
  const a=this.store.requireAttempt(id),existing=this.store.all('submission_jobs','attempt_id=?',[id])[0],sealed=this.store.all('submissions','attempt_id=?',[id])[0];
  if(sealed&&existing){this.verify(sealed.id);const operation=this.store.get('operations',existing.operationId);if(operation?.status!=='succeeded')this.store.setOperation(existing.operationId,{status:'succeeded',error:null,result:{submissionId:sealed.id,resultRef:'/api/v1/attempts/'+id+'/submission'},resultRef:'/api/v1/attempts/'+id+'/submission'});existing.phase='sealed';this.store.update('submission_jobs',existing.id,existing,{phase:'sealed',updated_at:now()});return {operationId:existing.operationId};}
  if(a.state==='sealing'&&existing)return {operationId:existing.operationId};
  if(version!==undefined)this.attempts.expectVersion(a,version);
  assert(['running','paused','pausing','submission_failed'].includes(a.state),409,'INVALID_STATE','지금은 제출할 수 없습니다.');
  const cutoffAt=existing?.cutoffAt||now(),subId=existing?.submissionId||uid('sub');
  this.store.transition(id,[a.state],'sealing');
  const result=this.attempts.background('submission.seal',id,async()=>{
   const job=this.store.all('submission_jobs','attempt_id=?',[id])[0];
   const phase=(value:string,message:string)=>{job.phase=value;job.updatedAt=now();this.store.update('submission_jobs',job.id,job,{phase:value,updated_at:job.updatedAt});if(value!=='sealed')this.store.event(id,'submission.progress',{operationId:job.operationId,phase:value,message});};
   try{
    if(this.store.consumeFault(id,'snapshot'))throw new AppError(503,'SNAPSHOT_FAILED','개발 모드 제출 실패 재현',true);
    phase('draining','실행 중인 작업을 정리합니다.');this.agents.revoke(id);
    const before=this.inventory(a.workspaceRoot);
    await this.runtime.stopAttempt(id);await this.workspace.quiesce(id);
    const finalRoot=path.join(this.store.dataRoot,'attempts',id,'submissions',subId),staging=path.join(this.store.dataRoot,'attempts',id,'staging',subId);
    if(fs.existsSync(finalRoot)&&fs.existsSync(path.join(finalRoot,'manifest.json'))){
      const saved=JSON.parse(fs.readFileSync(path.join(finalRoot,'manifest.json'),'utf8'));assert(saved.id===subId&&saved.attemptId===id&&hash(JSON.stringify(this.inventory(path.join(finalRoot,'files')).files))===saved.manifestHash,409,'SNAPSHOT_TAMPERED','복구할 제출본의 무결성을 확인하지 못했습니다.');this.commit(id,saved,finalRoot);phase('sealed','제출본을 복구했습니다.');return {submissionId:subId,resultRef:'/api/v1/attempts/'+id+'/submission'};
    }
    phase('copying','제출 파일을 고정합니다.');let selected:any=null;
    for(let n=0;n<3;n++){
      const first=this.inventory(a.workspaceRoot);fs.rmSync(staging,{recursive:true,force:true});fs.mkdirSync(path.join(staging,'files'),{recursive:true});
      for(const file of first.files){const from=this.workspace.resolve(id,file.path),dest=path.join(staging,'files',file.path);fs.mkdirSync(path.dirname(dest),{recursive:true});const fd=fs.openSync(from,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let bytes:Buffer;try{bytes=fs.readFileSync(fd);}finally{fs.closeSync(fd);}if(hash(bytes)!==file.sha256)break;this.store.atomicFile(dest,bytes);}
      const second=this.inventory(a.workspaceRoot),copied=this.inventory(path.join(staging,'files'));if(JSON.stringify(first.files)===JSON.stringify(second.files)&&JSON.stringify(first.files)===JSON.stringify(copied.files)){selected=first;break;}
    }
    assert(selected,409,'SNAPSHOT_CHANGED','복사 중 파일이 계속 변경됐습니다. 외부 실행을 정리하고 다시 제출해주세요.');
    if(JSON.stringify(before.files)!==JSON.stringify(selected.files))this.store.condition(id,'changed_after_cutoff','마감 처리 중 파일 변경이 확인됐습니다.');
    const state=this.store.requireAttempt(id),last=this.store.db.prepare('SELECT next_event_seq-1 AS seq FROM attempts WHERE id=?').get(id) as any;
    const manifest={id:subId,attemptId:id,status:'sealed',cutoffAt,sealedAt:now(),cutoffEventSeq:last.seq,manifestHash:hash(JSON.stringify(selected.files)),files:selected.files,excludedFiles:selected.excludedFiles,conditions:state.conditions};
    this.store.atomicFile(path.join(staging,'manifest.json'),JSON.stringify(manifest,null,2));
    phase('committing','저장 상태를 확정합니다.');fs.mkdirSync(path.dirname(finalRoot),{recursive:true});fs.renameSync(staging,finalRoot);this.commit(id,manifest,finalRoot);phase('sealed','제출이 완료됐습니다.');return {submissionId:subId,resultRef:'/api/v1/attempts/'+id+'/submission'};
   }catch(e){if(this.store.requireAttempt(id).state==='sealing')this.store.transition(id,['sealing'],'submission_failed');const j=this.store.all('submission_jobs','attempt_id=?',[id])[0];if(j){j.phase='failed';this.store.update('submission_jobs',j.id,j,{phase:'failed',updated_at:now()});}throw e;}
  });
  // background yields before touching this job after the first async drain.
  const job={id:existing?.id||uid('job'),attemptId:id,operationId:result.operationId,submissionId:subId,phase:'blocking',cutoffAt,updatedAt:now()};
  if(existing)this.store.update('submission_jobs',job.id,job,{operation_id:result.operationId,phase:'blocking',updated_at:job.updatedAt});
  else this.store.insert('submission_jobs',job,{id:job.id,attempt_id:id,operation_id:result.operationId,submission_id:subId,phase:'blocking',cutoff_at:cutoffAt,staging_relative:'attempts/'+id+'/staging/'+subId,recovery_json:'{}',updated_at:job.updatedAt});
  return result;
 }
 commit(id:string,s:any,root:string){this.store.txn(()=>{if(!this.store.get('submissions',s.id))this.store.insert('submissions',{...s,root},{id:s.id,attempt_id:id,cutoff_at:s.cutoffAt,sealed_at:s.sealedAt,cutoff_event_seq:s.cutoffEventSeq,manifest_hash:s.manifestHash,owned_relative_path:path.relative(this.store.dataRoot,root),manifest_json:JSON.stringify(s),condition_json:JSON.stringify(s.conditions)});this.store.transition(id,['sealing'],'submitted');this.store.event(id,'submission.sealed',{submissionId:s.id,manifestHash:s.manifestHash});});}
 file(id:string,relative:string){const s=this.get(id),rel=cleanRelative(relative);const manifest=s.files.find((f:any)=>f.path===rel);assert(manifest,404,'NOT_FOUND','제출된 파일이 아닙니다.');const file=path.join(s.root,'files',rel),bytes=fs.readFileSync(file);assert(hash(bytes)===manifest.sha256,409,'SNAPSHOT_TAMPERED','제출본이 외부에서 변경됐습니다.');return {path:rel,content:bytes.toString('utf8'),encoding:'utf-8',sha256:manifest.sha256,version:1,modifiedAt:s.sealedAt};}
 verify(id:string){const s=this.get(id),actual=this.inventory(path.join(s.root,'files'));assert(hash(JSON.stringify(actual.files))===s.manifestHash,409,'SNAPSHOT_TAMPERED','제출본의 무결성을 확인하지 못했습니다.');return true;}
}
