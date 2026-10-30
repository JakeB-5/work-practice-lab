import React,{useEffect,useState} from 'react';
import {api} from './api';
type Model={id:string;label:string};
export function useModels(){
 const [models,setModels]=useState<Model[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const refresh=async()=>{setLoading(true);setError('');try{setModels((await api('/runtime/models')).items);}catch(e:any){setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{void refresh();},[]);return {models,error,loading,refresh};
}
export function AllowedModelsEditor({value,onChange}:{value:string[]|null;onChange:(v:string[]|null)=>void}){
 const {models,error,loading,refresh}=useModels();
 const choices=[...models,...(value||[]).filter(id=>!models.some(m=>m.id===id)).map(id=>({id,label:id+' · 현재 목록에 없음'}))];
 return <fieldset className="model-policy"><legend>사용 가능한 AI 모델</legend><p className="muted">이 과제에서 응시자가 선택할 수 있는 모델입니다. 담당자·코딩 도우미·채점·과제 앱 AI에 선택한 모델을 사용합니다.</p><label className="checkbox"><input type="checkbox" checked={value===null} onChange={e=>onChange(e.target.checked?null:[])}/>모델 제한 없음</label>{value!==null&&<><p>허용할 모델을 하나 이상 선택하세요.</p>{choices.map(m=><label className="checkbox" key={m.id}><input type="checkbox" checked={value.includes(m.id)} onChange={e=>onChange(e.target.checked?[...value,m.id]:value.filter(x=>x!==m.id))}/><span>{m.label}<small className="model-id">{m.id}</small></span></label>)}{!value.length&&<p role="status">선택한 모델이 없습니다. 저장하려면 모델을 선택하세요.</p>}</>}{loading&&<p role="status">모델 목록을 불러옵니다.</p>}{error&&<p role="alert">모델 목록을 불러오지 못했습니다: {error}</p>}<button type="button" disabled={loading} onClick={refresh}>모델 목록 새로고침</button></fieldset>;
}
export function AttemptModelChoice({allowed,value,onChange,onReady}:{allowed:string[]|null;value:string;onChange:(v:string)=>void;onReady:(ready:boolean)=>void}){
 const {models,error,loading,refresh}=useModels();
 const choices=models.filter(m=>!allowed||allowed.includes(m.id));
 useEffect(()=>{if(!loading&&!error&&!choices.some(m=>m.id===value))onChange(choices[0]?.id||'');},[loading,error,models,allowed,value]);
 useEffect(()=>{onReady(!loading&&!error&&choices.some(m=>m.id===value));},[loading,error,models,allowed,value]);
 return <div className="model-choice"><label>이번 응시의 AI 모델<select value={value} disabled={loading||!!error||!choices.length} onChange={e=>onChange(e.target.value)}><option value="" disabled>모델 선택</option>{choices.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>{value&&<small className="model-id">{value}</small>}<p className="muted">{allowed?'과제에서 허용한 모델: '+allowed.join(', '):'현재 Codex에 표시된 모델 중 선택할 수 있습니다.'} 응시를 만들면 모델이 고정됩니다.</p>{loading?<p role="status">모델 목록 확인 중</p>:error?<p role="alert">{error}</p>:!choices.length?<p role="alert">현재 사용할 수 있는 허용 모델이 없습니다. 과제 설정이나 Codex 연결을 확인하세요.</p>:null}<button type="button" disabled={loading} onClick={refresh}>모델 목록 새로고침</button></div>;
}
