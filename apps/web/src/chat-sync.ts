import {useEffect,useRef,useState} from 'react';
import {api} from './api';

// Serialize refreshes so an older response cannot overwrite a completed reply.
// Polling is a recovery path when an SSE notification is missed or saturated.
export function snapshotSync<T>(load:()=>Promise<T>,publish:(value:T)=>void,fail:(error:unknown)=>void,interval=3000){
 let stopped=false,busy=false,queued=false,timer:ReturnType<typeof setTimeout>|undefined;
 const refresh=async()=>{
  if(stopped)return;if(busy){queued=true;return;}
  clearTimeout(timer);busy=true;
  try{const value=await load();if(!stopped)publish(value);}catch(error){if(!stopped)fail(error);}
  finally{busy=false;if(!stopped){if(queued){queued=false;void refresh();}else timer=setTimeout(refresh,interval);}}
 };
 return {refresh,stop:()=>{stopped=true;clearTimeout(timer);}};
}

export function useChatSnapshot(id:string,role:string,sequence:number|undefined,tick:number){
 const [snapshot,setSnapshot]=useState<{messages:any[];queue:any[];approvals:any[]}>({messages:[],queue:[],approvals:[]});
 const [error,setError]=useState('');const refresh=useRef<()=>void>(()=>{});
 useEffect(()=>{
  const sync=snapshotSync(async()=>{
   const [messages,queue,approvals]=await Promise.all([api('/attempts/'+id+'/messages?role='+role),api('/attempts/'+id+'/queue'),api('/attempts/'+id+'/approvals')]);
   return {messages:messages.items,queue:queue.items,approvals:approvals.items};
  },value=>{setSnapshot(previous=>JSON.stringify(previous)===JSON.stringify(value)?previous:value);setError('');},()=>setError('답변 상태를 다시 확인하고 있습니다.'));
  refresh.current=()=>{void sync.refresh();};void sync.refresh();
  const visible=()=>{if(document.visibilityState==='visible')void sync.refresh();};
  addEventListener('focus',refresh.current);document.addEventListener('visibilitychange',visible);
  const onFocus=refresh.current;
  return()=>{sync.stop();removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',visible);};
 },[id,role]);
 useEffect(()=>{refresh.current();},[sequence,tick]);
 return {...snapshot,error,refresh:()=>refresh.current()};
}
