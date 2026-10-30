import React,{useEffect,useRef,useState} from 'react';
import {usePreference} from './workspace-state';

export const minimumPanelHeight=160;
export function clampPanelHeight(value:number,max:number){
 return Math.round(Math.max(minimumPanelHeight,Math.min(Number.isFinite(value)?value:300,max)));
}
export function usePanelHeight(id:string,layoutKey:string){
 const ref=useRef<HTMLElement>(null);
 const [preferred,setPreferred]=usePreference(id,'terminalHeight',300);
 const [maximum,setMaximum]=useState(600);
 useEffect(()=>{
  const center=ref.current;if(!center)return;
  const fixed=[...center.children].filter(node=>node.matches('.editor-toolbar,.terminal-resizer,.preview-help'));
  const measure=()=>setMaximum(Math.max(minimumPanelHeight,center.clientHeight-140-fixed.reduce((sum,node)=>sum+node.getBoundingClientRect().height,0)));
  const observer=new ResizeObserver(measure);observer.observe(center);fixed.forEach(node=>observer.observe(node));measure();
  return()=>observer.disconnect();
 },[layoutKey]);
 return {ref,height:clampPanelHeight(preferred,maximum),maximum,setHeight:(value:number)=>setPreferred(clampPanelHeight(value,maximum))};
}

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,max));
export function usePanelWidths(id:string,showLeft:boolean){
 const ref=useRef<HTMLDivElement>(null),[available,setAvailable]=useState(innerWidth);
 const [left,setLeft]=usePreference(id,'leftWidth',20),[chat,setChat]=usePreference(id,'chatWidth',30);
 useEffect(()=>{const element=ref.current;if(!element)return;const observer=new ResizeObserver(()=>setAvailable(element.clientWidth));observer.observe(element);setAvailable(element.clientWidth);return()=>observer.disconnect();},[]);
 const overlay=available<900,leftMinimum=160,chatMinimum=240,centerMinimum=280;
 const leftWanted=available*(Number.isFinite(left)?left:20)/100;
 const chatWanted=available*(Number.isFinite(chat)?chat:30)/100;
 const chatMaximum=Math.max(chatMinimum,available-centerMinimum-(showLeft&&!overlay?leftMinimum+12:6));
 const chatSize=clamp(chatWanted,chatMinimum,chatMaximum);
 const leftMaximum=overlay?Math.min(360,Math.max(leftMinimum,available-80)):Math.max(leftMinimum,available-chatSize-centerMinimum-12);
 const leftSize=clamp(leftWanted,leftMinimum,leftMaximum);
 return {ref,overlay,leftSize,chatSize,leftMinimum,leftMaximum,chatMinimum,
  chatMaximum:Math.max(chatMinimum,available-centerMinimum-(showLeft&&!overlay?leftSize+12:6)),
  setLeft:(value:number)=>setLeft(100*clamp(value,leftMinimum,leftMaximum)/available),
  setChat:(value:number)=>setChat(100*clamp(value,chatMinimum,available-centerMinimum-(showLeft&&!overlay?leftSize+12:6))/available),
  resetLeft:()=>setLeft(20),resetChat:()=>setChat(30)};
}

export function ColumnResizer({side,value,minimum,maximum,onChange,onReset}:{side:'left'|'chat';value:number;minimum:number;maximum:number;onChange:(value:number)=>void;onReset:()=>void}){
 const drag=useRef<{x:number;value:number}|null>(null),direction=side==='left'?1:-1;
 return <div className={'column-resizer '+side+'-resizer'} role="separator" aria-orientation="vertical"
  aria-label={side==='left'?'자료 패널 너비 조절':'대화 패널 너비 조절'} aria-valuemin={Math.round(minimum)} aria-valuemax={Math.round(maximum)} aria-valuenow={Math.round(value)}
  tabIndex={0} title="좌우로 드래그하거나 방향키로 너비를 조절하세요. 두 번 누르면 기본 너비로 돌아갑니다."
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();drag.current={x:event.clientX,value};event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{if(drag.current)onChange(clamp(drag.current.value+direction*(event.clientX-drag.current.x),minimum,maximum));}}
  onPointerUp={event=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
  onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onDoubleClick={onReset}
  onKeyDown={event=>{const next=event.key==='ArrowRight'?value+direction*16:event.key==='ArrowLeft'?value-direction*16:event.key==='Home'?minimum:event.key==='End'?maximum:null;if(next!==null){event.preventDefault();onChange(clamp(next,minimum,maximum));}}}/>
}

export function PanelResizer({height,maximum,onChange}:{height:number;maximum:number;onChange:(value:number)=>void}){
 const drag=useRef<{y:number;height:number}|null>(null);
 return <div className="terminal-resizer" role="separator" aria-label="터미널 높이 조절" aria-orientation="horizontal"
  aria-valuemin={minimumPanelHeight} aria-valuemax={Math.round(maximum)} aria-valuenow={height} tabIndex={0}
  title="위아래로 드래그하거나 방향키로 높이를 조절하세요."
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();drag.current={y:event.clientY,height};event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{if(drag.current)onChange(drag.current.height+drag.current.y-event.clientY);}}
  onPointerUp={event=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
  onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
  onDoubleClick={()=>onChange(300)}
  onKeyDown={event=>{const next=event.key==='ArrowUp'?height+32:event.key==='ArrowDown'?height-32:event.key==='Home'?minimumPanelHeight:event.key==='End'?maximum:null;if(next!==null){event.preventDefault();onChange(next);}}}>
  <span>↕ 드래그하여 높이 조절</span>
 </div>;
}
