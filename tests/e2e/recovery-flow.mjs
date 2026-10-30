// Real browser/PTY, deterministic delayed replay reply and synthetic VT screen.
const task=await taskSpace(SPACE_ID),page=task.page(PAGE_LABEL);let second;
try{
 await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.EventSource=class {close(){}};'});
 await page.goto(BASE_URL);await page.cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await page.waitForSelector('.scenario-card');await page.click('.scenario-card .card-link >> nth=0');await page.waitForSelector('.setup-options');
 await page.selectOption('.setup-options select >> nth=0','developer');await page.selectOption('.setup-options select >> nth=1','replay');
 await page.click('text="작업 공간 만들기"');await page.waitForSelector('text="환경 준비"');await page.click('text="환경 준비"');await page.waitForSelector('text="연습 시작"');await page.click('text="연습 시작"');
 await page.waitForSelector('textarea[aria-label="담당자 메시지"]');await page.fill('textarea[aria-label="담당자 메시지"]','어떤 문제가 가장 중요한가요?');await page.click('[aria-label="메시지 전송"]');
 await page.waitForSelector('text="답변을 기다리고 있습니다…"');await page.waitForSelector('text=[재생]',{timeout:15000});
 await page.waitForFunction(()=>!document.querySelector('.queue'));
 console.log('missed SSE completion recovered through polling');
 await page.waitForSelector('text="터미널이 열려 있지 않습니다."');await page.click('text="터미널 열기"');await page.waitForSelector('text="연결됨 · 출력 복원 완료"');
 const fixture='let count=0;process.stdin.setRawMode(true);process.stdin.resume();function draw(){process.stdout.write("\\x1b[2J\\x1b[HFRAME_START "+process.stdout.columns+"x"+process.stdout.rows+"\\x1b[3;2H한글 정상\\x1b[4;25HRIGHT_EDGE\\x1b[5;2HINPUT_COUNT_"+count)}process.on("SIGWINCH",draw);process.stdin.on("data",b=>{if(b.includes(3)){process.stdout.write("\\x1b[?1049l");process.exit(0)}count++;draw()});process.stdout.write("\\x1b[?1049h");draw();process.stdout.write("\\x1b[6n");';
 await page.focus('textarea[aria-label="Terminal input"]');await page.keyboard.paste("node -e '"+fixture.replaceAll("'","'\\''")+"'");await page.keyboard.press('Enter');
 const valid=()=>{const text=document.querySelector('.xterm-rows')?.textContent??'';return text.includes('FRAME_START')&&text.includes('한글 정상')&&text.includes('RIGHT_EDGE')&&text.includes('INPUT_COUNT_1')&&!text.includes('INPUT_COUNT_2');};
 await page.waitForFunction(valid);
 await page.focus('[aria-label="터미널 높이 조절"]');await page.keyboard.press('End');await page.waitForFunction(valid);
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:1100,height:850,deviceScaleFactor:1,mobile:false});
 await page.reload();await page.waitForSelector('text="연결됨 · 출력 복원 완료"');await page.waitForFunction(valid);
 await page.click('text="기록"');await page.click('text="터미널"');await page.waitForSelector('text="연결됨 · 출력 복원 완료"');await page.waitForFunction(valid);
 console.log('resize/reload/tab replay preserved VT layout and suppressed historical input replies');
 const attemptUrl=await page.url();second=await task.newPage();await second.goto(attemptUrl);
 await second.cdp('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});
 await second.waitForSelector('text="연결됨 · 출력 복원 완료"');await second.waitForFunction(valid);
 await second.focus('textarea[aria-label="Terminal input"]');
 let matched=false;for(let attempt=0;attempt<5&&!matched;attempt++){const geometry=await second.evaluate(()=>document.querySelector('.xterm-rows').textContent.match(/FRAME_START \d+x\d+/)?.[0]);try{await page.waitForFunction(expected=>document.querySelector('.xterm-rows')?.textContent?.includes(expected),geometry,{timeout:1000});matched=true;}catch{console.log('waiting for shared geometry',geometry);}}if(!matched)throw new Error('Viewers did not converge on shared geometry');
 await page.waitForFunction(valid);console.log('two viewers followed the same terminal geometry');
 await second.goto('about:blank');await page.focus('textarea[aria-label="Terminal input"]');await page.click('text="화면 복원"');await page.waitForFunction(valid);
 await page.press('textarea[aria-label="Terminal input"]','Control+C');
 console.log(JSON.stringify({passed:true,checks:['reply completion without SSE','serialized resize history','reload and tab restoration','no replayed terminal query input','multiple viewers','redraw without restarting process']}));
}catch(error){console.log(await page.snapshot());throw error;}
finally{if(second)await second.goto('about:blank');if(FINISH_SPACE)await task.finish({keep:[]});else await page.goto('about:blank');}
