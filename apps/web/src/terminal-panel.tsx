import React,{useEffect,useRef,useState} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {api} from './api';
import {TerminalOutput} from './terminal-output';

export function TerminalPanel({id,mutable,act}:any){
 const host=useRef<HTMLDivElement>(null),term=useRef<Terminal|null>(null),socket=useRef<WebSocket|null>(null);
 const [process,setProcess]=useState<any>(null),[status,setStatus]=useState('터미널을 확인합니다.'),[alternate,setAlternate]=useState(false);
 const connectRef=useRef<()=>Promise<void>>(async()=>{}),redrawRef=useRef<()=>void>(()=>{});
 const scrollOutput=(up:boolean)=>{const t=term.current;if(!t)return;if(t.buffer.active.type==='alternate'){if(socket.current?.readyState===1)socket.current.send(JSON.stringify({type:'input',text:up?'\x1b[5~':'\x1b[6~'}));}else if(up)t.scrollPages(-1);else t.scrollToBottom();};
 useEffect(()=>{
  const element=host.current;if(!element)return;
  let closed=false,active:any=null,retry:ReturnType<typeof setTimeout>|undefined,redrawTimer:ReturnType<typeof setTimeout>|undefined,frame=0,generation=0,delay=500,forceRedraw=false;
  const t=new Terminal({cols:100,rows:25,fontSize:12,fontFamily:'SFMono-Regular, Consolas, monospace',theme:{background:'#192522',foreground:'#e1e9e3'},cursorBlink:true,scrollback:20000,disableStdin:true});
  const fit=new FitAddon();t.loadAddon(fit);t.open(element);term.current=t;setAlternate(false);
  t.buffer.onBufferChange(buffer=>setAlternate(buffer.type==='alternate'));
  const dimensions=()=>{const size=fit.proposeDimensions();return size&&element.clientWidth>0&&element.clientHeight>0?{cols:Math.max(20,Math.min(300,size.cols)),rows:Math.max(5,Math.min(100,size.rows))}:null;};
  const output=new TerminalOutput(t,legacy=>{
   if(closed)return;t.options.disableStdin=false;setStatus('연결됨 · 출력 복원 완료');requestResize(legacy||forceRedraw);forceRedraw=false;
  },message=>setStatus(message),()=>{setStatus('종료됨 · 출력 보관');active=null;setProcess(null);});
  const sendSize=(size:{cols:number;rows:number})=>{
   if(socket.current?.readyState!==1||closed)return;
   // Old servers cannot broadcast geometry. New ones echo the ordered size frame.
   if(!output.modern)t.resize(size.cols,size.rows);
   socket.current.send(JSON.stringify({type:'resize',...size}));
  };
  const requestResize=(force=false)=>{
   if(!output.ready||socket.current?.readyState!==1)return;const size=dimensions();if(!size)return;
   clearTimeout(redrawTimer);
   if(force){sendSize({...size,cols:size.cols===300?299:size.cols+1});redrawTimer=setTimeout(()=>sendSize(size),80);}
   else if(t.cols!==size.cols||t.rows!==size.rows)sendSize(size);
  };
  redrawRef.current=()=>requestResize(true);
  const ro=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(document.visibilityState==='visible')requestResize();});});ro.observe(element);
  const focus=()=>requestResize();element.addEventListener('focusin',focus);
  t.onData(text=>{if(output.ready&&socket.current?.readyState===1)socket.current.send(JSON.stringify({type:'input',text}));});
  const attach=async(p:any)=>{
   const current=++generation;if(closed)return;clearTimeout(retry);
   if(socket.current){socket.current.onclose=null;socket.current.close();}
   active=p;setProcess(p);setStatus('터미널에 연결합니다.');t.options.disableStdin=true;
   const ticket=await api('/attempts/'+id+'/terminals/'+p.id+'/ticket');if(closed||current!==generation)return;
   const ws=new WebSocket(ticket.url+'&afterSeq='+output.afterSeq);socket.current=ws;
   ws.onopen=()=>{if(current!==generation)return;delay=500;output.begin();setStatus('이전 출력을 복원합니다.');};
   ws.onmessage=e=>{if(current===generation)output.receive(JSON.parse(e.data));};
   ws.onclose=()=>{if(closed||current!==generation)return;t.options.disableStdin=true;setStatus('연결 끊김 · 재연결 중');retry=setTimeout(()=>restore().catch(e=>setStatus(e.message)),delay);delay=Math.min(delay*2,10000);};
  };
  const restore=async()=>{const v=await api('/attempts/'+id+'/overview');if(closed)return;const p=v.processes.filter((p:any)=>p.kind==='terminal'&&p.state==='running').at(-1);if(p)await attach(p);else{active=null;setProcess(null);setStatus('터미널이 열려 있지 않습니다.');}};
  connectRef.current=async()=>{forceRedraw=true;if(active)return attach(active);const v=await api('/attempts/'+id+'/overview');const p=v.processes.filter((p:any)=>p.kind==='terminal'&&p.state==='running').at(-1)||await api('/attempts/'+id+'/terminals',dimensions()??{cols:100,rows:25});await attach(p);};
  restore().catch(e=>setStatus(e.message));
  return()=>{closed=true;generation++;clearTimeout(retry);clearTimeout(redrawTimer);cancelAnimationFrame(frame);ro.disconnect();element.removeEventListener('focusin',focus);socket.current?.close();output.close();t.dispose();};
 },[id]);
 return <div className="terminal-wrap"><div className="terminal-controls"><span role="status">{status}</span>
  <button title={alternate?'이전 페이지 보기 (Page Up)':'터미널에 보관된 이전 출력 보기'} onClick={()=>scrollOutput(true)}>이전 출력</button>
  <button title={alternate?'다음 페이지 보기 (Page Down)':'마지막 출력으로 이동'} onClick={()=>scrollOutput(false)}>{alternate?'다음 출력':'최신 출력'}</button>
  <button title="실행 중인 프로그램을 유지하고 화면만 다시 그립니다." onClick={()=>redrawRef.current()}>화면 복원</button>
  <button disabled={!mutable} onClick={()=>act(()=>connectRef.current())}>{process?'다시 연결':'터미널 열기'}</button>
  {process&&<button onClick={()=>act(async()=>{await api('/attempts/'+id+'/processes/'+process.id+'/stop',{});setProcess(null);setStatus('종료됨 · 출력 보관');})}>종료</button>}
 </div><div className="terminal-host" aria-label="작업 터미널" ref={host}/></div>;
}
