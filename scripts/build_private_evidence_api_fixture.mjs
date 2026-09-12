// Deterministic private source packaging. No source import, provider call,
// database, compiler rewriting or public sample generation occurs here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {EVIDENCE_FIXTURE_CONTRACT,EVIDENCE_EXPORTS,EVIDENCE_BUNDLE,EVIDENCE_MANIFEST,SITE_ROOT,sha256,digest,safeSourcePath,verifyEvidenceFixture,assertEvidenceFixtureNotPublished,assertPrivateFixtureEnvironment} from './evidence_api_fixture.mjs';
const git=(root,args)=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
const SCORERS={OS:['configs/operationalSystemsRoutingConfig.json','diagnostics/operational-systems/legacy-adapter.v1.js','scoreOperationalSystems.js'],DV:['configs/decisionVelocityRoutingConfig.json','diagnostics/decision-velocity/legacy-adapter-dv.v1.js','scoreDecisionVelocity.js'],SC:['configs/structuralClarityRoutingConfig.json','diagnostics/structural-clarity/legacy-adapter-sc.v1.js','scoreStructuralClarity.js'],IP:['configs/institutionalPerformanceRoutingConfig.json','diagnostics/institutional-performance/legacy-adapter-ip.v1.js','scoreInstitutionalPerformance.js']};

export function validateFixtureDestination({apiRoot,outDirectory,historical=false}){
  apiRoot=fs.realpathSync(apiRoot);let existing=path.resolve(outDirectory);const missing=[];
  while(!fs.existsSync(existing)){missing.unshift(path.basename(existing));existing=path.dirname(existing);}
  const resolved=path.join(fs.realpathSync(existing),...missing);
  assert.ok(!resolved.split(path.sep).includes('.render-public'),'private fixture cannot be written into a publish directory');
  const within=root=>resolved===root||resolved.startsWith(root+path.sep);
  for(const root of [SITE_ROOT,apiRoot])assert.ok(!within(root),'private source fixture must be outside both checkouts, including this PUBLIC repository');
  return resolved;
}

export function buildPrivateEvidenceFixture({apiRoot,commit,outDirectory,historical=false,replace=false}){
  assertPrivateFixtureEnvironment();
  apiRoot=fs.realpathSync(apiRoot);outDirectory=validateFixtureDestination({apiRoot,outDirectory,historical});
  assert.match(commit,/^[a-f0-9]{40}$/,'exact committed API revision required');
  assert.equal(git(apiRoot,['rev-parse',commit+'^{commit}']).toString().trim(),commit);
  const head=git(apiRoot,['rev-parse','HEAD']).toString().trim();
  if(!historical){
    assert.equal(commit,head,'final fixture must use the current API candidate');
    assert.equal(git(apiRoot,['status','--porcelain','--untracked-files=no']).toString().trim(),'','final API source must be clean and committed');
  }
  const names=new Set(git(apiRoot,['ls-tree','-r','--name-only',commit]).toString().trim().split('\n')),files=new Map();
  function visit(name,{readOnly=false}={}){
    assert.ok(safeSourcePath(name),'unsafe source path');assert.ok(names.has(name),'uncommitted fixture dependency: '+name);
    if(files.has(name))return;
    const bytes=git(apiRoot,['show',commit+':'+name]);files.set(name,bytes);
    if(!historical)assert.ok(fs.readFileSync(path.join(apiRoot,name)).equals(bytes),'working source differs from committed source: '+name);
    if(readOnly||!/\.m?js$/.test(name))return;
    const text=bytes.toString('utf8');
    for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"\r\n]+)['"]/g)){
      const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
      assert.ok(safeSourcePath(dependency),'source dependency escaped repository');
      if(names.has(dependency))visit(dependency);
    }
  }
  // server.js is data for the existing verbatim finalizer extraction, not an
  // executable entry point; never start Express or traverse its integrations.
  visit('server.js',{readOnly:true});visit('package.json',{readOnly:true});
  for(const name of [...new Set(Object.values(EVIDENCE_EXPORTS)),'certification/current-product-sample-ai.mjs','certification/run-current-product-sample-ai.mjs','routes/crossDiagnosticSynthesis.js',...Object.values(SCORERS).flat()])visit(name);
  const sorted=[...files].sort(([a],[b])=>a.localeCompare(b,'en'));
  const sourceFiles=Object.fromEntries(sorted.map(([name,bytes])=>[name,{sha256:sha256(bytes),bytes:bytes.length}]));
  const packed={contract:EVIDENCE_FIXTURE_CONTRACT,source_commit:commit,files:Object.fromEntries(sorted.map(([name,bytes])=>[name,bytes.toString('base64')]))};
  const bytes=Buffer.from('"use strict";\nmodule.exports = '+JSON.stringify(packed)+';\n');
  const manifest={contract:EVIDENCE_FIXTURE_CONTRACT,source_repository:'Monderman-Group/monderman-api',source_commit:commit,
    source_count:sorted.length,source_files:sourceFiles,source_manifest_sha256:digest(sourceFiles),bundle_file:EVIDENCE_BUNDLE,bundle_sha256:sha256(bytes),
    loader_sha256:sha256(fs.readFileSync(new URL('./evidence_api_fixture.mjs',import.meta.url))),builder_sha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),exports:EVIDENCE_EXPORTS,
    purpose:'Private offline engine/render regression fixture. Synthetic data only; not a paid-output or production-readiness certification.'};
  fs.mkdirSync(outDirectory,{recursive:true,mode:0o700});
  const outputs=[[EVIDENCE_BUNDLE,bytes],[EVIDENCE_MANIFEST,Buffer.from(JSON.stringify(manifest,null,2)+'\n')]];
  for(const [name]of outputs){
    const file=path.join(outDirectory,name);
    if(fs.existsSync(file))assert.ok(replace&&fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink(),'explicit --replace needed for existing fixture');
  }
  for(const [name,content]of outputs){
    const file=path.join(outDirectory,name);
    fs.writeFileSync(file,content,{flag:replace?'w':'wx',mode:0o600});
  }
  verifyEvidenceFixture(outDirectory);
  return {passed:true,sourceCommit:commit,files:sorted.length,bundleSha256:manifest.bundle_sha256,directory:outDirectory,historicalFixture:historical,networkRequests:0};
}

if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
  const args=process.argv.slice(2),value=key=>{const i=args.indexOf(key);return i<0?null:args[i+1];};
  const directory=value('--out');
  assert.ok(directory,'Explicit --out outside both checkouts is required; this SITE repository is PUBLIC');
  if(args.includes('--check')){
    const {manifest}=verifyEvidenceFixture(directory);
    const publicDirectory=value('--publish-dir');
    console.log(JSON.stringify(publicDirectory?assertEvidenceFixtureNotPublished(publicDirectory,{fixtureDirectory:directory}):{passed:true,sourceCommit:manifest.source_commit,files:manifest.source_count}));
  }else{
    assert.ok(args.includes('--write')&&value('--api-root')&&value('--commit'),'--write --api-root PATH --commit EXACT_SHA required');
    console.log(JSON.stringify(buildPrivateEvidenceFixture({apiRoot:value('--api-root'),commit:value('--commit'),outDirectory:directory,historical:args.includes('--historical'),replace:args.includes('--replace')})));
  }
}
