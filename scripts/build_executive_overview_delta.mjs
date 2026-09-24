// Mechanical, exact compatibility record for the separately reviewed optional
// short-summary presentation. Never rewrites the earlier review fixture.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const beforePath=process.argv[2];
if(!beforePath || !path.isAbsolute(beforePath)) throw Error('Pass the absolute pre-edit renderer snapshot');
const root=path.resolve(import.meta.dirname,'..');
const before=fs.readFileSync(beforePath,'utf8'),after=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8');
const sha=text=>createHash('sha256').update(text).digest('hex');
if(sha(before)!=='9c3563c5ff811133da185cbedb0c53bcdea4307b60b1e395d6cd207e11e44180')throw Error('Wrong reviewed baseline');
let start=0,end=0;
while(start<before.length&&start<after.length&&before[start]===after[start])start++;
while(end<before.length-start&&end<after.length-start&&before.at(-end-1)===after.at(-end-1))end++;
const delta={before_sha256:sha(before),after_sha256:sha(after),start,current:after.slice(start,after.length-end),prior:before.slice(start,before.length-end)};
const bytes=JSON.stringify(delta,null,2)+'\n';
fs.writeFileSync(path.join(root,'scripts/fixtures/executive-overview-renderer-20260924.json'),bytes,{flag:'wx'});
console.log(JSON.stringify({fixture_sha256:sha(bytes),before_sha256:delta.before_sha256,after_sha256:delta.after_sha256}));
