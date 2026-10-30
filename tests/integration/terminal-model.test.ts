import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createApp} from '../../apps/server/src/app.ts';

let root:string,app:Awaited<ReturnType<typeof createApp>>,attempt:any,binary:string;
beforeAll(async()=>{
 root=fs.mkdtempSync(path.join(os.tmpdir(),"wpl-terminal's model-"));
 app=await createApp({repoRoot:process.cwd(),dataRoot:path.join(root,'data')});
 binary=path.join(root,'fake codex');
 fs.writeFileSync(binary,'#!'+process.execPath+'\nconsole.log(JSON.stringify({selectedArgs:process.argv.slice(2)}));\n',{mode:0o700});
 app.runtime.binary=binary;app.runtime.model='gpt-6-astra';
 const base=app.scenarios.list().find(s=>s.scenarioId==='retail-coaching')!;
 const scenario=app.scenarios.author(base.versionId,{version:'9.0.0',allowedModels:['gpt-6.1-sol']});
 attempt=app.attempts.create({scenarioVersionId:scenario.versionId,mode:'practice',executionMode:'replay',priorSolutionSeen:false});
 await app.runtime.promises.get(app.attempts.prepare(attempt.id,attempt.version).operationId);
 attempt=app.store.requireAttempt(attempt.id);
 await app.runtime.promises.get(app.attempts.start(attempt.id,attempt.version).operationId);
});
afterAll(async()=>{await app.close();fs.rmSync(root,{recursive:true,force:true});});
function output(processId:string){return app.store.all('events',"attempt_id=? AND event_type='terminal.output' ORDER BY seq",[attempt.id]).filter(e=>e.payload.processId===processId).map(e=>e.payload.text).join('');}
it('bare codex in the actual PTY uses the frozen attempt model and configured binary',async()=>{
 const terminal=await app.workspace.terminal(attempt.id);
 app.workspace.input(attempt.id,terminal.id,'codex --version\r');
 await expect.poll(()=>output(terminal.id)).toContain('{"selectedArgs":["--model","gpt-6.1-sol","--version"]}');
 expect(fs.existsSync(path.join(app.workspace.root(attempt.id),'terminal-bin'))).toBe(false);
 expect(app.store.requireAttempt(attempt.id).model).toBe('gpt-6.1-sol');
 await app.workspace.stop(terminal.id);
});
it('keeps the shell usable and reports a missing configured binary instead of using another codex',async()=>{
 app.runtime.binary=path.join(root,'missing-codex');
 const terminal=await app.workspace.terminal(attempt.id);
 app.workspace.input(attempt.id,terminal.id,'codex --version\r');
 await expect.poll(()=>output(terminal.id)).toContain('Codex 실행 파일을 찾지 못했습니다.');
 app.workspace.input(attempt.id,terminal.id,'printf "SHELL_%s_OK\\n" usable\r');
 await expect.poll(()=>output(terminal.id)).toContain('SHELL_usable_OK');
 await app.workspace.stop(terminal.id);
});
