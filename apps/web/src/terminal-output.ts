type Screen={cols:number;rows:number;resize:(cols:number,rows:number)=>void;write:(text:string,done:()=>void)=>void};
type Frame={seq?:number;text?:string;cols?:number;rows?:number;type?:string;error?:string;exited?:boolean;epoch?:number};

// VT cursor movements are meaningful only at their original dimensions. Keep
// writes, size changes and the replay boundary ordered, including async parsing.
export class TerminalOutput{
 ready=false;modern=false;afterSeq=0;
 private epoch=0;private seen=0;private queue:Frame[]=[];private writing=false;private closed=false;private legacy=false;
 private idle?:ReturnType<typeof setTimeout>;private deadline?:ReturnType<typeof setTimeout>;
 constructor(private screen:Screen,private restored:(legacy:boolean)=>void,private error:(message:string)=>void,private exited:()=>void){}
 begin(){this.epoch++;this.ready=false;this.modern=false;this.legacy=false;clearTimeout(this.idle);clearTimeout(this.deadline);this.deadline=setTimeout(()=>this.finishLegacy(),1500);}
 private finishLegacy(){if(this.closed||this.modern||this.ready)return;clearTimeout(this.idle);clearTimeout(this.deadline);this.receive({type:'replay-complete'});}
 receive(frame:Frame){
  if(this.closed)return;
  if(frame.type==='replay-start'){this.modern=true;clearTimeout(this.idle);clearTimeout(this.deadline);return;}
  if(frame.error){this.error(frame.error);return;}
  if(frame.seq&&frame.seq<=this.seen)return;if(frame.seq)this.seen=frame.seq;
  if(!this.ready&&!this.modern&&frame.type!=='replay-complete'){clearTimeout(this.idle);this.idle=setTimeout(()=>this.finishLegacy(),150);}
  if(!this.ready&&frame.text&&!frame.cols)this.legacy=true;
  this.queue.push(frame.type==='replay-complete'?{...frame,epoch:this.epoch}:frame);this.drain();
 }
 private drain(){
  if(this.closed||this.writing)return;
  while(this.queue.length){
   const frame=this.queue.shift()!;
   if(frame.type==='replay-complete'){if(frame.epoch!==this.epoch)continue;this.ready=true;this.restored(!this.modern||this.legacy);continue;}
   if(frame.exited){this.exited();continue;}
   let text=frame.text??'',seq=frame.seq;
   while(this.queue.length&&text.length<262144){const next=this.queue[0];if(next.type||next.exited||next.cols!==frame.cols||next.rows!==frame.rows)break;this.queue.shift();text+=next.text??'';seq=next.seq??seq;}
   if(frame.cols&&frame.rows&&(this.screen.cols!==frame.cols||this.screen.rows!==frame.rows))this.screen.resize(frame.cols,frame.rows);
   if(!text){if(seq)this.afterSeq=seq;continue;}
   this.writing=true;this.screen.write(text,()=>{if(seq)this.afterSeq=seq;this.writing=false;this.drain();});return;
  }
 }
 close(){this.closed=true;this.queue=[];clearTimeout(this.idle);clearTimeout(this.deadline);}
}
