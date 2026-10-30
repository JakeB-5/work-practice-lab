// Layout-only replay fixture; no AI calls or user workspace changes.
const task=await taskSpace(SPACE_ID),page=task.page(PAGE_LABEL);
try{
 await page.goto(BASE_URL);await page.cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await page.waitForSelector('.scenario-card');await page.click('.scenario-card .card-link >> nth=0');await page.waitForSelector('.setup-options');
 await page.selectOption('.setup-options select >> nth=0','developer');await page.selectOption('.setup-options select >> nth=1','replay');
 await page.click('text="작업 공간 만들기"');await page.waitForSelector('text="환경 준비"');await page.click('text="환경 준비"');await page.waitForSelector('text="연습 시작"');await page.click('text="연습 시작"');
 await page.waitForSelector('[aria-label="대화 패널 너비 조절"]');
 await page.click('.left-panel .tabs button:text-is("파일")');await page.waitForSelector('.file-list button:has-text("server.mjs")');await page.click('.file-list button:has-text("server.mjs")');await page.waitForSelector('.monaco-editor');
 await page.waitForFunction(()=>document.querySelector('.monaco-editor .view-lines')?.textContent?.length>30);
 const divider=await page.evaluate(()=>{const r=document.querySelector('.terminal-resizer').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
 await page.mouse.move(divider.x,divider.y);await page.mouse.down();
 for(const dy of [-100,-220,-80,-260]){await page.mouse.move(divider.x,divider.y+dy,{steps:3});const covered=await page.evaluate(()=>{const bar=document.querySelector('.bottom-panel>.tabs'),r=bar.getBoundingClientRect(),e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !bar.contains(e)});if(covered)throw new Error('Editor painted over terminal header during resize');}
 await page.mouse.up();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.editor-container')).overflow==='hidden');
 await page.screenshot({path:SHOT_DIR+'/editor-resize-clipping.png'});
 await page.dblclick('.terminal-resizer');
 const chrome=await page.evaluate(()=>({gnb:document.querySelector('.global-header').clientHeight,title:document.querySelector('.work-header').clientHeight,fold:!!document.querySelector('.panel-layout')}));
 if(chrome.gnb>40||chrome.title>38||chrome.fold)throw new Error('Compact header or folding-panel removal regressed');
 const drag=async(selector,dx)=>{const before=await page.evaluate(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,value:Number(e.getAttribute('aria-valuenow')),min:Number(e.getAttribute('aria-valuemin')),max:Number(e.getAttribute('aria-valuemax'))};},selector);
  const expected=Math.min(before.max,Math.max(before.min,before.value+(selector.includes('자료')?dx:-dx)));
  await page.mouse.move(before.x,before.y);await page.mouse.down();await page.mouse.move(before.x+dx,before.y,{steps:8});await page.mouse.up();
  await page.waitForFunction(({s,v})=>Math.abs(Number(document.querySelector(s).getAttribute('aria-valuenow'))-v)<2,{s:selector,v:expected});return expected;};
 const left='[aria-label="자료 패널 너비 조절"]',chat='[aria-label="대화 패널 너비 조절"]';
 const leftSize=await drag(left,80),chatSize=await drag(chat,-80);
 await page.reload();await page.waitForFunction(({leftSize,chatSize})=>Math.abs(Number(document.querySelector('[aria-label="자료 패널 너비 조절"]')?.getAttribute('aria-valuenow'))-leftSize)<2&&Math.abs(Number(document.querySelector('[aria-label="대화 패널 너비 조절"]')?.getAttribute('aria-valuenow'))-chatSize)<2,{leftSize,chatSize});
 await page.focus(chat);await page.keyboard.press('End');await page.waitForFunction(()=>Math.abs(document.querySelector('.center-panel').clientWidth-280)<3);
 await page.dblclick(chat);await page.dblclick(left);
 await page.click('[aria-label="자료 패널 접기"]');await page.waitForFunction(()=>document.querySelector('.workbench').classList.contains('hide-left')&&document.querySelector('.center-panel').clientWidth>500);
 await page.click('[aria-label="자료 패널 접기"]');
 const height=await page.evaluate(()=>({body:document.documentElement.scrollHeight,viewport:innerHeight,work:document.querySelector('.workbench').clientHeight}));
 if(height.body>height.viewport+2||height.work<650)throw new Error('Workspace does not use the available viewport');
 await page.selectOption('[aria-label="화면 테마"]','dark');
 await page.screenshot({path:SHOT_DIR+'/compact-workspace.png'});
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:760,height:801,deviceScaleFactor:1,mobile:false});
 await page.waitForFunction(()=>document.querySelector('.workbench').classList.contains('overlay-left'));
 await page.click('[aria-label="자료 패널 닫기"]');await drag(chat,-45);
 await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2&&document.querySelector('.center-panel').clientWidth>=279);
 console.log(JSON.stringify({passed:true,chrome,height,checks:['compact headers','folding controls removed','both horizontal dividers','saved widths','keyboard bounds and reset','sidebar collapse','viewport fill','narrow window']}));
}catch(error){console.log(await page.snapshot());console.log(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,body:document.documentElement.scrollHeight,columns:getComputedStyle(document.querySelector('.workbench')).gridTemplateColumns})));throw error;}
finally{if(FINISH_SPACE)await task.finish({keep:[]});else await page.goto('about:blank');}
