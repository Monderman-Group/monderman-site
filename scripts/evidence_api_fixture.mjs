// Private local/API-CI source fixture. Never usable in public SITE CI.
// Exact committed API files are unpacked without
// transpilation so dynamic imports and verbatim route extraction stay intact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {syncBuiltinESMExports} from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';

export const EVIDENCE_FIXTURE_CONTRACT='monderman-private-api-fixture/v1';
export const EVIDENCE_EXPORTS=Object.freeze({
  prepareCurrentSamples:'certification/current-product-samples.mjs',
  buildReportProsePlan:'report-prose-output.js',
  REPORT_PROSE_VERSION:'report-prose-output.js',
  buildReportAIComposition:'report-ai-composition.js',
  evaluateCampaignReadiness:'campaign-evidence-readiness.js',
  reviewCampaignQuality:'campaign-quality-review.js',
  createCampaignReviewPreview:'campaign-quality-review.js',
  campaignInterventionOptions:'campaign-intervention-options.js',
  publicAIState:'certification/public-sample-projection.mjs',
});
export const EVIDENCE_BUNDLE='evidence-api.cjs';
export const EVIDENCE_MANIFEST='evidence-api.manifest.json';
export const SITE_ROOT=fs.realpathSync(fileURLToPath(new URL('../',import.meta.url)));
export const sha256=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const digest=value=>sha256(JSON.stringify(canonical(value)));
export const safeSourcePath=name=>typeof name==='string'&&/^[A-Za-z0-9_.\/-]+$/.test(name)&&!name.startsWith('/')&&!name.split('/').some(part=>!part||part==='.'||part==='..');
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function assertPrivateFixtureEnvironment(env=process.env){
  if(env.GITHUB_ACTIONS==='true')assert.equal(env.GITHUB_REPOSITORY,'Monderman-Group/monderman-api','Private engine loading/packaging is forbidden in public SITE CI');
}

export function verifyEvidenceFixture(directory) {
  assertPrivateFixtureEnvironment();
  assert.ok(typeof directory==='string'&&directory.trim(),'An explicit private fixture directory outside this PUBLIC repository is required');
  const root=fs.realpathSync(directory);
  assert.ok(root!==SITE_ROOT&&!root.startsWith(SITE_ROOT+path.sep),'Private API source may not be loaded from this PUBLIC repository');
  const manifestFile=path.join(root,EVIDENCE_MANIFEST),bundleFile=path.join(root,EVIDENCE_BUNDLE);
  for(const file of [manifestFile,bundleFile])assert.ok(fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'fixture must be a regular private file');
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')),bytes=fs.readFileSync(bundleFile);
  assert.equal(manifest.contract,EVIDENCE_FIXTURE_CONTRACT);
  assert.equal(manifest.source_repository,'Monderman-Group/monderman-api');
  assert.match(manifest.source_commit,/^[a-f0-9]{40}$/);
  assert.equal(manifest.bundle_file,EVIDENCE_BUNDLE);
  assert.equal(manifest.bundle_sha256,sha256(bytes),'private API bundle bytes changed');
  assert.equal(manifest.loader_sha256,sha256(fs.readFileSync(fileURLToPath(import.meta.url))),'private API loader changed; rebuild the fixture');
  assert.equal(manifest.builder_sha256,sha256(fs.readFileSync(new URL('./build_private_evidence_api_fixture.mjs',import.meta.url))),'private API fixture builder changed; rebuild the fixture');
  assert.deepEqual(manifest.exports,EVIDENCE_EXPORTS);
  assert.ok(manifest.source_files&&typeof manifest.source_files==='object');
  assert.equal(manifest.source_count,Object.keys(manifest.source_files).length);
  assert.equal(manifest.source_manifest_sha256,digest(manifest.source_files));
  assert.ok(manifest.source_count>0);
  for(const [name,record]of Object.entries(manifest.source_files)){
    assert.ok(safeSourcePath(name),'unsafe private source path');
    assert.ok(validHash(record.sha256)&&Number.isSafeInteger(record.bytes)&&record.bytes>0,'invalid private source pin');
  }
  // Data-only CJS is parsed, not executed. A changed prefix/suffix cannot run
  // even if somebody incorrectly recalculates the outer bundle digest.
  const prefix='"use strict";\nmodule.exports = ',suffix=';\n';
  const text=bytes.toString('utf8');assert.ok(text.startsWith(prefix)&&text.endsWith(suffix),'unexpected executable fixture wrapper');
  const packed=JSON.parse(text.slice(prefix.length,-suffix.length));
  assert.equal(packed.contract,manifest.contract);assert.equal(packed.source_commit,manifest.source_commit);
  assert.deepEqual(Object.keys(packed.files).sort(),Object.keys(manifest.source_files).sort());
  const files=new Map();
  for(const [name,encoded]of Object.entries(packed.files)){
    assert.equal(typeof encoded,'string');const value=Buffer.from(encoded,'base64');
    assert.equal(value.toString('base64'),encoded,'source encoding is not canonical');
    assert.equal(value.length,manifest.source_files[name].bytes,'private source size changed: '+name);
    assert.equal(sha256(value),manifest.source_files[name].sha256,'private source bytes changed: '+name);
    files.set(name,value);
  }
  for(const name of [...new Set(Object.values(EVIDENCE_EXPORTS)),'server.js','routes/crossDiagnosticSynthesis.js','package.json'])assert.ok(files.has(name),'required exact API source missing: '+name);
  return {directory:root,manifest,files};
}

let networkBlocked=false;
function forbidNodeNetwork(){
  if(networkBlocked)return;networkBlocked=true;
  const blocked=()=>{throw new Error('private_evidence_fixture_network_forbidden');};
  globalThis.fetch=blocked;
  for(const [module,names]of [[http,['request','get']],[https,['request','get']],[net,['connect','createConnection']],[tls,['connect']],[dgram,['createSocket']]])for(const name of names)module[name]=blocked;
  syncBuiltinESMExports();
}
// One verified source root per process avoids duplicate module identities and
// competing in-memory capabilities when two harnesses import this loader.
let loadedPromise=null,loadedBinding=null;
export async function loadEvidenceApi({directory=process.env.MONDERMAN_EVIDENCE_FIXTURE_DIR}={}) {
  assertPrivateFixtureEnvironment();
  const verified=verifyEvidenceFixture(directory),binding=digest(verified.manifest);
  assert.ok(!process.env.MONDERMAN_API_ROOT,'Unpinned sibling API loading is disabled; build a committed private fixture instead');
  if(loadedPromise){assert.equal(binding,loadedBinding,'a different API fixture is already loaded in this process');return loadedPromise;}
  loadedBinding=binding;forbidNodeNetwork();
  loadedPromise=(async()=>{
    const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'monderman-private-evidence-api-'));fs.chmodSync(temporary,0o700);
    for(const [name,bytes]of verified.files){const file=path.join(temporary,name);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});}
    const modules=new Map();
    for(const name of new Set(Object.values(EVIDENCE_EXPORTS)))modules.set(name,await import(pathToFileURL(path.join(temporary,name))));
    const exposed={};
    for(const [name,file]of Object.entries(EVIDENCE_EXPORTS)){const value=modules.get(file)[name];assert.ok(name==='REPORT_PROSE_VERSION'?typeof value==='string':typeof value==='function','missing fixture export: '+name);exposed[name]=value;}
    // Keep the private directory until process exit: dynamic imports and exact
    // source reads happen during later calls. It is never a publish artifact.
    return Object.freeze(exposed);
  })();
  return loadedPromise;
}

export function assertEvidenceFixtureNotPublished(publishDirectory,{fixtureDirectory=process.env.MONDERMAN_EVIDENCE_FIXTURE_DIR}={}) {
  const {manifest}=verifyEvidenceFixture(fixtureDirectory),root=fs.realpathSync(publishDirectory);
  assert.ok(fs.statSync(root).isDirectory());
  const privateHashes=new Set([manifest.bundle_sha256,...Object.values(manifest.source_files).map(row=>row.sha256)]);
  let checked=0;
  function visit(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const name=path.join(directory,entry.name);
    assert.ok(!entry.isSymbolicLink(),'unexpected symbolic link in public build');
    assert.ok(!['test-fixtures',EVIDENCE_BUNDLE,EVIDENCE_MANIFEST].includes(entry.name),'private API fixture copied into public build');
    if(entry.isDirectory())visit(name);else if(entry.isFile()){
      const bytes=fs.readFileSync(name);checked++;
      assert.notEqual(sha256(bytes),manifest.bundle_sha256,'renamed private bundle copied into public build');
      // Some legitimately public safety files are shared with the API. Only
      // reject source bytes unique to this private engine dependency pack.
      if(privateHashes.has(sha256(bytes))){const relative=path.relative(root,name),siteFile=path.join(SITE_ROOT,relative);assert.ok(fs.existsSync(siteFile)&&fs.readFileSync(siteFile).equals(bytes),'private API source copied into public build: '+relative);}
      if(bytes.length<1000000)assert.ok(!bytes.includes(Buffer.from(EVIDENCE_FIXTURE_CONTRACT)),'private fixture metadata copied into public build');
    }
  }}
  visit(root);return {passed:true,publicFilesChecked:checked,sourceCommit:manifest.source_commit};
}
