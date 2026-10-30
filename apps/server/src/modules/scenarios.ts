import path from 'node:path';
import {checkDefinitions} from './check-definitions.ts';
import fs from 'node:fs';
import {Store,uid,now,hash,AppError,assert,cleanRelative} from '../core.ts';
export function validateAllowedModels(value:any){
 assert(value===undefined||value===null||(Array.isArray(value)&&value.length>0&&value.length<=100&&new Set(value).size===value.length&&value.every((id:any)=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(id))),422,'SCENARIO_INVALID','허용 모델을 하나 이상 선택하거나 제한 없음을 선택해주세요.');
}
export class Scenarios {
 constructor(public store:Store,public sourceRoot:string){}
 loadAll(){
  for(const name of fs.readdirSync(this.sourceRoot)){const root=path.join(this.sourceRoot,name);if(fs.existsSync(path.join(root,'manifest.json')))this.register(root);}
 }
 packageFiles(root:string):string[]{
  const out:string[]=[];const walk=(d:string)=>{for(const entry of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,entry.name);if(entry.isSymbolicLink())throw new AppError(422,'SCENARIO_INVALID','과제에 심볼릭 링크를 사용할 수 없습니다.');if(entry.isDirectory())walk(p);else if(entry.isFile())out.push(path.relative(root,p).split(path.sep).join('/'));else throw new AppError(422,'SCENARIO_INVALID','지원하지 않는 과제 파일입니다.');}};walk(root);return out.sort();
 }
 register(root:string,dryRun=false){
  const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  validateAllowedModels(m.allowedModels);
  assert(/^[a-z][a-z0-9-]{2,63}$/.test(m.scenarioId)&&/^\d+\.\d+\.\d+$/.test(m.version),422,'SCENARIO_INVALID','과제 ID와 버전을 확인해주세요.');
  assert(Number.isInteger(m.durationSeconds)&&m.durationSeconds>=60&&m.durationSeconds<=86400,422,'SCENARIO_INVALID','시간 설정이 잘못됐습니다.');
  for(const rel of [m.publicBrief,m.starterDir,...m.resources.map((x:any)=>x.path)]){cleanRelative(rel);assert(rel.startsWith('public/'),422,'SCENARIO_INVALID','공개 자료 경로가 잘못됐습니다.');assert(fs.existsSync(path.join(root,rel)),422,'SCENARIO_INVALID','과제 자료가 없습니다.');}
  assert(Array.isArray(m.resources)&&m.resources.every((r:any)=>/^[a-z][a-z0-9-]*$/.test(r.id)&&r.id!=='brief')&&new Set(m.resources.map((r:any)=>r.id)).size===m.resources.length,422,'SCENARIO_INVALID','공개 자료 ID가 중복되거나 잘못됐습니다.');
  assert(Array.isArray(m.prepare)&&m.run&&[...m.prepare,m.run].every((c:any)=>Array.isArray(c.argv)&&c.argv.length&&c.argv.every((x:any)=>typeof x==='string')&&Number.isInteger(c.timeoutSeconds)&&c.timeoutSeconds>0&&c.timeoutSeconds<=600),422,'SCENARIO_INVALID','실행 명령과 제한 시간을 확인해주세요.');
  const files=this.packageFiles(root);
  const digest=hash(files.map(p=>p+'\0'+hash(fs.readFileSync(path.join(root,p)))).join('\n'));
  const old=this.store.all('scenario_versions','scenario_id=? AND version=?',[m.scenarioId,m.version])[0];
  if(old){assert(old.digest===digest,422,'SCENARIO_VERSION_CHANGED','같은 과제 버전의 내용이 변경됐습니다. 버전을 올려주세요.');return old;}
  checkDefinitions(JSON.parse(fs.readFileSync(path.join(root,'private/validation.json'),'utf8')));
  const privateData=JSON.parse(fs.readFileSync(path.join(root,'private/stakeholder.json'),'utf8'));
  const rubric=JSON.parse(fs.readFileSync(path.join(root,'private/rubric.json'),'utf8'));
  assert(rubric.criteria.length===12&&new Set(rubric.criteria.map((c:any)=>c.id)).size===12,422,'SCENARIO_INVALID','평가기준은 서로 다른 12개가 필요합니다.');
  assert(new Set(privateData.facts.map((f:any)=>f.id)).size===privateData.facts.length,422,'SCENARIO_INVALID','사실 ID가 중복됩니다.');
  assert(['technology','intent','cognition'].every(axis=>rubric.criteria.filter((c:any)=>c.axis===axis).length===4),422,'SCENARIO_INVALID','평가 축마다 4개 항목이 필요합니다.');
  assert(privateData.facts.every((f:any)=>typeof f.statement==='string'&&f.topicIds.every((id:string)=>privateData.topics.some((t:any)=>t.id===id))),422,'SCENARIO_INVALID','사실의 주제 참조가 잘못됐습니다.');
  if(dryRun)return {...m,id:'scv_preview',digest,root,createdAt:now()};
  const id=uid('scv'),ownedRoot=path.join(this.store.dataRoot,'scenario-versions',id);
  fs.mkdirSync(path.dirname(ownedRoot),{recursive:true});fs.cpSync(root,ownedRoot,{recursive:true,dereference:false});
  const record={...m,id,digest,root:ownedRoot,createdAt:now()};
  this.store.insert('scenario_versions',record,{id,scenario_id:m.scenarioId,version:m.version,package_digest:digest,public_json:JSON.stringify(this.publicDto(record)),private_root:path.join(ownedRoot,'private'),created_at:record.createdAt});
  return record;
 }
 publicDto(s:any){return {versionId:s.id,scenarioId:s.scenarioId,version:s.version,title:s.title,summary:s.summary,allowedModels:s.allowedModels??null,durationSeconds:s.durationSeconds,briefResourceId:'brief',resources:[{id:'brief',title:'업무 요청',mediaType:'text/markdown'},...s.resources.map((r:any)=>({id:r.id,title:r.title,mediaType:r.mediaType}))],ready:true};}
 list(){return this.store.all('scenario_versions','1=1 ORDER BY created_at DESC').map(s=>this.publicDto(s));}
 get(id:string){const s=this.store.get('scenario_versions',id);if(!s)throw new AppError(404,'NOT_FOUND','과제가 없습니다.');return s;}
 resource(id:string,resourceId:string){const s=this.get(id);const r=resourceId==='brief'?{path:s.publicBrief,mediaType:'text/markdown'}:s.resources.find((r:any)=>r.id===resourceId);assert(r,404,'NOT_FOUND','자료가 없습니다.');const p=path.join(s.root,cleanRelative(r.path));assert(p.startsWith(path.join(s.root,'public')+path.sep),403,'ROLE_SCOPE_DENIED','공개 자료가 아닙니다.');return {resourceId,mediaType:r.mediaType,content:fs.readFileSync(p,'utf8')};}
 private(id:string,file:string){assert(['stakeholder.json','rubric.json','validation.json'].includes(file),404,'NOT_FOUND','자료가 없습니다.');return JSON.parse(fs.readFileSync(path.join(this.get(id).root,'private',file),'utf8'));}
 authoring(id:string){const s=this.get(id);return {allowedModels:s.allowedModels??null,version:s.version,title:s.title,summary:s.summary,brief:this.resource(id,'brief').content,resources:s.resources.map((r:any)=>({id:r.id,title:r.title,content:this.resource(id,r.id).content})),stakeholder:this.private(id,'stakeholder.json'),rubric:this.private(id,'rubric.json'),validation:this.private(id,'validation.json')};}
 author(baseId:string,input:any,dryRun=false){
  validateAllowedModels(input.allowedModels);
  const base=this.get(baseId);assert(/^\d+\.\d+\.\d+$/.test(input.version),400,'VALIDATION_ERROR','새 버전이 필요합니다.');
  const temp=path.join(this.store.dataRoot,'authoring',uid('scv'));fs.mkdirSync(path.dirname(temp),{recursive:true});fs.cpSync(base.root,temp,{recursive:true});
  try{const m=JSON.parse(fs.readFileSync(path.join(temp,'manifest.json'),'utf8'));Object.assign(m,{version:input.version,title:input.title||m.title,summary:input.summary||m.summary,...(input.allowedModels!==undefined?{allowedModels:input.allowedModels}:{})});
  fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(m,null,2));
  if(input.resources){assert(Array.isArray(input.resources),400,'VALIDATION_ERROR','공개 자료 목록이 필요합니다.');m.resources=input.resources.map((r:any)=>{assert(/^[a-z][a-z0-9-]*$/.test(r.id)&&typeof r.content==='string'&&r.content.length<=100000,400,'VALIDATION_ERROR','공개 자료 형식을 확인해주세요.');const rel='public/resources/'+r.id+'.md';fs.writeFileSync(path.join(temp,rel),r.content);return {id:r.id,title:r.title,path:rel,mediaType:'text/markdown'};});fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(m,null,2));}
  if(typeof input.brief==='string')fs.writeFileSync(path.join(temp,m.publicBrief),input.brief);
  for(const [key,file] of [['stakeholder','stakeholder.json'],['rubric','rubric.json'],['validation','validation.json']])if(input[key])fs.writeFileSync(path.join(temp,'private',file),JSON.stringify(input[key],null,2));
  return this.publicDto(this.register(temp,dryRun));}finally{fs.rmSync(temp,{recursive:true,force:true});}
 }
}
