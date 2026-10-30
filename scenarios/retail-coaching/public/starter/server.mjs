import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
export const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
export async function readJson(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw new Error('요청이 너무 큽니다.');}return body?JSON.parse(body):{};}
export function sessionUser(req){const match=(req.headers.cookie||'').match(/(?:^|;\s*)wpl_demo_user=(alice|bob)(?:;|$)/);return match?.[1]||'alice';}
// messages의 role은 user/assistant만 허용됩니다. system 역할은 거절됩니다.
// 호출 규칙: resources/ai-contract.md. 이 함수는 서버에서만 사용합니다.
export async function scenarioAI(messages,resourceIds=['catalog','policy','training'],outputSchema){
 if(!process.env.WPL_SCENARIO_AI_URL||!process.env.WPL_SCENARIO_AI_TOKEN)throw new Error('연습 환경의 AI 연결이 필요합니다.');
 const headers={'Content-Type':'application/json','Authorization':'Bearer '+process.env.WPL_SCENARIO_AI_TOKEN,'Idempotency-Key':crypto.randomUUID()};
 const response=await fetch(process.env.WPL_SCENARIO_AI_URL+'/requests',{method:'POST',headers,body:JSON.stringify({messages,resourceIds,...(outputSchema?{outputSchema}:{})})});
 const accepted=await response.json();if(!response.ok)throw new Error(accepted.error?.message||'AI 연결 실패');
 for(let i=0;i<180;i++){await new Promise(r=>setTimeout(r,500));const status=await fetch(process.env.WPL_SCENARIO_AI_URL+'/operations/'+accepted.operationId,{headers});const result=await status.json();if(result.operation?.status==='succeeded')return result.outputJson||result.output;if(['failed','interrupted','uncertain'].includes(result.operation?.status))throw new Error(result.operation.error?.message||'AI 응답 실패');}
 throw new Error('AI 응답을 기다리는 시간이 초과됐습니다.');
}
async function handle(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/session')return json(res,200,{userId:sessionUser(req)});
 if(url.pathname==='/api/login'&&req.method==='POST'){const body=await readJson(req);if(!['alice','bob'].includes(body.userId))return json(res,400,{error:'잘못된 사용자'});res.setHeader('Set-Cookie','wpl_demo_user='+body.userId+'; HttpOnly; SameSite=Strict; Path=/');return json(res,200,{userId:body.userId});}
 // Implement the task-specific routes and interface here.
 if(url.pathname.startsWith('/api/'))return json(res,501,{error:'아직 구현하지 않은 기능입니다.'});
 const requested=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
 const file=path.resolve(root,requested);
 if(!file.startsWith(root+path.sep)||requested.includes('..'))return json(res,403,{error:'허용되지 않는 경로'});
 try{const bytes=await fs.readFile(file);const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'})[ext]||'application/octet-stream');res.end(bytes);}catch{return json(res,404,{error:'파일 없음'});}
}
const port=Number(process.env.PORT||3000);
http.createServer((req,res)=>handle(req,res).catch(e=>json(res,500,{error:e.message}))).listen(port,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:'+port));
