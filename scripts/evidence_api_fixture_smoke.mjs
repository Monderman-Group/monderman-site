// Tests the outside-repository private fixture itself. Never starts the API server or calls a
// provider. Temp mutants are separate copies, not new approved source pins.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {EVIDENCE_BUNDLE,EVIDENCE_MANIFEST,EVIDENCE_EXPORTS,SITE_ROOT,digest,sha256,verifyEvidenceFixture,loadEvidenceApi,assertEvidenceFixtureNotPublished,assertPrivateFixtureEnvironment} from './evidence_api_fixture.mjs';
import {validateFixtureDestination} from './build_private_evidence_api_fixture.mjs';
const args=process.argv.slice(2),at=args.indexOf('--fixture-dir');
const requestedDirectory=at<0?process.env.MONDERMAN_EVIDENCE_FIXTURE_DIR:args[at+1];
assert.ok(requestedDirectory,'Private release gate requires an explicit outside-repository fixture directory');
const directory=path.resolve(requestedDirectory);
const baseline=verifyEvidenceFixture(directory),originalBundle=fs.readFileSync(path.join(directory,EVIDENCE_BUNDLE)),originalManifest=fs.readFileSync(path.join(directory,EVIDENCE_MANIFEST));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'monderman-evidence-fixture-guards-'));
const prefix='"use strict";\nmodule.exports = ',suffix=';\n';
const basePack=JSON.parse(originalBundle.toString().slice(prefix.length,-suffix.length));
let rejected=0;
assert.throws(()=>assertPrivateFixtureEnvironment({GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Monderman-Group/monderman-site'}),/forbidden/);rejected++;
assert.throws(()=>assertPrivateFixtureEnvironment({GITHUB_ACTIONS:'true'}),/forbidden/);rejected++;
assert.doesNotThrow(()=>assertPrivateFixtureEnvironment({GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Monderman-Group/monderman-api'}));
assert.throws(()=>verifyEvidenceFixture(),/explicit private fixture directory/);rejected++;
assert.throws(()=>verifyEvidenceFixture(SITE_ROOT),/PUBLIC repository/);rejected++;
assert.throws(()=>validateFixtureDestination({apiRoot:SITE_ROOT,outDirectory:path.join(SITE_ROOT,'test-fixtures'),historical:false}),/outside both checkouts/);rejected++;
for(const root of [SITE_ROOT,SITE_ROOT+path.sep]){
  assert.throws(()=>validateFixtureDestination({apiRoot:root,outDirectory:path.join(root,'test-fixtures'),historical:true}),/outside both checkouts/);rejected++;
}
assert.throws(()=>validateFixtureDestination({apiRoot:SITE_ROOT,outDirectory:path.join(SITE_ROOT,'.render-public','test-fixtures'),historical:true}),/publish directory/);rejected++;
const linkedSite=path.join(temporary,'linked-site');fs.symlinkSync(SITE_ROOT,linkedSite,'dir');
assert.throws(()=>validateFixtureDestination({apiRoot:SITE_ROOT,outDirectory:path.join(linkedSite,'test-fixtures'),historical:true}),/outside both checkouts/);rejected++;
assert.equal(validateFixtureDestination({apiRoot:SITE_ROOT,outDirectory:path.join(temporary,'allowed-historical'),historical:true}),path.join(fs.realpathSync(temporary),'allowed-historical'));
function mutant(label,change){
  const target=path.join(temporary,label);fs.mkdirSync(target,{mode:0o700});
  let bundle=Buffer.from(originalBundle),manifest=JSON.parse(originalManifest),pack=structuredClone(basePack);
  const rebuild=()=>{bundle=Buffer.from(prefix+JSON.stringify(pack)+suffix);manifest.bundle_sha256=sha256(bundle);};
  const state={manifest,pack,rebuild,get bundle(){return bundle;},set bundle(value){bundle=Buffer.from(value);}};
  change(state);fs.writeFileSync(path.join(target,EVIDENCE_BUNDLE),bundle,{flag:'wx',mode:0o600});fs.writeFileSync(path.join(target,EVIDENCE_MANIFEST),JSON.stringify(manifest),{flag:'wx',mode:0o600});
  assert.throws(()=>verifyEvidenceFixture(target),label+' must fail before source import');rejected++;
}
mutant('bundle-drift',s=>{s.bundle=Buffer.concat([s.bundle,Buffer.from('// unexpected mutation')]);});
mutant('source-drift',s=>{s.pack.files['server.js']=Buffer.from('changed source').toString('base64');s.rebuild();});
mutant('unsafe-path',s=>{s.pack.files['../escape.js']=s.pack.files['server.js'];s.manifest.source_files['../escape.js']=s.manifest.source_files['server.js'];s.manifest.source_count++;s.manifest.source_manifest_sha256=digest(s.manifest.source_files);s.rebuild();});
mutant('missing-required-source',s=>{delete s.pack.files['server.js'];delete s.manifest.source_files['server.js'];s.manifest.source_count--;s.manifest.source_manifest_sha256=digest(s.manifest.source_files);s.rebuild();});
mutant('unknown-export',s=>{s.manifest.exports.generatePaidReport='report-ai-service.js';});
mutant('commit-drift',s=>{s.manifest.source_commit='0'.repeat(40);});
mutant('loader-drift',s=>{s.manifest.loader_sha256='0'.repeat(64);});
mutant('builder-drift',s=>{s.manifest.builder_sha256='0'.repeat(64);});
mutant('manifest-drift',s=>{s.manifest.source_manifest_sha256='0'.repeat(64);});
mutant('executable-wrapper',s=>{s.bundle=Buffer.from(s.bundle.toString()+'throw Error("must never execute");\n');s.manifest.bundle_sha256=sha256(s.bundle);});
mutant('invalid-base64',s=>{s.pack.files['server.js']+=' ';s.rebuild();});
const api=await loadEvidenceApi({directory});
assert.equal(await loadEvidenceApi({directory}),api,'same fixture must retain module/capability identity');
assert.deepEqual(Object.keys(api).sort(),Object.keys(EVIDENCE_EXPORTS).sort());
assert.equal(Object.isFrozen(api),true);
assert.throws(()=>fetch('https://provider.invalid'),/network_forbidden/);
assert.throws(()=>http.get('https://provider.invalid'),/network_forbidden/);
const prepared=await api.prepareCurrentSamples({generatedAt:'2026-09-11T12:00:00.000Z',engineCommit:baseline.manifest.source_commit});
assert.equal(prepared.privateEvidence.jobs.length,6);
// The generator's own runtime reads and private source manifest must resolve
// to the exact files from the committed pack, not the workstation checkout.
for(const [name,hash]of Object.entries(prepared.privateEvidence.source_manifest))assert.equal(hash,baseline.manifest.source_files[name]?.sha256,'runtime source identity drift: '+name);
for(const job of prepared.privateEvidence.jobs){const plan=api.buildReportProsePlan(job.packet);assert.match(plan.catalog_sha256,/^[a-f0-9]{64}$/);}
const publicEmpty=path.join(temporary,'public-empty');fs.mkdirSync(publicEmpty);fs.writeFileSync(path.join(publicEmpty,'index.html'),'<!doctype html><title>Test</title>');
assert.equal(assertEvidenceFixtureNotPublished(publicEmpty,{fixtureDirectory:directory}).passed,true);
for(const [name,bytes]of [['renamed-api.bin',originalBundle],['renamed-metadata.json',originalManifest]]){
  const file=path.join(publicEmpty,name);fs.writeFileSync(file,bytes);assert.throws(()=>assertEvidenceFixtureNotPublished(publicEmpty,{fixtureDirectory:directory}));fs.renameSync(file,path.join(temporary,name));rejected++;
}
const publishedIndex=args.indexOf('--publish-dir');
const publicBuild=publishedIndex<0?null:assertEvidenceFixtureNotPublished(args[publishedIndex+1],{fixtureDirectory:directory});
assert.ok(fs.readFileSync(path.join(directory,EVIDENCE_BUNDLE)).equals(originalBundle));
assert.ok(fs.readFileSync(path.join(directory,EVIDENCE_MANIFEST)).equals(originalManifest));
console.log(JSON.stringify({passed:true,sourceCommit:baseline.manifest.source_commit,sourceFiles:baseline.manifest.source_count,exports:Object.keys(api).length,deterministicJobs:6,rejectedMutations:rejected,sameModuleIdentity:true,networkBlocked:true,publicBuild,providerCalls:0,limitation:'Private committed-source fixture and deterministic dry packets only; no live AI quality or deployment claim.'}));
