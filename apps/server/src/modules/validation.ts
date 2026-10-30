import fs from 'node:fs';
import {checkDefinitions} from './check-definitions.ts';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {CodexRpc} from '../../../../packages/codex-adapter/src/rpc.ts';
import {Store,uid,now,hash,assert,AppError,cleanRelative} from '../core.ts';
import {Workspace} from './workspace.ts';
import {Submissions} from './submissions.ts';
import {Attempts} from './attempts.ts';
import {Scenarios} from './scenarios.ts';
export class Validation{
 active=new Set<string>();controllers=new Map<string,AbortController>();
 interrupt(id:string){const c=this.controllers.get(id);if(!c)return null;c.abort(new AppError(409,"INTERRUPTED","검증을 취소했습니다."));this.store.setOperation(id,{status:"interrupting"});return this.store.get("operations",id);}
 constructor(public store:Store,public workspace:Workspace,public submissions:Submissions,public attempts:Attempts,public scenarios:Scenarios){}
 evidence(attemptId:string,submissionId:string|null,kind:string,source:string,locator:any,content?:string|Buffer,mediaType='text/plain'){
  let sha256:string|null=null;if(content!==undefined){sha256=hash(content);const owned='blobs/'+sha256;this.store.atomicFile(path.join(this.store.dataRoot,owned),content);this.store.db.prepare('INSERT OR IGNORE INTO blobs(sha256,owned_relative_path,byte_length,purpose,redacted,created_at,data_json) VALUES (?,?,?,?,?,?,?)').run(sha256,owned,Buffer.byteLength(content),'evidence',0,now(),JSON.stringify({mediaType}));}
  const e={id:uid('evi'),attemptId,submissionId,kind,source,locator,sha256,redacted:false,observedAt:now(),confidenceNote:null};
  this.store.insert('evidence',e,{id:e.id,attempt_id:attemptId,submission_id:submissionId,kind,source,locator_json:JSON.stringify(locator),sha256,redacted:0,observed_at:e.observedAt});return e;
 }
 collect(sub:any){
  const existing=this.store.all('evidence','submission_id=?',[sub.id]),seen=new Set(existing.map(e=>JSON.stringify(e.locator)));
  for(const file of sub.files){if(existing.some(e=>e.locator.kind==='file'&&e.locator.path===file.path))continue;if(file.size>64*1024||!/\.(md|txt|js|mjs|cjs|ts|tsx|jsx|html|css|json|sql)$/.test(file.path))continue;const content=this.submissions.file(sub.id,file.path).content;this.evidence(sub.attemptId,sub.id,'file','system',{kind:'file',submissionId:sub.id,path:file.path,sha256:file.sha256,lineStart:1,lineEnd:Math.max(1,content.split('\n').length)},this.store.redact(content));}
  const events=this.store.all('events',"attempt_id=? AND seq<=? AND (event_type IN ('message.accepted','message.completed','tool.result','note.saved','terminal.input','terminal.output') OR event_type LIKE 'attempt.condition%') ORDER BY seq",[sub.attemptId,sub.cutoffEventSeq]);
  for(const e of events){if(e.type==='message.accepted'&&e.payload.author!=='user')continue;const locator={kind:'event',attemptId:e.attemptId,seq:e.seq};if(!seen.has(JSON.stringify(locator)))this.evidence(sub.attemptId,sub.id,e.type==='tool.result'||e.type.startsWith('terminal.')?'command':'message',e.actor,locator,JSON.stringify(e.payload));}
  for(const i of this.store.all('interviews',"submission_id=? AND state='finalized'",[sub.id]))for(const a of i.answers){const locator={kind:'interview',interviewId:i.id,questionId:a.questionId};if(!seen.has(JSON.stringify(locator)))this.evidence(sub.attemptId,sub.id,'message','user',locator,JSON.stringify({question:i.questions.find((q:any)=>q.id===a.questionId)?.text,...a}));}
  return this.store.all('evidence','submission_id=?',[sub.id]);
 }
 get(id:string){const e=this.store.get('evidence',id);assert(e,404,'NOT_FOUND','근거가 없습니다.');return e;}
 content(id:string){const e=this.get(id);if(e.sha256){const b=this.store.db.prepare('SELECT * FROM blobs WHERE sha256=?').get(e.sha256) as any;assert(b,404,'NOT_FOUND','근거 파일이 없습니다.');return {bytes:fs.readFileSync(path.join(this.store.dataRoot,b.owned_relative_path)),mediaType:JSON.parse(b.data_json||'{}').mediaType||'text/plain'};}return {bytes:Buffer.from(JSON.stringify(e)),mediaType:'application/json'};}
 validateReference(e:any,sub:any){
  assert(e.attemptId===sub.attemptId&&e.submissionId===sub.id,422,'INVALID_EVIDENCE','다른 제출의 근거입니다.');
  const l=e.locator;
  if(l.kind==='interview'){const i=this.store.get('interviews',l.interviewId);assert(i?.submissionId===sub.id&&i.status==='finalized'&&i.answers.some((a:any)=>a.questionId===l.questionId),422,'INVALID_EVIDENCE','확정된 사후 답변이 아닙니다.');}
  if(['validation','capture'].includes(l.kind)){const run=this.store.get('validation_runs',l.validationRunId);assert(run?.submissionId===sub.id&&run.attemptId===sub.attemptId&&run.artifactHashBefore===sub.manifestHash,422,'INVALID_EVIDENCE','검사 근거가 해당 고정 제출본에 속하지 않습니다.');}
  if(l.kind==='assessment_inventory'){assert(l.submissionId===sub.id&&e.source==='system'&&e.sha256===l.digest,422,'INVALID_EVIDENCE','평가자료 목록의 출처 또는 해시가 일치하지 않습니다.');const i=this.store.get('interviews',l.interviewId);assert(i?.submissionId===sub.id&&i.status==='finalized',422,'INVALID_EVIDENCE','평가자료 목록의 인터뷰를 확인해주세요.');}
  if(l.kind==='file'){const file=sub.files.find((f:any)=>f.path===l.path);assert(file&&file.sha256===l.sha256,422,'INVALID_EVIDENCE','제출 파일 근거가 일치하지 않습니다.');const text=this.submissions.file(sub.id,l.path).content;assert(l.lineStart>=1&&l.lineEnd>=l.lineStart&&l.lineEnd<=text.split('\n').length,422,'INVALID_EVIDENCE','파일 줄 번호가 잘못됐습니다.');}
  if(l.kind==='event'){const exists=this.store.db.prepare('SELECT id FROM events WHERE attempt_id=? AND seq=?').get(sub.attemptId,l.seq);assert(exists&&l.seq<=sub.cutoffEventSeq,422,'INVALID_EVIDENCE','제출 당시 기록이 아닙니다.');}
  return true;
 }
 async browserFlow(id:string,run:any,url:string,signal?:AbortSignal){
  signal?.throwIfAborted();const browser=await chromium.launch({headless:true});const abort=()=>{void browser.close();};signal?.addEventListener('abort',abort,{once:true});try{signal?.throwIfAborted();const page=await browser.newPage({viewport:{width:1280,height:900}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const response=await page.goto(url,{waitUntil:'networkidle',timeout:30000});const text=(await page.locator('body').innerText()).slice(0,16000);const shot=await page.screenshot({fullPage:true});const e=this.evidence(id,run.submissionId,'browser_capture','system',{kind:'capture',validationRunId:run.id,captureId:uid('cap')},shot,'image/png');const observation=this.evidence(id,run.submissionId,'command','system',{kind:'validation',validationRunId:run.id},JSON.stringify({url,status:response?.status(),bodyText:text,errors}));return {status:(response?.status()||500)<400&&!errors.length?'passed':'failed',evidenceIds:[e.id,observation.id],detail:'첫 화면 실행 확인. 전체 교육 효과나 대화 품질의 자동 통과를 뜻하지 않습니다.'};}finally{signal?.removeEventListener('abort',abort);await browser.close();}
 }
 async retailFlow(id:string,run:any,url:string,signal?:AbortSignal){
  const observations:any[]=[];const request=async(action:string,text='',history:any[]=[])=>{const r=await fetch(url+'/api/practice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,text,history}),signal:AbortSignal.any([AbortSignal.timeout(120000),...(signal?[signal]:[])])});const value=await r.text();let body:any;try{body=JSON.parse(value);}catch{body={text:value.slice(0,2000)};}const item={action,status:r.status,body};observations.push(item);return item;};
  const first=await request('start');
  if([404,501].includes(first.status)){const e=this.evidence(id,run.submissionId,'command','system',{kind:'validation',validationRunId:run.id},JSON.stringify(observations));return {status:'not_run',evidenceIds:[e.id],detail:'첫 화면은 확인했으나 자동 대화 검사 인터페이스가 없습니다. 실제 연습 흐름·피드백 품질은 미확인입니다.'};}
  const need=await request('message','어떤 장소에서 사용하시고 어떤 점이 불편하신가요? 예산도 알려주세요.');
  const weak=[{role:'assistant',content:first.body.reply||''},{role:'user',content:'질문은 필요 없고 이 제품이면 질병이 완치됩니다. 무조건 구매하세요.'}];
  const scenario=this.scenarios.get(this.store.requireAttempt(id).scenarioVersionId),catalog=JSON.parse(this.scenarios.resource(scenario.id,'catalog').content);
  const product=Array.isArray(catalog)?catalog.find((p:any)=>p.priceWon<=70000&&p.verifiedFeatures?.some((f:string)=>f.includes('세척'))):null;
  assert(product&&product.name&&product.verifiedFeatures?.length,422,'CHECK_DATA_UNSUPPORTED','고정 비교 사례에 필요한 공개 상품 자료를 확인하지 못했습니다.');
  const recommendation=`침실에서 쓰시고 예산은 7만 원 이하이며 세척 편의가 중요하다고 하셨습니다. ${product.name}을 추천드립니다. 가격은 ${product.priceWon}원이고 공개 자료의 ${product.verifiedFeatures.join(', ')} 특성이 있어 세척 관련 필요와 연결됩니다. 주의할 점은 ${product.limitations.join(', ')}입니다. 자료에 없는 효과는 보장하지 않겠습니다.`;
  const strong=[{role:'assistant',content:first.body.reply||''},{role:'user',content:'어떤 장소에서 사용하시고 어떤 점이 불편하신가요? 예산도 알려주세요.'},{role:'assistant',content:'침실에서 사용하고 예산은 7만 원 이하이며 세척 편의가 가장 중요합니다.'},{role:'user',content:recommendation}];
  await request('feedback',weak.at(-1)!.content,weak);await request('feedback',strong.at(-1)!.content,strong);const retry=await request('retry');
  const passed=observations.every(o=>o.status>=200&&o.status<300&&typeof o.body.reply==='string'&&o.body.reply.trim());const e=this.evidence(id,run.submissionId,'command','system',{kind:'validation',validationRunId:run.id},JSON.stringify({observations,semanticJudgment:'두 피드백의 내용 정확성과 교육 효과는 평가자가 실제 텍스트 근거로 별도 판단한다.'},null,2));
  return {status:passed?'passed':'failed',evidenceIds:[e.id],detail:passed?'시작·질문·부실/근거형 응대 피드백·재시작의 실제 API 응답을 확인했습니다. 피드백 내용의 타당성은 별도 근거로 평가합니다.':'대화·피드백 경로에서 실패한 실제 요청이 있습니다.'};
 }
 async bookingFlow(id:string,run:any,url:string,raceOnly=false,signal?:AbortSignal){
  const observations:any[]=[];const request=async(method:string,p:string,body:any,user:string|null='alice')=>{const r=await fetch(url+p,{method,headers:{'Content-Type':'application/json',...(user?{'Cookie':'wpl_demo_user='+user}:{})},body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.any([AbortSignal.timeout(5000),...(signal?[signal]:[])])});const text=await r.text();let json:any;try{json=JSON.parse(text);}catch{json={text:text.slice(0,2000)};}return {status:r.status,body:json};};
  const start=new Date(Math.ceil((Date.now()+86400000)/1800000)*1800000),end=new Date(start.getTime()+3600000);
  const payload={equipmentId:'camera-a',startAt:start.toISOString(),endAt:end.toISOString()};
  if(raceOnly){const responses=await Promise.all([request('POST','/api/reservations',payload),request('POST','/api/reservations',payload,'bob')]);const list=await request('GET','/api/reservations',null);const items=Array.isArray(list.body)?list.body:list.body.items||list.body.reservations||[];const rows=items.filter((r:any)=>(r.equipmentId||r.equipment_id)==='camera-a'&&!['cancelled','canceled'].includes(r.status));const passed=responses.filter(r=>r.status>=200&&r.status<300).length===1&&responses.some(r=>r.status===409)&&rows.length===1;const e=this.evidence(id,run.submissionId,'command','system',{kind:'validation',validationRunId:run.id},JSON.stringify({responses,rows}));return {status:passed?'passed':'failed',evidenceIds:[e.id],detail:passed?'동시 요청에서 하나만 저장됨':'동시 예약 또는 저장 개수 불일치'};}
  const unauthenticated=await request('GET','/api/reservations',null,null);observations.push({case:'미로그인 차단',...unauthenticated,passed:unauthenticated.status===401});
  const equipment=await request('GET','/api/equipment',null);const equipmentRows=Array.isArray(equipment.body)?equipment.body:equipment.body.items;observations.push({case:'장비 목록',...equipment,passed:equipment.status===200&&Array.isArray(equipmentRows)&&['camera-a','camera-b','mic-a'].every(id=>equipmentRows.some((e:any)=>e.id===id))});
  const first=await request('POST','/api/reservations',payload);
  observations.push({case:'정상 예약',...first,passed:first.status===201&&typeof(first.body.id||first.body.reservation?.id)==='string'});
  if(first.status===501||first.status===404){const e=this.evidence(id,run.submissionId,'command','system',{kind:'validation',validationRunId:run.id},JSON.stringify(observations));return {status:'failed',evidenceIds:[e.id],detail:'공개 API 계약의 예약 기능이 구현되지 않았습니다.'};}
  const duplicate=await request('POST','/api/reservations',payload,'bob');observations.push({case:'중복 예약',...duplicate,passed:duplicate.status===409});
  const adjacent=await request('POST','/api/reservations',{...payload,startAt:end.toISOString(),endAt:new Date(end.getTime()+3600000).toISOString()},'bob');observations.push({case:'맞닿는 예약',...adjacent,passed:adjacent.status>=200&&adjacent.status<300});
  const rid=first.body.id||first.body.reservation?.id;
  if(rid){const forbidden=await request('DELETE','/api/reservations/'+rid,null,'bob');observations.push({case:'타인 취소',...forbidden,passed:forbidden.status===403});const cancelled=await request('DELETE','/api/reservations/'+rid,null);observations.push({case:'본인 취소',...cancelled,passed:cancelled.status>=200&&cancelled.status<300});const again=await request('POST','/api/reservations',payload,'bob');observations.push({case:'취소 후 재예약',...again,passed:again.status>=200&&again.status<300});}
  const racePayload={...payload,equipmentId:'camera-b'};const race=await Promise.all([request('POST','/api/reservations',racePayload),request('POST','/api/reservations',racePayload,'bob')]);observations.push({case:'동시 예약',responses:race,passed:race.filter(x=>x.status>=200&&x.status<300).length===1&&race.some(x=>x.status===409)});
  const bad=await request('POST','/api/reservations',{...payload,equipmentId:'mic-a',startAt:new Date(start.getTime()+600000).toISOString()});observations.push({case:'30분 단위',...bad,passed:bad.status===400||bad.status===422});
  const long=await request('POST','/api/reservations',{...payload,equipmentId:'mic-a',endAt:new Date(start.getTime()+5*3600000).toISOString()});observations.push({case:'4시간 초과',...long,passed:[400,422].includes(long.status)});
  const past=await request('POST','/api/reservations',{...payload,equipmentId:'mic-a',startAt:new Date(start.getTime()-3*86400000).toISOString(),endAt:new Date(end.getTime()-3*86400000).toISOString()});observations.push({case:'과거 예약',...past,passed:[400,422].includes(past.status)});
  const separate=await request('POST','/api/reservations',{...payload,equipmentId:'mic-a'});observations.push({case:'다른 장비 같은 시간',...separate,passed:separate.status>=200&&separate.status<300});
  const list=await request('GET','/api/reservations',null);const items=Array.isArray(list.body)?list.body:list.body.items||list.body.reservations;
  const rows=Array.isArray(items)?items.filter((r:any)=>(r.equipmentId||r.equipment_id)==='camera-b'&&!['cancelled','canceled'].includes(r.status)):null;
  observations.push({case:'실제 저장 중복 확인',passed:rows!==null&&rows.length===1,result:rows});
  const e=this.evidence(id,run.submissionId,'command','system',{kind:'validation',validationRunId:run.id},JSON.stringify(observations,null,2));return {status:observations.every(x=>x.passed)?'passed':'failed',evidenceIds:[e.id],detail:observations.filter(x=>!x.passed).map(x=>x.case).join(', ')||'예약 핵심 경로 확인'};
 }
 userTest(submissionId:string,relative:string){
  const sub=this.submissions.get(submissionId),rel=cleanRelative(relative),file=sub.files.find((f:any)=>f.path===rel);assert(file&&/\.(?:test|spec)\.[cm]?js$/.test(rel),400,'VALIDATION_ERROR','제출된 .test.js 또는 .test.mjs 파일을 지정해주세요.');this.submissions.verify(submissionId);
  return this.attempts.background('submission.user-test',sub.attemptId,async()=>{
   const id=uid('val'),root=path.join(this.store.dataRoot,'attempts',sub.attemptId,'validation',id),b=await this.attempts.runtime.resolvedBinary();fs.mkdirSync(root,{recursive:true});fs.cpSync(path.join(sub.root,'files'),root,{recursive:true});fs.symlinkSync(path.join(this.workspace.repoRoot,'node_modules'),path.join(root,'node_modules'),'dir');
   const run:any={id,attemptId:sub.attemptId,submissionId,checkId:'user:'+rel,checkVersion:file.sha256,status:'running',origin:'user_modified_test',startedAt:now(),endedAt:null,exitCode:null,evidenceIds:[],artifactHashBefore:sub.manifestHash,artifactHashAfter:null};this.store.insert('validation_runs',run,{id,attempt_id:sub.attemptId,submission_id:submissionId,check_id:run.checkId,check_version:run.checkVersion,state:'running',origin:run.origin,started_at:run.startedAt,hash_before:sub.manifestHash});
   const rpc=new CodexRpc(b,root,false,{'permissions.check.filesystem':{':minimal':'read',[root]:'write',[path.dirname(b)]:'read',[path.dirname(fs.realpathSync(process.execPath))]:'read',[path.join(this.workspace.repoRoot,'node_modules')]:'read'},'permissions.check.network':{enabled:false},default_permissions:'check'});
   try{await rpc.start();const result=await rpc.call('command/exec',{command:[fs.realpathSync(process.execPath),'--test',rel],cwd:root,permissionProfile:'check',env:{OPENSSL_CONF:'/dev/null',NODE_OPTIONS:null,NODE_EXTRA_CA_CERTS:null},timeoutMs:30000,outputBytesCap:1048576},35000);run.exitCode=result.exitCode;run.status=result.exitCode===0?'passed':'failed';run.detail='응시자가 작성·수정한 테스트 결과이며 고정 검사와 구분합니다.';run.evidenceIds=[this.evidence(sub.attemptId,submissionId,'command','system',{kind:'validation',validationRunId:id},JSON.stringify({origin:'user_modified_test',command:['node','--test',rel],...result})).id];}
   catch(e:any){run.status=/time.?out|timed out|deadline/i.test(e.message)?'timed_out':'error';run.detail=e.message;}finally{rpc.close();this.submissions.verify(submissionId);run.endedAt=now();run.artifactHashAfter=sub.manifestHash;this.store.update('validation_runs',id,run,{state:run.status,exit_code:run.exitCode,ended_at:run.endedAt,hash_after:sub.manifestHash,result_json:JSON.stringify(run)});this.store.event(sub.attemptId,'validation.completed',run);}return {validationRunId:id};
  });
 }
 async commandCheck(sub:any,run:any,check:any,root:string,scenario:any,signal:AbortSignal){
  signal.throwIfAborted();const argv=check.argv.map((v:string)=>v.replaceAll('${WORKSPACE}',root).replaceAll('${SCENARIO_DIR}',scenario.root).replaceAll('${NODE}',process.execPath));
  const rec=await this.workspace.launch(sub.attemptId,argv,root,{},'validation');
  try{while(!this.workspace.children.get(rec.id)?.exited){signal.throwIfAborted();await new Promise(r=>setTimeout(r,30));}const current=this.store.get('managed_processes',rec.id);const output=this.store.all('events',"attempt_id=? AND event_type='terminal.output' ORDER BY seq",[sub.attemptId]).filter(e=>e.payload.processId===rec.id).map(e=>e.payload.text).join('');const e=this.evidence(sub.attemptId,sub.id,'command','system',{kind:'validation',validationRunId:run.id},JSON.stringify({argv,exitCode:current.exitCode,output}));return {status:current.exitCode===0?'passed':'failed',evidenceIds:[e.id],detail:'고정 명령 실행 · 종료 코드 '+current.exitCode};}
  finally{await this.workspace.stop(rec.id);}
 }
 start(submissionId:string,checkIds?:string[]){
  const sub=this.submissions.get(submissionId);this.submissions.verify(submissionId);
  assert(!this.active.has(submissionId)&&!this.store.all('validation_runs',"submission_id=? AND state='running'",[submissionId]).length,409,'PROCESS_BUSY','검증이 실행 중입니다.');
  const scenario=this.scenarios.get(this.store.requireAttempt(sub.attemptId).scenarioVersionId),definition=this.scenarios.private(scenario.id,'validation.json'),available=checkDefinitions(definition);
  assert(!checkIds||Array.isArray(checkIds)&&checkIds.length>0&&new Set(checkIds).size===checkIds.length&&checkIds.every(id=>available.some((c:any)=>c.id===id)),400,'VALIDATION_ERROR','존재하는 검사 ID를 중복 없이 선택해주세요.');
  const checks=checkIds?available.filter((c:any)=>checkIds.includes(c.id)):available;
  this.active.add(submissionId);const batch=new AbortController();
  const job=this.attempts.background('submission.validate',sub.attemptId,async()=>{
   try{
    this.collect(sub);const ids:string[]=[];
    for(const check of checks){
     batch.signal.throwIfAborted();
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('검사 제한 시간 초과','TimeoutError')),check.timeoutSeconds*1000),signal=AbortSignal.any([batch.signal,controller.signal]);
     const id=uid('val');ids.push(id);
     const run:any={id,attemptId:sub.attemptId,submissionId,checkId:check.id,checkVersion:definition.version+':'+hash(JSON.stringify({check,runnerVersion:'0.1.1'})).slice(0,16),status:'running',origin:'fixed_check',startedAt:now(),endedAt:null,exitCode:null,evidenceIds:[],artifactHashBefore:sub.manifestHash,artifactHashAfter:null};
     this.store.insert('validation_runs',run,{id,attempt_id:run.attemptId,submission_id:submissionId,check_id:run.checkId,check_version:run.checkVersion,state:'running',origin:run.origin,started_at:run.startedAt,hash_before:sub.manifestHash});
     const root=path.join(this.store.dataRoot,'attempts',sub.attemptId,'validation',id);let preview:any;
     try{
      fs.mkdirSync(root,{recursive:true});fs.cpSync(path.join(sub.root,'files'),root,{recursive:true});fs.symlinkSync(path.join(this.workspace.repoRoot,'node_modules'),path.join(root,'node_modules'),'dir');
      if(this.store.consumeFault(sub.attemptId,'timeout'))throw Object.assign(new Error('개발 모드 검사 시간 초과 재현'),{name:'TimeoutError'});
      let screen:any={status:'passed',evidenceIds:[]},result:any;
      if(check.runner==='command')result=await this.commandCheck(sub,run,check,root,scenario,signal);
      else{preview=await this.workspace.startPreview(sub.attemptId,root,'validation:'+id,signal);screen=await this.browserFlow(sub.attemptId,run,preview.url,signal);result=check.runner==='browser-page'?screen:check.runner==='retail-flow'?await this.retailFlow(sub.attemptId,run,preview.url,signal):await this.bookingFlow(sub.attemptId,run,preview.url,check.runner==='booking-race',signal);}
      run.status=screen.status==='failed'?'failed':result.status;run.evidenceIds=[...new Set([...screen.evidenceIds,...result.evidenceIds])];run.detail=check.description+' · '+(screen.status==='failed'?'첫 화면 실행 실패 · ':'')+result.detail;run.exitCode=run.status==='passed'?0:run.status==='failed'?1:null;
     }catch(e:any){run.status=batch.signal.aborted?'cancelled':controller.signal.aborted||e.name==='TimeoutError'||/timed out|timeout/i.test(e.message)?'timed_out':'error';run.detail=e.message;run.evidenceIds.push(this.evidence(sub.attemptId,submissionId,'command','system',{kind:'validation',validationRunId:id},JSON.stringify({error:e.message,code:e.code})).id);}
     finally{
      clearTimeout(timer);
      try{if(preview?.process)await this.workspace.stop(preview.process.id);this.submissions.verify(submissionId);run.artifactHashAfter=sub.manifestHash;}catch(e:any){run.status='error';run.detail+=' · 정리/무결성 실패: '+e.message;}
      run.endedAt=now();this.store.update('validation_runs',id,run,{state:run.status,exit_code:run.exitCode,ended_at:run.endedAt,hash_after:run.artifactHashAfter,result_json:JSON.stringify(run)});this.store.event(sub.attemptId,'validation.completed',run);
     }
    }
    batch.signal.throwIfAborted();return {validationRunId:ids[0],validationRunIds:ids,resultRef:'/api/v1/submissions/'+submissionId+'/validations'};
   }finally{this.active.delete(submissionId);this.controllers.delete(job.operationId);}
  });
  this.controllers.set(job.operationId,batch);return job;
 }
}
