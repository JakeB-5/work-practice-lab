import path from 'node:path';
import {createApp} from './app.ts';
const repoRoot=process.cwd(),instance=await createApp({repoRoot,dataRoot:path.resolve(process.env.WPL_DATA_DIR||'.wpl-data'),port:Number(process.env.PORT||4310),dev:process.env.NODE_ENV==='development'});
const url=await instance.listen();console.log('Work Practice Lab: '+url);
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,async()=>{await instance.close();process.exit(0);});
