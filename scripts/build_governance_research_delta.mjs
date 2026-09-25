// Explicit fixture maintenance only: prints a candidate finite delta. This is
// not a validator or an approval operation and never changes existing fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const baseline='dc9e9aba04c24896e7f00349e39d73117d129e9f';
const sha=value=>createHash('sha256').update(value).digest('hex');
function replacements(before,after){
 let old=before.match(/[^\n]*\n|[^\n]+$/g)||[],current=after.match(/[^\n]*\n|[^\n]+$/g)||[];
 let prefix=0,baseOffset=0,suffix=0;
 while(prefix<old.length&&prefix<current.length&&old[prefix]===current[prefix]){baseOffset+=current[prefix].length;prefix++;}
 while(suffix<old.length-prefix&&suffix<current.length-prefix&&old.at(-suffix-1)===current.at(-suffix-1))suffix++;
 old=old.slice(prefix,suffix?-suffix:undefined);current=current.slice(prefix,suffix?-suffix:undefined);
 const width=current.length+1,cells=(old.length+1)*width;assert.ok(cells<=25e6);
 const lcs=new Uint32Array(cells);
 for(let i=old.length-1;i>=0;i--)for(let j=current.length-1;j>=0;j--)lcs[i*width+j]=old[i]===current[j]?1+lcs[(i+1)*width+j+1]:Math.max(lcs[(i+1)*width+j],lcs[i*width+j+1]);
 const offsets=[baseOffset];for(const line of current)offsets.push(offsets.at(-1)+line.length);
 const result=[];let i=0,j=0,startOld=0,startCurrent=0,changed=false;
 const flush=()=>{if(changed)result.push([offsets[startCurrent],offsets[j],current.slice(startCurrent,j).join(''),old.slice(startOld,i).join('')]);changed=false;};
 while(i<old.length||j<current.length){
  if(i<old.length&&j<current.length&&old[i]===current[j]){flush();i++;j++;continue;}
  if(!changed){startOld=i;startCurrent=j;changed=true;}
  if(i<old.length&&(j===current.length||lcs[(i+1)*width+j]>=lcs[i*width+j+1]))i++;else j++;
 }
 flush();return result;
}
const files={};
for(const file of ['index.html','research.html','the-unmeasured-layer.html']){
 const before=execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:32e6}),after=fs.readFileSync(path.join(root,file),'utf8');
 const changes=replacements(before,after);let restored=after;
 for(const [start,end,current,prior]of [...changes].reverse()){assert.equal(restored.slice(start,end),current);restored=restored.slice(0,start)+prior+restored.slice(end);}
 assert.equal(restored,before,file+': exact inverse reconstruction');
 files[file]={before_sha256:sha(before),after_sha256:sha(after),replacements:changes};
}
const text=JSON.stringify({version:'governance-research-20260925.1',baseline,scope:'Exact research-series layout and existing publication-link changes; no report or sample approval changes.',files},null,2)+'\n';
process.stdout.write(JSON.stringify({text,sha256:sha(text)}));
