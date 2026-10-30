import {describe,it,expect} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {appendActivityEvent,ActivityLog,type ActivityEvent} from '../../apps/web/src/activity-log';

const change:ActivityEvent={id:'file',seq:1,type:'workspace.changed',actor:'user',payload:{path:'PRD.md'}};
describe('activity log with an interactive terminal',()=>{
 it('keeps file changes through thousands of redraws and keystrokes without causing refreshes',()=>{
  const initial=[change];let events=initial;
  for(let n=2;n<4000;n++)events=appendActivityEvent(events,{id:String(n),seq:n,type:n%2?'terminal.input':'terminal.output',payload:{text:'\x1b[?2026h\x1b[8;3H'}});
  expect(events).toBe(initial);
  const completed={id:'done',seq:4000,type:'message.completed'};
  expect(appendActivityEvent(events,completed)).toEqual([change,completed]);
 });
 it('deduplicates reconnects and retains the latest sequence when the buffer is full',()=>{
  const initial=Array.from({length:2000},(_,seq)=>({...change,id:String(seq),seq}));
  expect(appendActivityEvent(initial,initial[10])).toBe(initial);
  const next=appendActivityEvent(initial,{...change,id:'new',seq:2001});
  expect(next).toHaveLength(2000);expect(next.at(-1)?.seq).toBe(2001);
 });
 it('renders readable activity even when handed an older buffer containing terminal bytes',()=>{
  const html=renderToStaticMarkup(React.createElement(ActivityLog,{events:[change,{id:'raw',seq:2,type:'terminal.output',payload:{text:'\x1b[?2026h',processId:'private-process'}},{id:'input',seq:3,type:'terminal.input',payload:{text:'secret command'}}]}));
  expect(html).toContain('파일 변경');expect(html).toContain('PRD.md');
  for(const text of ['terminal.output','2026h','private-process','secret command'])expect(html).not.toContain(text);
 });
});
