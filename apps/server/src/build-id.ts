import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
// Capture source identity once when the server starts, so an installing agent
// never reports an old process as serving the freshly installed version.
export function applicationBuildId(root:string){
 const hash=createHash('sha256');const walk=(relative:string)=>{const full=path.join(root,relative),stat=fs.lstatSync(full);if(stat.isSymbolicLink())return;if(stat.isDirectory()){for(const child of fs.readdirSync(full).sort())if(child!=='node_modules')walk(path.join(relative,child));}else if(stat.isFile())hash.update(relative).update('\0').update(fs.readFileSync(full));};
 for(const name of ['apps','packages','index.html','package.json'])walk(name);return hash.digest('hex');
}
