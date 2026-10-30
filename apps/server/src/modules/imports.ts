import Ajv2020 from 'ajv/dist/2020.js';
import {Store,uid,hash,now,assert,AppError} from '../core.ts';
export class Imports{
 constructor(public store:Store,public onChange:()=>void){}
 assertEditable(){assert(!this.store.all('attempts',"mode='exam' AND state NOT IN ('completed','abandoned')").length,409,'INVALID_STATE','시험 중에는 연결을 바꿀 수 없습니다.');}
 list(){return this.store.setting<any[]>('imports',[]);}
 add(input:any){this.assertEditable();assert(['skill','tool'].includes(input.kind)&&typeof input.content==='string'&&input.content.length>0&&input.content.length<=65536,400,'VALIDATION_ERROR','64KiB 이하의 스킬 또는 도구 정의를 사용해주세요.');let tool:any=null;
  if(input.kind==='tool'){try{tool=JSON.parse(input.content);}catch{throw new AppError(400,'VALIDATION_ERROR','도구 정의는 올바른 JSON이어야 합니다.');}assert(/^[a-z][a-z0-9_]{2,50}$/.test(tool.name)&&typeof tool.description==='string'&&Array.isArray(tool.command)&&tool.command.length>0&&tool.command.every((x:any)=>typeof x==='string')&&tool.inputSchema?.type==='object',400,'VALIDATION_ERROR','도구 이름·설명·명령 배열·입력 스키마를 확인해주세요.');new Ajv2020({strict:false}).compile(tool.inputSchema);}
  const record={id:uid('imp'),name:String(input.name||tool?.name||'사용자 스킬').slice(0,100),kind:input.kind,content:input.content,hash:hash(input.content),enabled:false,importedAt:now(),tool};const items=this.list();assert(!items.some(x=>x.hash===record.hash),409,'DUPLICATE_IMPORT','이미 가져온 내용입니다.');items.push(record);this.store.setSetting('imports',items);return record;
 }
 enable(id:string,enabled:boolean,consentHash:string){this.assertEditable();const items=this.list(),item=items.find(x=>x.id===id);assert(item,404,'NOT_FOUND','연결이 없습니다.');assert(!enabled||consentHash===item.hash,400,'CONSENT_REQUIRED','검토한 내용의 해시를 확인해주세요.');item.enabled=enabled;this.store.setSetting('imports',items);this.onChange();for(const a of this.store.all('attempts',"state NOT IN ('completed','abandoned')"))this.store.condition(a.id,'profile_changed',item.name+': '+(enabled?'활성화':'비활성화'));return item;}
 remove(id:string){this.assertEditable();this.store.setSetting('imports',this.list().filter(x=>x.id!==id));this.onChange();return {deleted:true};}
}
