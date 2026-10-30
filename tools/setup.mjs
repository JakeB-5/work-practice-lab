#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),steps=[];
const flags=new Set(process.argv.slice(2));
const emit=value=>console.log(JSON.stringify(value,null,2));
const fail=(code,message)=>{emit({status:'error',code,message,steps});process.exit(1);};
if(flags.has('--help')){emit({usage:'node tools/setup.mjs [--skip-runtime-check] [--no-start]',purpose:'Install project dependencies, Chromium and a local Codex if needed; build and start the app. Preserve existing data. Authentication is the only normal human step.'});process.exit(0);}
for(const flag of flags)if(!['--skip-runtime-check','--no-start'].includes(flag))fail('INVALID_FLAG','Unknown option '+flag);
if(Number(process.versions.node.split('.')[0])<24)fail('NODE_REQUIRED','Node.js 24+ is required. The installing agent should install/switch Node and rerun setup.');
if(process.platform==='win32')fail('PLATFORM_UNVERIFIED','Native Windows execution is not supported by this setup. Use the documented macOS environment.');
function run(label,bin,args,timeout=600000){process.stderr.write('[setup] '+label+'\n');const r=spawnSync(bin,args,{cwd:root,env:process.env,encoding:'utf8',maxBuffer:16*1024*1024,timeout});if(r.status!==0){process.stderr.write((r.stderr||r.stdout||r.error?.message||'').slice(-5000));fail('SETUP_STEP_FAILED',label+' failed. Existing app data has been preserved.');}steps.push(label);return r.stdout;}
try{
 const found=spawnSync('pnpm',['--version'],{encoding:'utf8'}),pnpm=found.status===0&&found.stdout.trim()==='12.9.1'?['pnpm',[]]:['npm',['exec','--yes','--package=pnpm@12.9.1','--','pnpm']];
 const task=(label,args)=>run(label,pnpm[0],[...pnpm[1],...args]);
 task('Install locked project dependencies',['install','--frozen-lockfile']);
 task('Install validation browser',['exec','playwright','install','chromium']);
 const bundled=path.join(root,'.wpl-tools/node_modules/.bin/codex'),external=process.env.WPL_CODEX_BINARY||'codex';
 if(spawnSync(external,['--version'],{encoding:'utf8'}).status!==0&&!fs.existsSync(bundled))run('Install project-local Codex','npm',['install','--prefix',path.join(root,'.wpl-tools'),'--no-audit','--no-fund','@openai/codex@0.163.0']);
 task('Build application',['build']);
 if(flags.has('--no-start')){emit({status:'installed',steps,nextCommand:'pnpm lab start'});process.exit(0);}
 const invoke=(command)=>{const r=spawnSync(process.execPath,['--import','tsx','tools/agent-cli.ts',command],{cwd:root,env:process.env,encoding:'utf8',timeout:900000,maxBuffer:1024*1024});let output;try{output=JSON.parse(r.stdout);}catch{fail('AGENT_OUTPUT_INVALID',r.stderr||r.stdout);}if(r.status!==0&&r.status!==2)fail(output.code||'APP_FAILED',output.message||JSON.stringify(output));return output;};
 const started=invoke('start'),doctor=invoke('doctor');
 if(doctor.status==='needs_user_action'){emit({status:'needs_user_action',url:started.url,steps,reason:'Codex requires the user to complete browser authentication. The agent should run loginCommand, let the user authenticate, then run pnpm lab check-runtime.',loginCommand:doctor.loginCommand});process.exitCode=2;}
 else if(flags.has('--skip-runtime-check'))emit({status:'installed',url:started.url,steps,runtimeCheck:'not_run',nextCommand:'pnpm lab check-runtime'});
 else{const checked=invoke('check-runtime');emit({status:checked.status||'ready',url:started.url,steps,runtime:checked,theme:'system',nextRequest:'Ask your agent to create a hackathon problem, or use AI로 새 문제 만들기 in the app.'});}
}catch(e){fail('SETUP_FAILED',e.message);}
