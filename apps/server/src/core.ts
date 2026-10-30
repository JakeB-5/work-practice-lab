import {DatabaseSync} from 'node:sqlite';
import {EventEmitter} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,openSync,fsyncSync,closeSync} from 'node:fs';
import path from 'node:path';

export const now=()=>new Date().toISOString();
export const uid=(prefix:string)=>prefix+'_'+randomUUID();
export const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
export const parse=<T=any>(s:any,fallback:any=null):T=>{try{return typeof s==='string'?JSON.parse(s):s??fallback;}catch{return fallback;}};
export class AppError extends Error {
 constructor(public status:number, public code:string, message:string, public retryable=false, public details?:any){super(message);}
}
export function assert(condition:any,status:number,code:string,message:string):asserts condition {if(!condition)throw new AppError(status,code,message);}
export function cleanRelative(input:string,allowDot=false){
 if(typeof input!=='string'||input.includes('\0')||input.includes('\\')||path.isAbsolute(input))throw new AppError(400,'INVALID_PATH','상대 경로를 사용해주세요.');
 const parts=input.split('/');
 if(parts.includes('..')||(!allowDot&&(!input||input==='.'||input.endsWith('/'))))throw new AppError(400,'INVALID_PATH','허용되지 않는 경로입니다.');
 return path.posix.normalize(input||'.');
}
export class Store extends EventEmitter {
 db:DatabaseSync;dataRoot:string;depth=0;afterCommit:(()=>void)[]=[];secrets=new Set<string>();
 constructor(root:string, schemaPath:string){
  super();this.dataRoot=path.resolve(root);mkdirSync(this.dataRoot,{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path.join(this.dataRoot,'state.sqlite'));this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const has=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attempts'").get();
  if(!has)this.db.exec(readFileSync(schemaPath,'utf8'));
  const tables=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  for(const {name} of tables){if(['app_settings','runtime_tokens','schema_migrations'].includes(name))continue;
    const cols=this.db.prepare('PRAGMA table_info('+name+')').all() as any[];
    if(!cols.some(c=>c.name==='data_json'))this.db.exec('ALTER TABLE '+name+' ADD COLUMN data_json TEXT');
  }
  this.db.exec("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS runtime_tokens (token_hash TEXT PRIMARY KEY, purpose TEXT NOT NULL, scope_json TEXT NOT NULL, expires_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
  this.db.prepare('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES (?,?)').run(1,now());
 }
 txn<T>(fn:()=>T):T {
  if(this.depth)return fn();this.depth++;this.db.exec('BEGIN IMMEDIATE');
  let value:T;try{value=fn();this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');this.depth--;this.afterCommit=[];throw e;}
  this.depth--;const callbacks=this.afterCommit.splice(0);for(const callback of callbacks){try{callback();}catch{ /* A committed outbox row is replayed after reconnect. */ }}return value;
 }
 setting<T=any>(key:string,fallback:T):T{return parse(this.db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(key)?.value_json,fallback);}
 consumeFault(attemptId:string,kind:string){if(this.setting('fault:'+attemptId,null)!==kind)return false;this.setSetting('fault:'+attemptId,null);return true;}
 setSetting(key:string,value:any){this.db.prepare('INSERT INTO app_settings(key,value_json) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json').run(key,JSON.stringify(value));}
 tableName(table:string){if(!/^[a-z_]+$/.test(table))throw new Error('Invalid table');return table;}
 get<T=any>(table:string,id:string):T|undefined {const row=this.db.prepare('SELECT data_json FROM '+this.tableName(table)+' WHERE id=?').get(id) as any;return row?parse<T>(row.data_json):undefined;}
 all<T=any>(table:string,where='1=1',params:any[]=[]):T[]{return (this.db.prepare('SELECT data_json FROM '+this.tableName(table)+' WHERE '+where).all(...params) as any[]).map(r=>parse<T>(r.data_json)).filter(Boolean);}
 insert(table:string,data:any,columns:Record<string,any>){
  const values={...columns,data_json:JSON.stringify(data)};const keys=Object.keys(values);
  this.db.prepare('INSERT INTO '+this.tableName(table)+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...Object.values(values));
  return data;
 }
 update(table:string,id:string,data:any,columns:Record<string,any>={}){
  const values={...columns,data_json:JSON.stringify(data)};const keys=Object.keys(values);
  this.db.prepare('UPDATE '+this.tableName(table)+' SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...Object.values(values),id);return data;
 }
 redact(value:any){
  let s=typeof value==='string'?value:JSON.stringify(value);
  for(const secret of this.secrets)if(secret.length>=12)s=s.split(secret).join('[REDACTED]');
  s=s.replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g,'[REDACTED_KEY]').replace(/(Bearer\s+)[A-Za-z0-9._~-]{20,}/gi,'$1[REDACTED]');
  return typeof value==='string'?s:parse(s,{redacted:true});
 }
 event(attemptId:string,type:string,payload:any,actor='system',audience='public',operationId:string|null=null,providerIdentity:string|null=null):any {
  return this.txn(()=>{
    if(providerIdentity){const found=this.db.prepare('SELECT data_json FROM events WHERE attempt_id=? AND provider_identity=?').get(attemptId,providerIdentity) as any;if(found)return parse(found.data_json);}
    const result=this.db.prepare('UPDATE attempts SET next_event_seq=next_event_seq+1 WHERE id=? RETURNING next_event_seq-1 AS seq').get(attemptId) as any;
    if(!result)throw new AppError(404,'NOT_FOUND','시도가 없습니다.');
    const event={schemaVersion:'0.1.0',id:uid('evt'),attemptId,seq:result.seq,type,actor,audience,occurredAt:now(),operationId,causationId:null,payload:this.redact(payload)};
    this.insert('events',event,{id:event.id,attempt_id:attemptId,seq:event.seq,event_type:type,actor,audience,operation_id:operationId,causation_id:null,payload_json:JSON.stringify(event.payload),provider_identity:providerIdentity,occurred_at:event.occurredAt});
    this.db.prepare('INSERT INTO outbox(event_id,created_at) VALUES (?,?)').run(event.id,event.occurredAt);
    this.afterCommit.push(()=>{this.emit('event',event);this.db.prepare('UPDATE outbox SET delivered_at=? WHERE event_id=?').run(now(),event.id);});
    return event;
  });
 }
 events(attemptId:string,after=0,developer=false){return this.all('events','attempt_id=? AND seq>?'+(developer?'':" AND audience='public'")+' ORDER BY seq LIMIT 2000',[attemptId,after]);}
 operation(kind:string,attemptId:string|null,role:string|null=null,requestKey=randomUUID()){
  const op={id:uid('op'),attemptId,kind,role,status:'queued',createdAt:now(),updatedAt:now(),resultRef:null,error:null};
  this.insert('operations',op,{id:op.id,attempt_id:attemptId,kind,role,state:op.status,request_key:requestKey,request_body_hash:hash(requestKey),created_at:op.createdAt,updated_at:op.updatedAt});
  return op;
 }
 setOperation(id:string,patch:any){
  const op=this.get('operations',id);if(!op)throw new AppError(404,'NOT_FOUND','작업이 없습니다.');
  Object.assign(op,patch,{updatedAt:now()});
  this.update('operations',id,op,{state:op.status,result_ref:op.resultRef??null,error_json:op.error?JSON.stringify(op.error):null,updated_at:op.updatedAt,provider_thread_id:op.providerThreadId??null,provider_turn_id:op.providerTurnId??null});
  if(op.attemptId){const final=['succeeded','failed','interrupted','uncertain'].includes(op.status);const {providerThreadId,providerTurnId,...publicOp}=op;this.event(op.attemptId,final?'operation.'+op.status:'operation.progress',final?publicOp:{operationId:id,status:op.status,summary:op.summary||''},'system','public',id);}
  return op;
 }
 failOperation(id:string,error:any){return this.setOperation(id,{status:'failed',error:{code:error.code||'OPERATION_FAILED',message:error.message||String(error),retryable:!!error.retryable,requestId:id}});}
 requireAttempt(id:string){const a=this.get('attempts',id);if(!a)throw new AppError(404,'NOT_FOUND','시도가 없습니다.');return a;}
 saveAttempt(a:any,expectedVersion?:number){
  const columns={state:a.state,version:a.version,duration_seconds:a.durationSeconds,started_at:a.startedAt,deadline_at:a.deadlineAt,paused_at:a.pausedAt,paused_total_ms:a.pausedTotalMs,condition_json:JSON.stringify(a.conditions),updated_at:now(),data_json:JSON.stringify(a)};
  const keys=Object.keys(columns);const args:any[]=[...Object.values(columns),a.id];
  const where=expectedVersion!==undefined?' AND version=?':'';
  if(expectedVersion!==undefined)args.push(expectedVersion);
  const change=this.db.prepare('UPDATE attempts SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?'+where).run(...args);
  if(!change.changes)throw new AppError(409,'VERSION_CONFLICT','다른 작업에서 상태가 바뀌었습니다.');
  return a;
 }
 transition(id:string,allowed:string[],next:string,patch:any={}){
  return this.txn(()=>{const a=this.requireAttempt(id);assert(allowed.includes(a.state),409,'INVALID_STATE','현재 단계에서는 진행할 수 없습니다.');const previous=a.state,v=a.version;Object.assign(a,patch,{state:next,version:v+1});this.saveAttempt(a,v);this.event(id,'attempt.state',{from:previous,to:next,version:a.version});return a;});
 }
 condition(id:string,code:string,note:string){
  return this.txn(()=>{const a=this.requireAttempt(id);const c={code,note,occurredAt:now()};a.conditions.push(c);a.version++;this.saveAttempt(a);this.event(id,'attempt.condition',c);return a;});
 }
 atomicFile(file:string,bytes:string|Buffer){mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp-'+randomUUID();const fd=openSync(temp,'w',0o600);try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,file);const dir=openSync(path.dirname(file),'r');try{fsyncSync(dir);}finally{closeSync(dir);}}
 close(){this.db.close();}
}
