import path from 'node:path';import {createApp} from '../../apps/server/src/app.ts';
const app=await createApp({repoRoot:process.cwd(),dataRoot:path.join(process.cwd(),'.wpl-data')});
try{const testId=process.argv[2];if(testId){const a=app.store.get('attempts',testId);if(a){if(a.executionMode!=='replay'||a.mode!=='developer')throw new Error('Only the named development replay may be removed');if(!['completed','abandoned'].includes(a.state)){const j=app.attempts.abandon(a.id,a.version);await app.runtime.promises.get(j.operationId);}await app.attempts.remove(a.id);}}
 const result=await app.runtime.inferenceCheck();console.log(JSON.stringify({inferenceState:result.inferenceState,capabilities:result.capabilities}));if(result.inferenceState!=='passed')process.exitCode=1;
}finally{await app.close();}
