// PUBLIC repository gate. No private source or source manifest is needed to
// detect the known source-pack format, including renamed/index-only copies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const SITE=fs.realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const marker=['monderman','private','api','fixture'].join('-')+'/v1';
const payloadMarker=new RegExp('"contract"\\s*:\\s*"'+marker+'"');
const forbiddenNames=new Set(['evidence-api.cjs','evidence-api.manifest.json']);
export function assertNoPrivateSourcePayload(name,bytes){
  assert.ok(!forbiddenNames.has(path.basename(name)),'Private API fixture filename in public material: '+name);
  assert.ok(!payloadMarker.test(bytes.toString('utf8')),'Private API source-pack payload or manifest in public material: '+name);
}
export function scanPublicDirectory(directory,{workingTree=false}={}){
  const root=fs.realpathSync(directory);let checked=0;
  function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(workingTree&&['.git','node_modules'].includes(entry.name))continue;
    const file=path.join(dir,entry.name),relative=path.relative(root,file);
    assertNoPrivateSourcePayload(relative,Buffer.alloc(0));
    assert.ok(!entry.isSymbolicLink(),'Unexpected symbolic link in public material: '+relative);
    if(entry.isDirectory())visit(file);
    else if(entry.isFile()){assertNoPrivateSourcePayload(relative,fs.readFileSync(file));checked++;}
  }}
  visit(root);return checked;
}
// Batch framing is checked against independent git metadata before any payload
// is scanned. This keeps the complete index gate bounded as reviewed audio grows.
export const INDEX_BATCH_TARGET = 32 * 1024 * 1024;
export const INDEX_BLOB_MAX = 128 * 1024 * 1024;
export function indexObjectBatches(metadata) {
  const batches=[];let batch=[],framedBytes=0;
  for(const row of metadata){
    assert.ok(Number.isSafeInteger(row.size)&&row.size>=0&&row.size<=INDEX_BLOB_MAX,'Indexed blob exceeds bounded scan limit: '+row.oid);
    const bytes=Buffer.byteLength(`${row.oid} blob ${row.size}\n`)+row.size+1;
    if(batch.length&&framedBytes+bytes>INDEX_BATCH_TARGET){batches.push({rows:batch,framedBytes});batch=[];framedBytes=0;}
    batch.push(row);framedBytes+=bytes;
  }
  if(batch.length)batches.push({rows:batch,framedBytes});
  return batches;
}
export function scanPublicIndex(root=SITE){
  const entries=execFileSync('git',['ls-files','--stage','-z'],{cwd:root}).toString().split('\0').filter(Boolean).map(line=>{
    const match=line.match(/^([0-7]+) ([a-f0-9]+) ([0-3])\t([\s\S]+)$/);assert.ok(match,'Unexpected index entry');
    const [,mode,oid,stage,name]=match;assert.equal(stage,'0','Unresolved index conflict: '+name);
    assertNoPrivateSourcePayload(name,Buffer.alloc(0));assert.notEqual(mode,'120000','Symlink in public index: '+name);return {oid,name};
  });
  const objects=[...new Set(entries.map(e=>e.oid))],namesById=new Map(objects.map(oid=>[oid,[]]));
  for(const entry of entries)namesById.get(entry.oid).push(entry.name);
  if(!objects.length)return 0;
  const metadataLines=execFileSync('git',['cat-file','--batch-check'],{cwd:root,input:objects.join('\n')+'\n',maxBuffer:Math.max(1024*1024,objects.length*256)}).toString().trimEnd().split('\n');
  assert.equal(metadataLines.length,objects.length,'Every unique indexed object has one metadata row');
  const metadata=metadataLines.map((line,index)=>{
    const match=line.match(/^([a-f0-9]+) blob ([0-9]+)$/);assert.ok(match,'Expected indexed blob metadata');
    assert.equal(match[1],objects[index],'Metadata object order and identity');
    const size=Number(match[2]);assert.ok(Number.isSafeInteger(size)&&size>=0&&size<=INDEX_BLOB_MAX,'Indexed blob exceeds bounded scan limit: '+match[1]);
    return {oid:match[1],size};
  });
  const scanned=new Set();
  for(const batch of indexObjectBatches(metadata)){
    const packed=execFileSync('git',['cat-file','--batch'],{cwd:root,input:batch.rows.map(row=>row.oid).join('\n')+'\n',maxBuffer:batch.framedBytes+1});
    assert.equal(packed.length,batch.framedBytes,'Complete bounded batch framing length');let offset=0;
    for(const row of batch.rows){
      const end=packed.indexOf(10,offset);assert.ok(end>=offset,'Complete git object header');
      assert.equal(packed.subarray(offset,end).toString(),`${row.oid} blob ${row.size}`,'Exact independently declared indexed blob header');offset=end+1;
      const bytes=packed.subarray(offset,offset+row.size);assert.equal(bytes.length,row.size,'Complete indexed payload');offset+=row.size;
      assert.equal(packed[offset],10,'Complete git blob delimiter');offset++;
      assert.ok(!scanned.has(row.oid),'No indexed object scanned twice');
      for(const name of namesById.get(row.oid))assertNoPrivateSourcePayload(name,bytes);
      scanned.add(row.oid);
    }
    assert.equal(offset,packed.length,'No unread or trailing indexed blob bytes');
  }
  assert.deepEqual([...scanned],objects,'Every unique indexed blob scanned once, in original order');
  return entries.length;
}
export function sourceAbsenceGuardSelfTest(){
  let rejected=0;const payload=Buffer.from(JSON.stringify({contract:marker,files:{'FAKE.txt':'Tk9ULUFQSS1TT1VSQ0U='}}));
  for(const [name,bytes]of [['nested/evidence-api.cjs',Buffer.from('not private data')],['nested/evidence-api.manifest.json',Buffer.from('{}')],['renamed.bin',payload],['renamed-pretty.json',Buffer.from(JSON.stringify({contract:marker},null,2))]]){assert.throws(()=>assertNoPrivateSourcePayload(name,bytes));rejected++;}
  // Actual index-only negative: staged fabricated marker, clean working file.
  // This temporary repository is unrelated to the real checkout's index.
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'public-source-absence-guards-'));
  execFileSync('git',['init','--quiet',temporary]);fs.writeFileSync(path.join(temporary,'renamed.bin'),payload);execFileSync('git',['add','renamed.bin'],{cwd:temporary});fs.writeFileSync(path.join(temporary,'renamed.bin'),'clean working copy');
  assert.equal(scanPublicDirectory(temporary,{workingTree:true}),1);assert.throws(()=>scanPublicIndex(temporary));rejected++;
  execFileSync('git',['add','renamed.bin'],{cwd:temporary});assert.equal(scanPublicIndex(temporary),1);
  const build=path.join(temporary,'build');fs.mkdirSync(build);fs.writeFileSync(path.join(build,'renamed.dat'),payload);assert.throws(()=>scanPublicDirectory(build));rejected++;
  fs.renameSync(path.join(build,'renamed.dat'),path.join(temporary,'FAKE-marker-rejected.dat'));fs.symlinkSync(temporary,path.join(build,'outside'));assert.throws(()=>scanPublicDirectory(build));rejected++;
  assertNoPrivateSourcePayload('public-safe.json',Buffer.from('{"status":"MOCK presentation data only"}'));
  return rejected;
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
  const args=process.argv.slice(2),at=args.indexOf('--publish-dir');
  const rejectedMutations=sourceAbsenceGuardSelfTest();
  const workingFiles=scanPublicDirectory(SITE,{workingTree:true}),indexedFiles=scanPublicIndex();
  const publishedFiles=at<0?null:scanPublicDirectory(args[at+1]);
  console.log(JSON.stringify({passed:true,rejectedMutations,workingFiles,indexedFiles,publishedFiles,privateSourceLoaded:false,providerCalls:0,limitation:'Known source-pack filenames/payloads and index-only copies are rejected. Exact private-source hash comparison remains a separate outside-repository release gate.'}));
}
