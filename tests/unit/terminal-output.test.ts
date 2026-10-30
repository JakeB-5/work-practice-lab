import {it,expect,vi,afterEach} from 'vitest';
import {TerminalOutput} from '../../apps/web/src/terminal-output';
afterEach(()=>vi.useRealTimers());
function fixture(){const calls:string[]=[],callbacks:(()=>void)[]=[];const screen={cols:80,rows:24,resize(cols:number,rows:number){calls.push('resize '+cols+'x'+rows);this.cols=cols;this.rows=rows;},write(text:string,done:()=>void){calls.push('write '+text);callbacks.push(done);}};const ready=vi.fn(),output=new TerminalOutput(screen,ready,vi.fn(),vi.fn());output.begin();return {calls,callbacks,ready,output};}
it('waits for parsed output before changing geometry or claiming replay is complete',()=>{
 const {calls,callbacks,ready,output}=fixture();output.receive({type:'replay-start'});
 output.receive({seq:1,cols:80,rows:24,text:'old'});output.receive({seq:2,cols:120,rows:40,text:'new'});output.receive({type:'replay-complete'});
 expect(calls).toEqual(['write old']);expect(output.ready).toBe(false);expect(output.afterSeq).toBe(0);
 callbacks.shift()!();expect(calls).toEqual(['write old','resize 120x40','write new']);expect(ready).not.toHaveBeenCalled();
 callbacks.shift()!();expect(output.afterSeq).toBe(2);expect(ready).toHaveBeenCalledWith(false);expect(output.ready).toBe(true);output.close();
});
it('deduplicates reconnect frames and batches redraw bursts without losing bytes',()=>{
 const {calls,callbacks,output}=fixture();output.receive({type:'replay-start'});output.receive({seq:1,text:'a',cols:80,rows:24});
 for(let seq=2;seq<=1000;seq++)output.receive({seq,text:'b',cols:80,rows:24});output.receive({seq:1000,text:'duplicate'});
 callbacks.shift()!();expect(calls).toHaveLength(2);expect(calls[1]).toBe('write '+'b'.repeat(999));callbacks.shift()!();expect(output.afterSeq).toBe(1000);output.close();
});
it('supports an old server, waits for parsing, and requests a fresh redraw',async()=>{
 vi.useFakeTimers();const {output,callbacks,ready}=fixture();output.receive({seq:1,text:'legacy'});
 await vi.advanceTimersByTimeAsync(1500);expect(ready).not.toHaveBeenCalled();callbacks.shift()!();expect(ready).toHaveBeenCalledWith(true);output.close();
});
