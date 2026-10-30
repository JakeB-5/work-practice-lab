import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './api';
const read=(key:string,fallback:any)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
export function usePreference<T>(id:string,name:string,initial:T):[T,(v:T)=>void]{
 const key='wpl:preference:'+id+':'+name,[value,setValue]=useState<T>(()=>read(key,initial));
 return [value,(v:T)=>{setValue(v);try{localStorage.setItem(key,JSON.stringify(v));}catch{}}];
}
// The server hash remains the save precondition, including after draft recovery.
export function useFileDraft(id:string,mutable:boolean,setDirty:(n:number)=>void,setLastSaved:(s:string)=>void,changeEvent?:any){
 const prefix='wpl:file-drafts:'+id,key='wpl:last-file:'+id;
 const drafts=useRef<Record<string,{base:any;content:string;blocked?:boolean}>>(read(prefix,{}));
 const [file,setFile]=useState<any>(null),[draft,setDraft]=useState(''),[conflict,setConflict]=useState<any>(null),[saveState,setSaveState]=useState('파일을 선택하세요'),[blocked,setBlocked]=useState(false),[saving,setSaving]=useState(false);
 const latest=useRef({file,draft,conflict,mutable});latest.current={file,draft,conflict,mutable};
 const alive=useRef(true),inFlight=useRef(false);
 const persist=useCallback(()=>{try{localStorage.setItem(prefix,JSON.stringify(drafts.current));}catch{setSaveState('초안 보관 실패 · 브라우저 저장 공간을 확인해주세요');}setDirty(Object.keys(drafts.current).length);},[prefix,setDirty]);
 const openFile=useCallback(async(p:string)=>{
  const fresh=await api('/attempts/'+id+'/file?path='+encodeURIComponent(p));if(!alive.current)return;
  let cached=drafts.current[p];if(cached?.content===fresh.content){delete drafts.current[p];cached=undefined as any;persist();}setFile(cached?.base||fresh);setDraft(cached?.content??fresh.content);
  const changed=cached&&cached.base.sha256!==fresh.sha256;setConflict(changed?fresh:null);setBlocked(!!changed||!!cached?.blocked);
  setSaveState(changed?'충돌 · 복구한 초안을 비교해주세요':cached?cached.blocked?'초안 복구됨 · 저장을 눌러 재시도':'초안 복구됨 · 저장 대기':'✓ 저장됨');
  try{localStorage.setItem(key,p);}catch{}
 },[id,key,persist]);
 useEffect(()=>{alive.current=true;setDirty(Object.keys(drafts.current).length);const p=localStorage.getItem(key);if(p)openFile(p).catch(e=>setSaveState(e.message));return()=>{alive.current=false;};},[key,openFile,setDirty]);
 useEffect(()=>{if(!file)return;if(draft!==file.content)drafts.current[file.path]={base:file,content:draft,blocked};else delete drafts.current[file.path];persist();},[file,draft,blocked,persist]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(Object.keys(drafts.current).length){e.preventDefault();e.returnValue='저장하지 않은 변경 내용이 있습니다.';}};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[]);
 useEffect(()=>{
  const current=latest.current;if(!changeEvent||!current.file||changeEvent.payload?.path!==current.file.path||inFlight.current)return;let cancelled=false;
  api('/attempts/'+id+'/file?path='+encodeURIComponent(current.file.path)).then(fresh=>{
   const current=latest.current;if(cancelled||inFlight.current||current.file?.path!==fresh.path||current.file.sha256===fresh.sha256)return;
   if(current.draft!==current.file.content&&current.draft!==fresh.content){setConflict(fresh);setBlocked(true);setSaveState('충돌 · 자동저장 멈춤');}
   else{setFile(fresh);setDraft(fresh.content);setSaveState('✓ 저장됨');}
  }).catch(()=>{});return()=>{cancelled=true;};
 },[id,changeEvent?.seq]);
 const save=useCallback(async()=>{
  const current=latest.current;if(!current.file||!current.mutable||current.conflict||inFlight.current)return;
  inFlight.current=true;setSaving(true);setSaveState('저장 중…');const {file:f,draft:text}=current;
  try{
   const result=await api('/attempts/'+id+'/file',{path:f.path,content:text},'PUT',{'If-Match':'"'+f.sha256+'"'});
   // A pending request may complete after navigation or after more typing.
   const cached=drafts.current[f.path];if(cached?.content===text)delete drafts.current[f.path];else if(cached)cached.base=result;persist();
   if(alive.current&&latest.current.file?.path===f.path){setFile(result);setBlocked(false);setSaveState(latest.current.draft===text?'✓ 저장됨':'● 미저장');setLastSaved(result.modifiedAt);}
  }catch(e:any){
   if(e.code==='VERSION_CONFLICT'){const fresh=await api('/attempts/'+id+'/file?path='+encodeURIComponent(f.path));if(alive.current&&latest.current.file?.path===f.path)setConflict(fresh);}
   if(alive.current){setBlocked(true);setSaveState(e.code==='VERSION_CONFLICT'?'충돌 · 자동저장 멈춤':'저장 실패 · '+e.message);}
  }finally{inFlight.current=false;if(alive.current)setSaving(false);}
 },[id,persist,setLastSaved]);
 const dirty=!!file&&draft!==file.content;
 useEffect(()=>{if(!dirty||!mutable||conflict||blocked||saving)return;const timer=setTimeout(()=>void save(),800);return()=>clearTimeout(timer);},[dirty,draft,file,mutable,conflict,blocked,saving,save]);
 const edit=(text:string)=>{setDraft(text);if(!conflict){setBlocked(false);setSaveState('● 미저장');}};
 const resolveConflict=(choice:string)=>{if(!conflict)return;setFile(conflict);if(choice==='disk')setDraft(conflict.content);setConflict(null);setBlocked(false);setSaveState(choice==='disk'?'✓ 저장됨':'● 병합 저장 대기');};
 return {file,setFile,draft,setDraft:edit,conflict,setConflict,dirty,saveState,openFile,save,resolveConflict};
}
