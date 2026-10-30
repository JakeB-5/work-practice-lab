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
  const fixed=[...center.children].filter(node=>node.matches('.editor-toolbar,.panel-layout,.terminal-resizer,.preview-help'));
  const measure=()=>setMaximum(Math.max(minimumPanelHeight,center.clientHeight-140-fixed.reduce((sum,node)=>sum+node.getBoundingClientRect().height,0)));
  const observer=new ResizeObserver(measure);observer.observe(center);fixed.forEach(node=>observer.observe(node));measure();
  return()=>observer.disconnect();
 },[layoutKey]);
 return {ref,height:clampPanelHeight(preferred,maximum),maximum,setHeight:(value:number)=>setPreferred(clampPanelHeight(value,maximum))};
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
