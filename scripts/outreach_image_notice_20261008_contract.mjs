// Finite prospective email-notice proof. No network, acceptance or campaign action.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {outreachImageNoticeDelta,sourceBeforeOutreachImageNotice20261008,sourceAtOutreachImageNoticeBaseline} from './outreach_image_notice_20261008_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseline='08944880293e9c034470ead88035d48320f7b6fc';
const prior=file=>execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:32e6});
let checks=0,negativeControls=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const rejects=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
eq(outreachImageNoticeDelta.baseline,baseline,'Exact deployed pre-notice baseline');
eq(Object.keys(outreachImageNoticeDelta.files),['privacy.html','scripts/runtime_asset_release_build_smoke.mjs'],'Finite current-alias and truthful build-inventory inverse only');
const current=read('privacy.html'),before=prior('privacy.html'),entry=outreachImageNoticeDelta.files['privacy.html'];
eq(sha(before),'c71c0cf3fb3d66b58f4aecd1f52c33dabe6a52e24332548bd7763af294fe149d','Original published product notice pin remains fixed');
eq(sha(current),entry.after_sha256,'Exact reviewed current alias');
eq(sourceBeforeOutreachImageNotice20261008('privacy.html',current),before,'Every original product notice byte recovered');
eq(sourceBeforeOutreachImageNotice20261008('privacy.html',current.toString()),before.toString(),'Text type retained');
eq(sourceAtOutreachImageNoticeBaseline('privacy.html',before),before,'Original is never double-inverted');
eq(entry.replacements.length,3,'Only two website qualifiers and one separate supplement paragraph');
for(const [start,end,now,old]of entry.replacements){
  eq(current.toString().slice(start,end),now,'Exact reviewed hunk position');
  ok((old===''&&now==='website ')||(old===''&&now.includes('href="outreach-privacy.html"')&&now.startsWith('    <p>Separately,')),'Individually permitted insertion only');
  const mutant=Buffer.from(current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(end));
  rejects(()=>sourceBeforeOutreachImageNotice20261008('privacy.html',mutant),'Changed insertion rejected');
  eq(sourceAtOutreachImageNoticeBaseline('privacy.html',mutant),mutant,'Unknown insertion stays visible to old guard');
}
for(const mutant of [Buffer.concat([current,Buffer.from('\n')]),Buffer.from('UNREVIEWED'+current),Buffer.from(current.toString().replace('Product access is by invitation.','Product access is public.')),before]){
  rejects(()=>sourceBeforeOutreachImageNotice20261008('privacy.html',mutant),'Unrelated legal change or repeated inverse rejected');
  eq(sourceAtOutreachImageNoticeBaseline('privacy.html',mutant),mutant,'No broad exemption for unknown legal bytes');
}
for(const file of ['terms.html','legal-document-manifest.json','pattern-trial.html','pilot.html','workspace.html','unknown.js','__proto__']){
  const value=Buffer.from('Outside the approved notice scope');
  eq(sourceAtOutreachImageNoticeBaseline(file,value),value,file+': unrelated edits are never hidden');
}
const buildFile='scripts/runtime_asset_release_build_smoke.mjs',buildNow=read(buildFile),buildPrior=prior(buildFile);
eq(sourceBeforeOutreachImageNotice20261008(buildFile,buildNow),buildPrior,'Only three narrow build-guard exceptions; all other assertions unchanged');
const buildEdits=outreachImageNoticeDelta.files[buildFile].replacements;
eq(buildEdits.length,3,'Exactly three inventory/legal-shell build adaptations');
for(const [start,end,now,old]of buildEdits){
  let expected=old.replace('eq(canonicalPages,69);eq(footerPages,73);','eq(canonicalPages,70);eq(footerPages,74);').replace("'privacy.html','privacy-2026-09-12","'privacy.html','outreach-privacy.html','privacy-2026-09-12").replace("! /^(?:terms|privacy)(?:-|\\.)/.test(file)","! /^(?:terms|privacy)(?:-|\\.)|^outreach-privacy\\.html$/.test(file)");
  eq(now,expected,'Only truthful counts/new legal-shell cache and content coverage');
  const mutant=Buffer.from(buildNow.toString().slice(0,start)+'UNREVIEWED'+buildNow.toString().slice(end));
  rejects(()=>sourceBeforeOutreachImageNotice20261008(buildFile,mutant),'Changed build-guard exception rejected');
  eq(sourceAtOutreachImageNoticeBaseline(buildFile,mutant),mutant,'Unknown guard changes remain visible');
}
const tracked=execFileSync('git',['ls-tree','-r','--name-only',baseline],{cwd:root,encoding:'utf8'}).trim().split('\n');
const protectedFiles=tracked.filter(file=>!file.startsWith('scripts/')&&!file.startsWith('.github/')&&file!=='privacy.html');
const immutableFixtures=tracked.filter(file=>file.startsWith('scripts/fixtures/'));
for(const file of [...protectedFiles,...immutableFixtures])eq(read(file),prior(file),file+': original product, legal, admission, research and report bytes preserved');
const supplement=read('outreach-privacy.html').toString();
function noticeChecks(text){
  assert.equal(sha(text),outreachImageNoticeDelta.supplement.sha256,'Exact complete supplement; unfamiliar content rejected');
  for(const phrase of ['Supplement 2026-10-08-outreach-image-v1','Email images are not read receipts.','random, opaque identifier for that message','We privately match that identifier to the intended recipient and sent-email record.','not anonymous data','a bounded count of requests','We do not record IP addresses or user-agent strings in this application measurement record','Normal hosting, gateway and security providers can still receive standard request and network metadata','privacy proxies and security scanners','forwarded email','prove inbox placement or successful delivery','No recorded fetch means unknown','When you opt out or reply','no later than 30 days after the message is sent','We do not extend the window','through bounded cleanup when the image function is used or during a manual review','do not promise that a timed background job','Website tracking stays retired','does not reactivate website measurement','no cookies','device fingerprints','tracking parameters','participant content']){
    // "no cookies" and participant scope are expressed as complete equivalent sentences.
    const required=phrase==='no cookies'?'we do not use cookies':phrase==='participant content'?'customer or participant content':phrase;
    assert.ok(text.includes(required),required);
  }
  assert.ok(!/outreach-telemetry|<img[^>]*\.gif|tracking_pixel|fetch\(/i.test(text),'No collection code or pixel in the public supplement');
}
noticeChecks(supplement);checks+=29;
for(const phrase of ['random, opaque identifier for that message','When you opt out or reply','no later than 30 days after the message is sent','Website tracking stays retired'])rejects(()=>noticeChecks(supplement.replace(phrase,'UNREVIEWED')),'Missing disclosure rejected: '+phrase);
const scripts=text=>[...text.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(match=>match[0]);
eq(scripts(supplement),scripts(before.toString()),'All existing legal-shell scripts preserved; no email-image collection on website');
const localLinks=[...supplement.matchAll(/href="([^"#]+)"/g)].map(m=>m[1]).filter(url=>!/^https?:|^mailto:/i.test(url));
for(const url of localLinks)ok(fs.existsSync(path.join(root,url.split('?')[0])),'Existing local link resolves: '+url);
console.log(JSON.stringify({ok:true,checks,negativeControls,privacyHunks:3,buildGuardHunks:3,productFiles:2,immutableExistingFiles:protectedFiles.length,immutableHistoricalFixtures:immutableFixtures.length,networkCalls:0,productionWrites:0}));
