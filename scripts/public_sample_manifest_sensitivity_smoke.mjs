// Offline sensitivity of the reviewed public sample adapter. The eventual
// actual reviewed baseline must pass first. Every mutant keeps all unrelated
// original bytes and NEVER recomputes an approval or provenance digest.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const args=process.argv.slice(2);
assert.ok(args.includes('--check'),'Explicit read-only --check required');
const rootAt=args.indexOf('--root');
const root=path.resolve(rootAt>=0?args[rootAt+1]:fileURLToPath(new URL('../',import.meta.url)));
const artifactName='sample-data/production-diagnostic-samples.json';
const manifestName='sample-data/production-sample-release.json';
const adapterName='scripts/public_sample_fixture.mjs';
const sourceNames=[
  'monderman-report.js','participant-evidence-safety.js','public-sample-model.js','sample-report-production.js',
  'scripts/refresh_public_sample_previews.mjs','scripts/templates/home-workspace-preview.html',
];
const names=[artifactName,manifestName,adapterName,...sourceNames];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const baselineBytes=new Map(names.map(name=>[name,fs.readFileSync(path.join(root,name))]));
const baselineArtifact=JSON.parse(baselineBytes.get(artifactName));
const baselineManifest=JSON.parse(baselineBytes.get(manifestName));
const pins=Object.fromEntries([...baselineBytes].map(([name,bytes])=>[name,sha(bytes)]));
const keys=['operational_systems','decision_velocity','structural_clarity','institutional_performance','depth_synthesis','cross_lens_synthesis'];
assert.deepEqual(Object.keys(baselineArtifact.outputs||{}).sort(),[...keys].sort());
const result=entry=>entry.kind==='diagnostic'&&entry.source?.result?.tool_type?entry.source.result:entry.source;
const changedHash=value=>{
  assert.match(value,/^[a-f0-9]{64}$/);
  return (value[0]==='0'?'1':'0')+value.slice(1);
};
const older=value=>{
  assert.ok(Number.isFinite(Date.parse(value)));
  return new Date(Date.parse(value)-24*60*60*1000).toISOString();
};
const clone=value=>structuredClone(value);
const output=fs.mkdtempSync(path.join(os.tmpdir(),'monderman-public-sample-sensitivity-'));
const rows=[];
const receipt={
  passed:false,scope:'Only isolated temporary copies of the actual reviewed public artifact, manifest and display sources.',
  sourceRoot:root,temporaryRoot:output,baselineSourcePins:pins,baseline:null,mutations:rows,
  providerCalls:0,networkRequests:0,approvalDigestsRecomputed:0,
  limitation:'Artifact mutations must fail the outer exact-byte pin before later semantic checks. These cases prove drift rejection, not isolated coverage of every deeper predicate. Manifest/source-pin cases additionally exercise their binding gates. No pin is recomputed to admit a mutation.',
};
const save=()=>fs.writeFileSync(path.join(output,'SENSITIVITY_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
function prepare(label,mutate) {
  const directory=path.join(output,label);
  fs.mkdirSync(directory);
  for(const [name,bytes]of baselineBytes) {
    const filename=path.join(directory,name);
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,bytes,{flag:'wx',mode:0o600});
  }
  if(mutate)mutate(directory);
  return directory;
}
function run(directory) {
  // No API keys, account tokens or model credentials are forwarded.
  const env={PATH:process.env.PATH||'',TZ:'UTC',LANG:'C.UTF-8'};
  const child=spawnSync(process.execPath,[path.join(directory,adapterName),'--check','--root',directory],{
    cwd:directory,env,encoding:'utf8',timeout:20000,maxBuffer:1024*1024,
  });
  assert.ifError(child.error);
  assert.equal(child.signal,null,'validator terminated instead of returning a result');
  return {status:child.status,stdout:child.stdout||'',stderr:child.stderr||''};
}
function artifactMutation(label,mutate) {
  return {label,layer:'artifact-byte-binding',expected:'public artifact bytes differ from the reviewed release',mutate(directory){
    const artifact=clone(baselineArtifact);mutate(artifact);
    assert.notEqual(JSON.stringify(artifact),JSON.stringify(baselineArtifact),label+' must change the intended value');
    fs.writeFileSync(path.join(directory,artifactName),JSON.stringify(artifact,null,2)+'\n');
    assert.equal(sha(fs.readFileSync(path.join(directory,manifestName))),pins[manifestName],label+' may not rewrite approval pins');
  }};
}
function manifestMutation(label,expected,mutate) {
  return {label,layer:'manifest-binding',expected,mutate(directory){
    const manifest=clone(baselineManifest);mutate(manifest);
    assert.notEqual(JSON.stringify(manifest),JSON.stringify(baselineManifest),label+' must change a review field');
    fs.writeFileSync(path.join(directory,manifestName),JSON.stringify(manifest,null,2)+'\n');
    assert.equal(sha(fs.readFileSync(path.join(directory,artifactName))),pins[artifactName],label+' may not rewrite approved content');
  }};
}
const cases=[];
for(const key of keys) {
  if(!key.endsWith('_synthesis'))cases.push(artifactMutation(key+'-score-drift',a=>{
    const r=result(a.outputs[key]);assert.equal(typeof r.score,'number');r.score=r.score===100?99:r.score+1;
  }));
  cases.push(artifactMutation(key+'-AI-removed',a=>{assert.ok(result(a.outputs[key]).ai_report);delete result(a.outputs[key]).ai_report;}));
  cases.push(artifactMutation(key+'-AI-stale-time',a=>{
    const report=result(a.outputs[key]).ai_report.report;report.generated_at=older(report.generated_at);
  }));
  cases.push(artifactMutation(key+'-provenance-stale-time',a=>{
    a.outputs[key].provenance.generated_at=older(a.outputs[key].provenance.generated_at);
  }));
  cases.push(artifactMutation(key+'-source-hash-drift',a=>{
    const p=a.outputs[key].provenance;p.public_source_sha256=changedHash(p.public_source_sha256);
  }));
  cases.push(manifestMutation(key+'-approved-output-pin-drift',key+' provenance differs from the reviewed receipt',m=>{
    const p=m.outputs[key].provenance;p.approved_output_sha256=changedHash(p.approved_output_sha256);
  }));
}
for(const key of ['depth_synthesis','cross_lens_synthesis']) {
  cases.push(artifactMutation(key+'-fabricated-participants',a=>{
    const r=result(a.outputs[key]);assert.equal(r.participant_count,null);r.participant_count=r.submitted_run_count;
  }));
  cases.push(artifactMutation(key+'-fabricated-respondents',a=>{
    const r=result(a.outputs[key]);assert.equal(r.respondent_count,null);r.respondent_count=r.submitted_run_count;
  }));
  cases.push(artifactMutation(key+'-compounded-economics',a=>{
    const r=result(a.outputs[key]),e=r.pathway_exposure||r.compounded_exposure;
    assert.ok(['available','partial'].includes(e.status));assert.equal(e.not_compounded,true);e.not_compounded=false;
    // Do not invent a favorable estimate: change only the non-compounding guard.
  }));
}
cases.push(
  artifactMutation('artifact-digest-drift',a=>{a.artifact_sha256=changedHash(a.artifact_sha256);}),
  artifactMutation('artifact-generation-stale',a=>{a.generated_at=older(a.generated_at);}),
  artifactMutation('artifact-not-synthetic',a=>{assert.equal(a.synthetic,true);a.synthetic=false;}),
  artifactMutation('missing-sixth-product',a=>{delete a.outputs.cross_lens_synthesis;}),
  artifactMutation('pending-review-artifact',a=>{a.status='provider_review_complete_pending_human_fidelity_review';}),
  manifestMutation('manifest-artifact-file-pin-drift','public artifact bytes differ from the reviewed release',m=>{m.artifact_file_sha256=changedHash(m.artifact_file_sha256);}),
  manifestMutation('manifest-review-not-passed','actual six-output fidelity review is required',m=>{m.fidelity_review='pending';}),
  manifestMutation('manifest-reviewer-misattributed','review must not be attributed to Jason',m=>{m.reviewed_by='Jason';}),
  manifestMutation('manifest-generation-pin-drift',null,m=>{m.generated_at=older(m.generated_at);}),
);
for(const name of sourceNames) {
  cases.push(manifestMutation('manifest-source-pin-'+path.basename(name),'reviewed source changed: '+name,m=>{
    m.source_files[name]=changedHash(m.source_files[name]);
  }));
  cases.push({
    label:'source-byte-drift-'+path.basename(name),layer:'source-byte-binding',expected:'reviewed source changed: '+name,
    mutate(directory) {
      const suffix=name.endsWith('.html')?'\n<!-- sensitivity mutation only -->\n':'\n// sensitivity mutation only\n';
      fs.appendFileSync(path.join(directory,name),suffix);
      assert.equal(sha(fs.readFileSync(path.join(directory,manifestName))),pins[manifestName]);
      assert.equal(sha(fs.readFileSync(path.join(directory,artifactName))),pins[artifactName]);
    },
  });
}
assert.equal(cases.length,59,'bounded sensitivity inventory changed; review before expanding');
assert.equal(new Set(cases.map(item=>item.label)).size,cases.length);
try {
  const baseline=run(prepare('baseline'));
  receipt.baseline={exitStatus:baseline.status};
  assert.equal(baseline.status,0,'Actual reviewed baseline must pass before any mutations: '+baseline.stderr.slice(-1600));
  const summary=JSON.parse(baseline.stdout.trim().split('\n').at(-1));
  assert.equal(summary.passed,true);assert.equal(summary.products,6);
  receipt.baseline={...receipt.baseline,engine_commit:summary.engine_commit,artifact_sha256:summary.artifact_sha256};
  save();
  for(const item of cases) {
    const tested=run(prepare(item.label,item.mutate));
    assert.notEqual(tested.status,0,item.label+' unexpectedly passed');
    assert.match(tested.stderr,/AssertionError/,'failure was not a validation assertion: '+item.label);
    if(item.expected)assert.ok(tested.stderr.includes(item.expected),item.label+' rejected for an unexpected reason');
    assert.doesNotMatch(tested.stderr,/ENOENT|MODULE_NOT_FOUND|SyntaxError|ReferenceError|TypeError/,'harness setup error must not count as rejection');
    rows.push({case:item.label,layer:item.layer,rejected:true,exitStatus:tested.status,expectedGate:item.expected||'manifest generation equality'});
    save();
  }
  for(const [name,pin]of Object.entries(pins))assert.equal(sha(fs.readFileSync(path.join(root,name))),pin,'source changed during sensitivity run: '+name);
  receipt.passed=true;save();
  console.log(JSON.stringify({passed:true,baselineProducts:6,rejected:rows.length,temporaryRoot:output,receipt:path.join(output,'SENSITIVITY_RECEIPT.json'),providerCalls:0,networkRequests:0,approvalDigestsRecomputed:0}));
} catch(error) {
  receipt.failure=String(error.message).slice(0,1800);save();throw error;
}
// Deliberately preserve the validated baseline, mutant copies and receipt in the
// exact mkdtemp directory. No cleanup can erase original checkout or evidence.
