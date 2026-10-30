import fs from 'node:fs';
import path from 'node:path';

const shellQuote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";

// This launcher supplies the attempt's startup model. A general-purpose local
// shell is not a model-policy sandbox (absolute paths and /model can bypass it).
// Keep the launcher outside submitted files and leave personal Codex config alone.
export function terminalModelPath(directory:string,binary:string|null,model:string,currentPath:string){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'codex');
 const script=binary
  ?'#!/bin/sh\nexec '+shellQuote(binary)+' --model '+shellQuote(model)+' "$@"\n'
  :'#!/bin/sh\nprintf "%s\\n" "Codex 실행 파일을 찾지 못했습니다. 연습실 연결 설정을 확인하세요." >&2\nexit 127\n';
 fs.writeFileSync(file,script,{mode:0o700});fs.chmodSync(file,0o700);
 return directory+path.delimiter+currentPath;
}
