import {describe,it,expect} from 'vitest';
import {calculateScores} from '../../apps/server/src/modules/evaluation.ts';
import {cleanRelative} from '../../apps/server/src/core.ts';
const rows=(status='rated')=>['technology','intent','cognition'].flatMap(axis=>Array.from({length:4},(_,i)=>({axis,criterionId:axis+i,status,rating:status==='rated'?i:null,evidenceIds:status==='rated'?['evi_example']:[],limitation:status==='rated'?null:'검증 근거 부족'})));
describe('honest scores and paths',()=>{
 it('calculates each axis from four independently grounded judgments',()=>{expect(calculateScores(rows())).toEqual({technology:37.5,intent:37.5,cognition:37.5,total:112.5,assessedCount:12});});
 it('rejects incomplete judgments instead of completing with null or invented zero',()=>{const r=rows();r[0]={...r[0],status:'unassessed',rating:null,evidenceIds:[],limitation:'실행 기록 없음'};expect(()=>calculateScores(r)).toThrow('최종 평가');});
 it('keeps a verified zero distinct from missing evidence',()=>{const r=rows().map(x=>({...x,rating:0}));expect(calculateScores(r).total).toBe(0);r[0].evidenceIds=[];expect(()=>calculateScores(r)).toThrow();});
 it('rejects duplicated criteria and out-of-range ratings',()=>{const r=rows();r[0].criterionId=r[1].criterionId;expect(()=>calculateScores(r)).toThrow();const other=rows();other[0].rating=5;expect(()=>calculateScores(other)).toThrow();});
 it.each(['../private','a/../../b','/etc/passwd','a\\b','x\0y'])('rejects traversal path %s',p=>expect(()=>cleanRelative(p)).toThrow());
 it('accepts Korean workspace filenames',()=>expect(cleanRelative('문서/판단.md')).toBe('문서/판단.md'));
});
