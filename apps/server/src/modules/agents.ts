import fs from 'node:fs';
import path from 'node:path';
import {Store,uid,now,hash,AppError,assert} from '../core.ts';
import {Scenarios} from './scenarios.ts';
import {Runtime,finalJson} from './runtime.ts';
import {Workspace} from './workspace.ts';
const object=(properties:any)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export class Agents{
 constructor(public store:Store,public scenarios:Scenarios,public runtime:Runtime,public workspace:Workspace,public baseUrl:()=>string){
  workspace.appEnv=async(id,purpose='live')=>{
   const env:Record<string,string>={WPL_SCENARIO_AI_URL:this.baseUrl()+'/api/v1/scenario-ai',WPL_SCENARIO_AI_TOKEN:this.issueAppToken(id,purpose)};
   const a=store.requireAttempt(id);if(scenarios.get(a.scenarioVersionId).scenarioId==='equipment-booking')env.WPL_DATABASE_URL=await workspace.postgres(purpose.startsWith('validation:')?'validation'+hash(purpose).slice(0,24):id);
   return env;
  };
 }
 message(id:string,role:string,author:string,content:string,sourceIds:string[]=[],operationId:string|null=null){
  const m={id:uid('msg'),attemptId:id,role,author,content:this.store.redact(content),status:author==='user'?'completed':'queued',sourceMessageIds:sourceIds,operationId,createdAt:now()};
  this.store.insert('messages',m,{id:m.id,attempt_id:id,session_id:null,role,author,content:m.content,state:m.status,source_ids_json:JSON.stringify(sourceIds),operation_id:operationId,created_at:m.createdAt,updated_at:m.createdAt});
  this.store.event(id,'message.accepted',m,author==='user'?'user':role,'public',operationId);return m;
 }
 finish(m:any,text:string,status='completed'){
  m.content=this.store.redact(text);m.status=status;this.store.update('messages',m.id,m,{content:m.content,state:status,updated_at:now()});this.store.event(m.attemptId,'message.completed',m,m.role);
 }
 history(id:string,role:string){return this.store.all('messages','attempt_id=? AND role=? ORDER BY created_at',[id,role]);}
 send(id:string,role:string,text:string,sources:string[]=[]){
  this.workspace.assertMutable(id);assert(['stakeholder','coder'].includes(role),400,'VALIDATION_ERROR','지원하지 않는 대화 상대입니다.');assert(text.trim()&&text.length<=65536,400,'VALIDATION_ERROR','메시지 내용을 확인해주세요.');
  for(const source of sources){const m=this.store.get('messages',source);assert(m?.attemptId===id&&m.role==='stakeholder'&&m.status==='completed',403,'ROLE_SCOPE_DENIED','공개된 같은 시도의 답변만 공유할 수 있습니다.');}
  const a=this.store.requireAttempt(id),s=this.scenarios.get(a.scenarioVersionId);const user=this.message(id,role,'user',text,sources),reply=this.message(id,role,'assistant','');
  const job=this.runtime.enqueue(role+'.reply',id,role,async op=>{
   try{
    reply.status='streaming';this.store.update('messages',reply.id,reply,{state:'streaming',updated_at:now()});this.store.event(id,'message.delta',{messageId:reply.id,offset:0,text:''},role,'public',op.id);
    let result:string;
    if(role==='stakeholder')result=await this.stakeholder(a,s,text,op);
    else if(a.executionMode==='replay')result='재생 모드입니다. 실제 Codex 파일 수정은 실행하지 않았습니다. 편집기·터미널을 직접 사용하거나 새 라이브 시도를 시작해주세요.';
    else{
     const shared=sources.map(x=>{const m=this.store.get('messages',x);return {messageId:x,content:m.content};});
     const notes=this.store.all('notes','attempt_id=?',[id]).map(n=>({author:n.author,content:n.content}));
     const skills=this.store.setting<any[]>('imports',[]).filter(x=>x.enabled&&x.kind==='skill').map(x=>({name:x.name,content:x.content,hash:x.hash}));
     const prompt=JSON.stringify({task:this.scenarios.resource(s.id,'brief').content,publicResources:s.resources.map((r:any)=>({id:r.id,title:r.title})),workspace:a.workspaceRoot,sharedMessages:shared,history:this.history(id,'coder').filter(m=>m.status==='completed').slice(-20).map(m=>({author:m.author,content:m.content})),notes,enabledUserSkills:skills,userRequest:text});
     result=await this.runtime.raw(id,'coder',prompt,null,op,delta=>{const offset=reply.content.length;reply.content+=delta;reply.status='streaming';this.store.update('messages',reply.id,reply,{content:this.store.redact(reply.content),state:'streaming',updated_at:now()});this.store.event(id,'message.delta',{messageId:reply.id,offset,text:delta},'coder','public',op.id);});
    }
    this.finish(reply,result);return {messageId:reply.id,resultRef:'/api/v1/attempts/'+id+'/messages?role='+role};
   }catch(e:any){this.finish(reply,reply.content||e.message,e.code==='INTERRUPTED'?'interrupted':e.code==='RUNTIME_UNCERTAIN'?'uncertain':'failed');throw e;}
  });
  user.operationId=job.operationId;reply.operationId=job.operationId;this.store.update('messages',user.id,user,{operation_id:job.operationId});this.store.update('messages',reply.id,reply,{operation_id:job.operationId});
  return {operationId:job.operationId};
 }
 async stakeholder(a:any,s:any,question:string,op:any){
  const bundle=this.scenarios.private(s.id,'stakeholder.json');
  const disclosed=this.store.all('fact_disclosures','attempt_id=?',[a.id]).map(x=>x.factId);
  const history=this.history(a.id,'stakeholder').filter(m=>m.status==='completed').slice(-20).map(m=>({author:m.author,content:m.content}));
  let chosen:string[];
  const keys:Record<string,string[]>={problem:['문제','어려','중요','먼저','사례'],goal:['목표','성공','기준'],coaching:['피드백','교육','코칭'],context:['언제','환경','휴대','기기','음성'],scope:['기능','범위','알림','반복','제외'],scoring:['점수','순위','평가'],truth:['자료','성능','정책','추측'],equipment:['장비','개별','종류'],time:['시간','단위','최대','분'],boundary:['끝','맞닿','정리'],approval:['승인','확정'],cancel:['취소','본인','타인']};
  const matches=bundle.topics.filter((t:any)=>(keys[t.id]||[]).some(k=>question.includes(k))).map((t:any)=>t.id);
  if(a.executionMode==='replay'||matches.length>0&&matches.length<=3)chosen=matches.slice(0,3);
  else{
    const routerSchema=object({topicIds:{type:'array',items:{type:'string',enum:bundle.topics.map((t:any)=>t.id)},maxItems:3}});
    try{const routed=finalJson(await this.runtime.raw(a.id,'stakeholder',JSON.stringify({purpose:'Select at most 3 relevant work topics only. Do not answer yet. Prefer the concrete topics explicitly asked. Topic descriptions are private routing metadata.',topics:bundle.topics.map((t:any)=>({id:t.id,label:t.label,description:t.description})),question,history}),routerSchema,op));chosen=routed.topicIds||[];}
    finally{const router=this.runtime.sessions.get(a.id+':stakeholder');router?.rpc.close();this.runtime.sessions.delete(a.id+':stakeholder');}
  }
  const selected=bundle.facts.filter((f:any)=>f.topicIds.some((t:string)=>chosen.includes(t)));
  const prior=bundle.facts.filter((f:any)=>disclosed.includes(f.id));
  const allowed=[...new Map([...prior,...selected].map((f:any)=>[f.id,f])).values()];
  let answer:any;
  if(a.executionMode==='replay')answer={answer:selected.length?'[재생] '+selected.map((f:any)=>f.statement).join('\n\n'):'[재생] 현재 업무 방식이나 어려운 상황부터 물어봐 주세요. 필요한 범위를 설명해드릴게요.',usedFactIds:selected.map((f:any)=>f.id),newlyDisclosedFactIds:selected.map((f:any)=>f.id).filter((x:string)=>!disclosed.includes(x)),needsClarification:selected.length===0};
  else{
    const schema=object({answer:{type:'string'},usedFactIds:{type:'array',items:{type:'string'}},newlyDisclosedFactIds:{type:'array',items:{type:'string'}},needsClarification:{type:'boolean'}});
    const prompt=JSON.stringify({purpose:'Reply as the business stakeholder in Korean. Answer only relevant supplied facts. Do not give implementation plans or a rubric. Unknown details must remain unknown.',persona:bundle.persona,facts:allowed,previouslyDisclosedFactIds:disclosed,question,history});
    answer=finalJson(await this.runtime.raw(a.id,'stakeholder',prompt,schema,op));
    if([...answer.usedFactIds,...answer.newlyDisclosedFactIds].some((x:string)=>!allowed.some((f:any)=>f.id===x)))answer=finalJson(await this.runtime.raw(a.id,'stakeholder',prompt+'\nYour previous answer used invalid fact IDs. Use only listed IDs.',schema,op));
    assert([...answer.usedFactIds,...answer.newlyDisclosedFactIds].every((x:string)=>allowed.some((f:any)=>f.id===x)),502,'MODEL_FORMAT_ERROR','담당자 답변의 근거를 확인하지 못했습니다.');
  }
  const target=this.history(a.id,'stakeholder').filter(m=>m.author==='assistant').at(-1);
  this.store.txn(()=>{
    for(const factId of answer.newlyDisclosedFactIds){if(!disclosed.includes(factId)){const record={attemptId:a.id,factId,messageId:target.id,firstDisclosedAt:now()};this.store.insert('fact_disclosures',record,{attempt_id:a.id,fact_id:factId,message_id:target.id,first_disclosed_at:record.firstDisclosedAt});disclosed.push(factId);}}
    this.store.event(a.id,'fact.disclosed',{messageId:target.id,factIds:answer.newlyDisclosedFactIds},'stakeholder','developer',op.id);
  });
  return answer.answer;
 }
 share(id:string,messageId:string,comment=''){const m=this.store.get('messages',messageId);assert(m?.attemptId===id&&m.role==='stakeholder'&&m.author==='assistant'&&m.status==='completed',403,'ROLE_SCOPE_DENIED','공개된 담당자 답변만 공유할 수 있습니다.');return this.send(id,'coder',(comment?comment+'\n\n':'')+'담당자 답변:\n'+m.content,[messageId]);}
 note(id:string,noteId:string,input:any){
  this.workspace.assertMutable(id);const previous=this.store.get('notes',noteId);assert(!previous||previous.attemptId===id,403,'ROLE_SCOPE_DENIED','다른 시도의 메모입니다.');assert(!previous||previous.version===input.version,409,'VERSION_CONFLICT','메모가 변경됐습니다.');
  for(const source of input.sourceMessageIds){const m=this.store.get('messages',source);assert(m?.attemptId===id,403,'ROLE_SCOPE_DENIED','다른 시도의 메시지입니다.');}
  const record={id:noteId,attemptId:id,content:input.content,author:previous?.author==='ai_summary'?'user_edited':'user',sourceMessageIds:input.sourceMessageIds,version:(previous?.version||0)+1,updatedAt:now()};
  const cols={attempt_id:id,content:record.content,author:record.author,source_ids_json:JSON.stringify(record.sourceMessageIds),version:record.version,updated_at:record.updatedAt};if(previous)this.store.update('notes',noteId,record,cols);else this.store.insert('notes',record,{id:noteId,...cols});
  this.store.event(id,'note.saved',{noteId,author:record.author,version:record.version,content:record.content,sourceMessageIds:record.sourceMessageIds},'user');return record;
 }
 issueAppToken(id:string,purpose='live'){
  const token=uid('token')+uid('token'),a=this.store.requireAttempt(id),s=this.scenarios.get(a.scenarioVersionId),validationId=purpose.startsWith('validation:')?purpose.split(':')[1]:null;
  this.store.secrets.add(token);
  this.store.db.prepare('INSERT INTO scoped_tokens(token_hash,attempt_id,purpose,validation_run_id,scope_json,generation,expires_at,data_json) VALUES (?,?,?,?,?,?,?,?)').run(hash(token),id,validationId?'validation':'live',validationId,JSON.stringify(s.resources.map((r:any)=>r.id)),1,new Date(Date.now()+86400000).toISOString(),JSON.stringify({attemptId:id,validationRunId:validationId}));
  return token;
 }
 checkToken(token:string){
  const t=this.store.db.prepare('SELECT * FROM scoped_tokens WHERE token_hash=?').get(hash(token)) as any;
  assert(t&&!t.revoked_at&&Date.parse(t.expires_at)>Date.now(),401,'AUTH_REQUIRED','과제 앱 연결이 만료됐습니다.');const a=this.store.requireAttempt(t.attempt_id);
  if(t.purpose==='live')assert(a.state==='running',409,'INVALID_STATE','연습 수행 중에만 AI를 사용할 수 있습니다.');
  else{const run=this.store.get('validation_runs',t.validation_run_id);assert(run?.status==='running',409,'INVALID_STATE','해당 검증 실행이 끝났습니다.');}
  return {...t,attempt:a};
 }
 appRequest(token:string,input:any){
  const scope=this.checkToken(token);assert(!this.runtime.active,409,'RUNTIME_BUSY','코딩 도우미 작업이 끝난 뒤 다시 시도해주세요.');
  const allowed=JSON.parse(scope.scope_json);assert(input.resourceIds.every((x:string)=>allowed.includes(x)),403,'ROLE_SCOPE_DENIED','공개된 자료만 사용할 수 있습니다.');assert(JSON.stringify(input.messages).length<=65536,413,'PAYLOAD_TOO_LARGE','대화가 너무 깁니다.');
  const key='rate:'+hash(token),times=this.store.setting<number[]>(key,[]).filter(t=>t>Date.now()-60000);assert(times.length<10,429,'LOCAL_QUEUE_FULL','분당 요청 제한에 도달했습니다.');times.push(Date.now());this.store.setSetting(key,times);
  const a=scope.attempt,s=this.scenarios.get(a.scenarioVersionId);
  const job=this.runtime.enqueue('scenario.inference',a.id,'scenario_app',async op=>{
   if(a.executionMode==='replay')return {output:'[재생] 실제 AI 호출을 수행하지 않았습니다.',outputJson:null};
   const old=this.runtime.sessions.get(a.id+':scenario_app');if(old){old.rpc.close();this.runtime.sessions.delete(a.id+':scenario_app');}
   const result=await this.runtime.raw(a.id,'scenario_app',JSON.stringify({purpose:'Respond for this practice application. Use only provided public resources. Clearly identify unsupported domain facts.',resources:input.resourceIds.map((x:string)=>this.scenarios.resource(s.id,x)),conversation:input.messages}),input.outputSchema||null,op);
   return {output:result,outputJson:input.outputSchema?finalJson(result):null};
  });this.store.setSetting('appOperation:'+job.operationId,hash(token));return {operationId:job.operationId};
 }
 appResult(token:string,id:string){this.checkToken(token);assert(this.store.setting('appOperation:'+id,null)===hash(token),403,'ROLE_SCOPE_DENIED','이 앱의 요청이 아닙니다.');const o=this.store.get('operations',id);assert(o,404,'NOT_FOUND','작업이 없습니다.');return {operation:o,output:o.result?.output??null,outputJson:o.result?.outputJson??null};}
 revoke(id:string){this.store.db.prepare('UPDATE scoped_tokens SET revoked_at=? WHERE attempt_id=? AND purpose=?').run(now(),id,'live');}
}
