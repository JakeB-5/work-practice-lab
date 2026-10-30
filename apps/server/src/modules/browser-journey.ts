import {chromium} from '@playwright/test';
import {assert} from '../core.ts';
export type JourneyStep={action:'open'|'fill'|'click'|'select'|'expectText'|'expectVisible'|'expectCount';target:string;value:string};
export function validateJourney(steps:any){
 assert(Array.isArray(steps)&&steps.length>=3&&steps.length<=18,422,'SCENARIO_INVALID','화면 검사는 3~18개 단계가 필요합니다.');
 assert(steps[0]?.action==='open',422,'SCENARIO_INVALID','화면 검사의 첫 단계는 open이어야 합니다.');
 let assertions=0,interactions=0;
 for(const s of steps){
  assert(s&&['open','fill','click','select','expectText','expectVisible','expectCount'].includes(s.action)&&typeof s.target==='string'&&s.target.length>0&&s.target.length<=300&&typeof s.value==='string'&&s.value.length<=2000,422,'SCENARIO_INVALID','화면 검사 단계 형식이 잘못됐습니다.');
  if(s.action==='open')assert(/^\/(?!\/)/.test(s.target)&&!/[\\\r\n]/.test(s.target),422,'SCENARIO_INVALID','화면 검사는 앱 내부 경로만 열 수 있습니다.');
  else assert(!/^(?:javascript|data):/i.test(s.target),422,'SCENARIO_INVALID','화면 검사 선택자를 확인해주세요.');
  if(s.action==='expectText')assert(s.value.trim().length>0,422,'SCENARIO_INVALID','확인할 문구가 필요합니다.');
  if(s.action==='expectCount')assert(/^\d{1,4}$/.test(s.value),422,'SCENARIO_INVALID','요소 개수는 0~9999 정수여야 합니다.');
  if(s.action.startsWith('expect'))assertions++;
  if(['fill','click','select'].includes(s.action))interactions++;
 }
 assert(assertions>0&&interactions>0,422,'SCENARIO_INVALID','단순 페이지 열기가 아닌 입력·클릭과 결과 확인이 필요합니다.');
 return steps as JourneyStep[];
}
export async function runBrowserJourney(url:string,steps:JourneyStep[],signal?:AbortSignal){
 validateJourney(steps);signal?.throwIfAborted();const browser=await chromium.launch({headless:true});const abort=()=>{void browser.close();};signal?.addEventListener('abort',abort,{once:true});
 const observations:any[]=[];let screenshot:Buffer|undefined;
 try{
  signal?.throwIfAborted();const context=await browser.newContext({viewport:{width:1280,height:900}}),origin=new URL(url).origin;
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(5000);
  for(const [index,step] of steps.entries()){
   signal?.throwIfAborted();try{
    const loc=step.action==='open'?null:page.locator(step.target);
    if(step.action==='open'){const target=new URL(step.target,url);assert(target.origin===origin,422,'SCENARIO_INVALID','외부 주소로 이동할 수 없습니다.');const r=await page.goto(target.href,{waitUntil:'domcontentloaded',timeout:10000});if(!r||r.status()>=400)throw new Error('페이지 HTTP '+r?.status());}
    else if(step.action==='fill')await loc!.fill(step.value);
    else if(step.action==='click')await loc!.click();
    else if(step.action==='select')await loc!.selectOption(step.value);
    else if(step.action==='expectVisible')await loc!.waitFor({state:'visible'});
    else{const deadline=Date.now()+5000;let observed:any,ok=false;do{signal?.throwIfAborted();if(step.action==='expectText'){const text:string[]=[];for(let i=0;i<Math.min(await loc!.count(),200);i++){const item=loc!.nth(i);if(await item.isVisible())text.push(await item.innerText());}observed=text.join('\n');}else observed=await loc!.count();ok=step.action==='expectText'?observed.includes(step.value):observed===Number(step.value);if(ok)break;await new Promise(r=>setTimeout(r,80));}while(Date.now()<deadline);if(!ok)throw new Error('기대 결과와 다름: '+JSON.stringify(observed).slice(0,1000));}
    if(new URL(page.url()).origin!==origin)throw new Error('앱 외부 이동이 차단되었습니다.');
    observations.push({index,...step,passed:true});
   }catch(e:any){signal?.throwIfAborted();observations.push({index,...step,passed:false,error:String(e.message).slice(0,1200)});break;}
  }
  screenshot=await page.screenshot({fullPage:true});return {status:observations.length===steps.length&&observations.every(x=>x.passed)?'passed':'failed',observations,screenshot};
 }finally{signal?.removeEventListener('abort',abort);await browser.close();}
}
