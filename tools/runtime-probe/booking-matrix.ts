import fs from 'node:fs';import path from 'node:path';import pg from 'pg';
const base=process.env.WPL_PREVIEW_URL!,attemptId=process.env.WPL_ATTEMPT_ID!,dataRoot=process.env.WPL_DATA_DIR!;if(!base||!attemptId||!dataRoot)throw new Error('owned preview URL, attempt ID and data root required');
const report:any={startedAt:new Date().toISOString(),attemptId,mode:'real HTTP requests against the UI-created PostgreSQL application; started-reservation and DB-failure cases use explicit test fixtures',cases:[]};
async function request(method:string,url:string,body?:any,user:string|null='alice'){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(user?{Cookie:'wpl_demo_user='+user}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});return {status:r.status,body:await r.json().catch(()=>null)};}
const record=(name:string,result:any,expected:number[])=>{const row={name,...result,expected,passed:expected.includes(result.status)};report.cases.push(row);return row;};
const config=JSON.parse(fs.readFileSync(path.join(dataRoot,'services/postgres.json'),'utf8')),database='wpl_'+attemptId.replaceAll('-','').replaceAll('_',''),pool=new pg.Pool({host:'127.0.0.1',port:Number(config.port),user:'postgres',password:config.password,database,max:1});
try{
 record('미로그인 예약 목록',await request('GET','/api/reservations',undefined,null),[401]);record('미로그인 장비 목록',await request('GET','/api/equipment',undefined,null),[401]);
 record('타인 예약 취소',await request('DELETE','/api/reservations/1',undefined,'bob'),[403]);
 const payload={equipmentId:'camera-b',startAt:'2026-11-01T00:00:00.000Z',endAt:'2026-11-01T01:00:00.000Z'};
 const race=await Promise.all([request('POST','/api/reservations',payload,'alice'),request('POST','/api/reservations',payload,'bob')]);const list=await request('GET','/api/reservations');const rows=list.body.filter((x:any)=>x.equipmentId==='camera-b'&&x.startAt===payload.startAt&&x.status==='confirmed');report.cases.push({name:'동시 예약 + 실제 저장 수',responses:race,storedCount:rows.length,passed:race.filter(x=>x.status===201).length===1&&race.filter(x=>x.status===409).length===1&&rows.length===1});
 record('다른 장비 같은 시간',await request('POST','/api/reservations',{...payload,equipmentId:'mic-a'}),[201]);
 record('30분 단위 위반',await request('POST','/api/reservations',{...payload,equipmentId:'camera-a',startAt:'2026-11-01T00:10:00.000Z'}),[400,422]);
 record('4시간 초과',await request('POST','/api/reservations',{...payload,equipmentId:'camera-a',endAt:'2026-11-01T05:00:00.000Z'}),[400,422]);
 record('과거 시작',await request('POST','/api/reservations',{...payload,startAt:'2026-10-29T00:00:00.000Z',endAt:'2026-10-29T01:00:00.000Z'}),[400,422]);
 record('시작과 종료 역전',await request('POST','/api/reservations',{...payload,startAt:payload.endAt,endAt:payload.startAt}),[400,422]);
 record('잘못된 날짜',await request('POST','/api/reservations',{...payload,startAt:'not-a-date'}),[400,422]);
 const start=new Date(Math.floor(Date.now()/1800000)*1800000-1800000),end=new Date(start.getTime()+3600000);
 const inserted=await pool.query("INSERT INTO equipment_reservations(equipment_id,user_id,start_at,end_at) VALUES('camera-b','alice',$1,$2) RETURNING id::text",[start.toISOString(),end.toISOString()]);
 const started=record('시작한 예약 취소 - DB 시간 경계 fixture',await request('DELETE','/api/reservations/'+inserted.rows[0].id),[409,400,422]);started.fixture={type:'known generated-app schema',startAt:start.toISOString(),endAt:end.toISOString()};
 const failureStart='2026-11-02T00:00:00.000Z';
 await pool.query(`CREATE FUNCTION wpl_qa_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.equipment_id='mic-a' AND NEW.start_at='2026-11-02T00:00:00Z'::timestamptz THEN RAISE EXCEPTION 'WPL_QA_CONTROLLED_FAILURE'; END IF; RETURN NEW; END $$; CREATE TRIGGER wpl_qa_insert_failure BEFORE INSERT ON equipment_reservations FOR EACH ROW EXECUTE FUNCTION wpl_qa_insert_failure();`);
 const failed=await request('POST','/api/reservations',{equipmentId:'mic-a',startAt:failureStart,endAt:'2026-11-02T01:00:00.000Z'});const count=Number((await pool.query('SELECT count(*) FROM equipment_reservations WHERE equipment_id=$1 AND start_at=$2',['mic-a',failureStart])).rows[0].count);report.cases.push({name:'DB 오류에서 부분 저장 없음',...failed,storedCount:count,passed:[500,503].includes(failed.status)&&count===0});
 await pool.query('DROP TRIGGER wpl_qa_insert_failure ON equipment_reservations; DROP FUNCTION wpl_qa_insert_failure();');
 record('DB 오류 해제 후 정상 재예약',await request('POST','/api/reservations',{equipmentId:'mic-a',startAt:failureStart,endAt:'2026-11-02T01:00:00.000Z'}),[201]);
 report.passed=report.cases.every((x:any)=>x.passed);if(!report.passed)process.exitCode=1;
}catch(e:any){report.passed=false;report.error=e.message;process.exitCode=1;}finally{await pool.query('DROP TRIGGER IF EXISTS wpl_qa_insert_failure ON equipment_reservations; DROP FUNCTION IF EXISTS wpl_qa_insert_failure();').catch(()=>{});await pool.end();report.completedAt=new Date().toISOString();fs.writeFileSync('docs/evidence/booking-live-matrix.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,cases:report.cases.map((c:any)=>({name:c.name,status:c.status,responses:c.responses?.map((r:any)=>r.status),storedCount:c.storedCount,passed:c.passed})),error:report.error}));}
