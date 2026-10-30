import {assert} from '../core.ts';
export const checkRunners:Record<string,string>={
 'retail-page':'retail-flow','retail-grounding':'retail-flow','booking-flow':'booking-flow','booking-race':'booking-race'
};
const runnerKinds:Record<string,string[]>={'command':['command'],'browser-page':['browser'],'retail-flow':['browser','semantic'],'booking-flow':['http'],'booking-race':['concurrency']};
export function checkDefinitions(def:any){
 assert(def&&typeof def.version==='string'&&Array.isArray(def.checks)&&def.checks.length>0&&def.checks.length<=20,422,'SCENARIO_INVALID','검증 버전과 1~20개 검사가 필요합니다.');
 assert(new Set(def.checks.map((c:any)=>c.id)).size===def.checks.length,422,'SCENARIO_INVALID','검사 ID가 중복됩니다.');
 return def.checks.map((c:any)=>{
  const runner=c.runner||(c.kind==='command'?'command':checkRunners[c.id]);
  assert(/^[a-z][a-z0-9-]{1,63}$/.test(c.id)&&typeof c.description==='string'&&runnerKinds[runner]?.includes(c.kind),422,'SCENARIO_INVALID','지원하지 않는 검증 정의입니다. runner와 kind를 확인해주세요.');
  if(runner==='command')assert(Array.isArray(c.argv)&&c.argv.length>0&&c.argv.every((v:any)=>typeof v==='string'&&v.length>0),422,'SCENARIO_INVALID','명령 검사는 argv 배열이 필요합니다.');
  assert(c.timeoutSeconds===undefined||Number.isInteger(c.timeoutSeconds)&&c.timeoutSeconds>=1&&c.timeoutSeconds<=600,422,'SCENARIO_INVALID','검사 제한 시간은 1~600초입니다.');
  return {...c,runner,timeoutSeconds:c.timeoutSeconds||(runner==='browser-page'?60:120)};
 });
}
