// Offline exact-copy compatibility. No claims, admissions, provider calls,
// mail, campaign controls, approval digest updates, or publication actions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {BRAND_REFRESH_BASELINE,BRAND_REFRESH_VERSION,BRAND_REFRESH_FILES,brandRefreshDelta,sourceBeforeBrandRefresh20261007,sourceAtBrandRefreshBaseline} from './brand_refresh_20261007_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file));
const prior=file=>execFileSync('git',['show',BRAND_REFRESH_BASELINE+':'+file],{cwd:root,maxBuffer:32e6});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
eq(BRAND_REFRESH_BASELINE,'d4ce7246e7f2ce15e0ee01ea7f611a2199845e39','Exact already-deployed baseline');
eq(BRAND_REFRESH_VERSION,'brand-refresh-20261007.1','Independent current presentation version');
eq(BRAND_REFRESH_FILES,['index.html','site-shell/footer.html','canonical-site-shell.js','trenches-not-silos.html','hold-collide-come-apart.html','scripts/inject-public-shell.mjs','scripts/runtime_asset_release_build_smoke.mjs','public-search-index.json'],'Finite eight-file source whitelist');
const allowed=new Map([
  ['Less bureaucracy. Better performance.','Clearer Insight. Stronger Performance.'],
  ['Monderman reveals where decisions stall, unnecessary work accumulates and performance falls short. See what needs attention, decide what to change and measure the results.','Understand how ownership, decisions, and everyday work operate across your organization—and where to focus improvement.'],
  ['"canonical-site-shell.js": "20260916.floating-support1"','"canonical-site-shell.js": "20261007.insight1"'],
  ['const runtimeRelease=asset=>({',"const runtimeRelease=asset=>({'canonical-site-shell.js':'20261007.insight1',"],
]);
let hunks=0;
for(const file of BRAND_REFRESH_FILES){
  const current=read(file),before=prior(file),entry=brandRefreshDelta.files[file];
  eq(sha(before),entry.before_sha256,file+': immutable deployed source pin');
  eq(sha(current),entry.after_sha256,file+': exact approved current source pin');
  eq(sourceBeforeBrandRefresh20261007(file,current),before,file+': every preceding byte reconstructed');
  eq(sourceBeforeBrandRefresh20261007(file,current.toString()),before.toString(),file+': text type retained');
  eq(sourceAtBrandRefreshBaseline(file,current),before,file+': conditional exact-source adapter');
  eq(sourceAtBrandRefreshBaseline(file,before),before,file+': original bytes are never double-inverted');
  for(const [start,end,now,old]of entry.replacements){
    eq(allowed.get(old),now,file+': only the individually approved copy/cache replacement');
    eq(current.toString().slice(start,end),now,file+': exact pinned hunk position');
    const mutant=Buffer.from(current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(end));
    reject(()=>sourceBeforeBrandRefresh20261007(file,mutant),file+': changed approved hunk rejected');
    eq(sourceAtBrandRefreshBaseline(file,mutant),mutant,file+': unknown hunk remains visible to historical guards');
    hunks++;
  }
  for(const mutant of [Buffer.concat([current,Buffer.from('\n')]),Buffer.from('UNREVIEWED'+current),Buffer.from(current.toString().replace(/./,'!')),before]){
    reject(()=>sourceBeforeBrandRefresh20261007(file,mutant),file+': unrelated edit or double inversion rejected');
    eq(sourceAtBrandRefreshBaseline(file,mutant),mutant,file+': unfamiliar source is not hidden');
  }
}
eq(hunks,20,'Exactly twenty approved copy/cache hunks');
for(const file of ['workspace.html','pattern-trial.html','signin.html','pilot.html','unknown.js','__proto__']){
  const value=Buffer.from('Outside the approved brand scope');
  eq(sourceBeforeBrandRefresh20261007(file,value),value,file+': strict inverse leaves unrelated bytes untouched');
  eq(sourceAtBrandRefreshBaseline(file,value),value,file+': conditional inverse leaves unrelated bytes untouched');
}
const historicalFiles=execFileSync('git',['ls-tree','-r','--name-only',BRAND_REFRESH_BASELINE,'--','scripts/fixtures','sample-data'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
const protectedFiles=['pattern-trial.html','signin.html','pilot.html','pilot-waitlist.js','pilot-pool.js','evaluation-capacity.js','workspace-access-gate.js','workspace-evaluation.js','participant-evidence-safety.js','monderman-report.js','public-sample-model.js','legal-document-manifest.json','terms.html','privacy.html','security.html','subprocessors.html','site-shell/header.html'];
for(const file of [...historicalFiles,...protectedFiles])eq(read(file),prior(file),file+': original evidence, legal, identity and admission bytes retained');
console.log(JSON.stringify({ok:true,checks,negativeControls,files:BRAND_REFRESH_FILES.length,hunks,immutableHistoricalFiles:historicalFiles.length,protectedFiles:protectedFiles.length,networkCalls:0,productionWrites:0,scope:'Exact owner-approved copy/cache delta; unknown-edit rejection and original evidence pins retained'}));
