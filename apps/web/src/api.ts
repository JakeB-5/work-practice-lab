let csrf='';
export class ApiError extends Error{constructor(public code:string,message:string,public status:number){super(message);}}
export async function api(url:string,body?:any,method=body===undefined?'GET':'POST',extra:Record<string,string>={}){
 const headers:Record<string,string>={...extra};if(body!==undefined)headers['Content-Type']='application/json';if(method!=='GET'){headers['X-WPL-CSRF']=csrf;headers['Idempotency-Key']=crypto.randomUUID();}
 const response=await fetch('/api/v1'+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new ApiError(result.error?.code||result.code,result.error?.message||result.message,response.status);return result;
}
export async function bootstrap(){const token=document.querySelector<HTMLMetaElement>('meta[name=wpl-launch]')!.content;const result=await api('/bootstrap',{launchToken:token});csrf=result.csrfToken;document.querySelector('meta[name=wpl-launch]')?.remove();}
export async function waitOperation(id:string,onProgress?:(o:any)=>void){for(;;){const o=await api('/operations/'+id);onProgress?.(o);if(o.status==='succeeded')return o.result;if(['failed','interrupted','uncertain'].includes(o.status))throw new Error(o.error?.message||'작업이 '+o.status+' 상태입니다.');await new Promise(r=>setTimeout(r,700));}}
