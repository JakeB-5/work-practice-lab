import React,{useState,useRef,useEffect} from 'react';
import {api} from './api';
export function InterviewAnswer({interview,q,index,act,refresh,label}:any){
 const answer=interview.answers.find((a:any)=>a.questionId===q.id),key='wpl:answer:'+interview.id+':'+q.id;
 const [text,setText]=useState(()=>{try{return localStorage.getItem(key)??answer?.text??'';}catch{return answer?.text||'';}}),[status,setStatus]=useState(answer?.status==='answered'?'답변 확정됨':answer?.status==='skipped'?'건너뜀':'임시 작성'),[saving,setSaving]=useState(false);
 const saved=useRef(answer?.text||''),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),pending=useRef<Promise<any>>(Promise.resolve()),locked=useRef(false);
 const finalized=interview.status==='finalized';
 const store=(value:string)=>{try{localStorage.setItem(key,value);}catch{setStatus('초안 보관 실패 · 저장해주세요');}};
 const saveDraft=()=>{clearTimeout(timer.current);if(finalized||locked.current||text===saved.current)return pending.current;
  setSaving(true);setStatus('저장 중…');const value=text;
  pending.current=pending.current.catch(()=>{}).then(()=>api('/interviews/'+interview.id+'/answers/'+q.id,{text:value,status:'draft'},'PUT')).then(()=>{saved.current=value;setStatus('임시 저장됨');}).catch(e=>{setStatus('저장 실패 · '+e.message);throw e;}).finally(()=>setSaving(false));
  return pending.current;
 };
 useEffect(()=>{if(!finalized&&text!==saved.current){timer.current=setTimeout(()=>{saveDraft().catch(()=>{});},800);}return()=>clearTimeout(timer.current);},[text,finalized]);
 const confirmAnswer=(kind:string)=>act(async()=>{locked.current=true;clearTimeout(timer.current);try{await pending.current.catch(()=>{});const value=kind==='skipped'?'':text;await api('/interviews/'+interview.id+'/answers/'+q.id,{text:value,status:kind},'PUT');saved.current=value;setText(value);setStatus(kind==='answered'?'답변 확정됨':'건너뜀');try{localStorage.removeItem(key);}catch{}await refresh();}finally{locked.current=false;}});
 return <div className="question"><span className="eyebrow">QUESTION 0{index+1} · {label(q.focusAxis)}</span><h3>{q.text}</h3><textarea aria-label={'질문 '+(index+1)+' 답변'} rows={4} maxLength={8000} disabled={finalized} value={text} onChange={e=>{setText(e.target.value);store(e.target.value);setStatus('미저장');}}/>{!finalized&&<div className="inline"><button disabled={saving} onClick={()=>confirmAnswer('answered')}>답변 확정</button><button disabled={saving} onClick={()=>confirmAnswer('skipped')}>답변하지 않음</button><button disabled={saving} onClick={()=>act(saveDraft)}>임시 저장</button><small role="status">{status}</small></div>}</div>;
}
