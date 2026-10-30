import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),base=path.dirname(require.resolve('node-pty/package.json'));
if(process.platform==='darwin'){
 for(const relative of ['prebuilds/'+process.platform+'-'+process.arch+'/spawn-helper','build/Release/spawn-helper']){const file=path.join(base,relative);if(fs.existsSync(file))fs.chmodSync(file,0o755);}
}
