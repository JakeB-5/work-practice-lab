import React from 'react';

export type ActivityEvent={id:string;type:string;seq:number;occurredAt?:string;actor?:string;payload?:Record<string,unknown>};
const isActivity=(event:ActivityEvent)=>event.type!=='terminal.output'&&event.type!=='terminal.input';

// Terminal bytes have their own durable WebSocket replay. They must not evict
// file/message events or trigger React and chat refreshes on every cursor blink.
export function appendActivityEvent<T extends ActivityEvent>(events:T[],event:T):T[]{
 if(!isActivity(event)||events.some(item=>item.id===event.id))return events;
 return [...events.slice(-1999),event];
}

const titles:Record<string,string>={
 'workspace.changed':'파일 변경','process.exited':'실행 종료','output.truncated':'출력 보관 한도 도달',
 'attempt.created':'연습 생성','attempt.state_changed':'연습 상태 변경',
 'message.accepted':'메시지 접수','message.created':'메시지 등록','message.completed':'답변 완료','message.delta':'답변 작성 중',
 'note.saved':'메모 저장','operation.started':'작업 시작','operation.completed':'작업 완료','operation.failed':'작업 실패',
};
const actors:Record<string,string>={user:'나',system:'시스템',coder:'코딩 도우미',stakeholder:'담당자',evaluator:'평가'};
const states:Record<string,string>={running:'실행 중',completed:'완료',succeeded:'완료',failed:'실패',exited:'종료',paused:'일시정지',ready:'준비 완료'};
function summary(event:ActivityEvent){
 const p=event.payload??{};
 const detail=[p.path,p.note,p.reason,p.message].find(value=>typeof value==='string');
 if(typeof detail==='string')return detail.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,220);
 if(typeof p.state==='string')return states[p.state]??'상태가 갱신됐습니다.';
 if(typeof p.exitCode==='number')return p.exitCode===0?'정상 종료':'종료 코드 '+p.exitCode;
 return '';
}

export function ActivityLog({events}:{events:ActivityEvent[]}){
 const visible=events.filter(isActivity).slice(-100).reverse();
 return <div className="event-list" aria-label="작업 기록">
  <p className="activity-help">파일 변경과 작업 상태를 표시합니다. 명령과 실행 출력은 터미널 탭에서 확인하세요.</p>
  {!visible.length&&<p>아직 작업 기록이 없습니다.</p>}
  {visible.map(event=><div key={event.id}>
   <time>{event.occurredAt?new Date(event.occurredAt).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</time>
   <span>{actors[event.actor??'']??'시스템'}</span>
   <strong>{titles[event.type]??'작업 기록'}</strong>
   {summary(event)&&<small>{summary(event)}</small>}
  </div>)}
 </div>;
}
