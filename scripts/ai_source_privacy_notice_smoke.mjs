// Source and negative-copy checks only. No acceptance, API, browser or account writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sourceAtOutreachImageNoticeBaseline} from './outreach_image_notice_20261008_inverse.mjs';
import {sourceBeforeScopeBeta20261014 as originalLegalSource} from './scope_beta_20261014_inverse.mjs';
import {createHash} from 'node:crypto';
import {sourceBeforeTrustSecurityCenter20260924} from './trust_security_center_20260924_inverse.mjs';
const root=new URL('../',import.meta.url),readRaw=name=>fs.readFileSync(new URL(name,root),'utf8');

// Current physical wording and exact original acknowledged-source view are both required.
const legalPresentationFiles = ["privacy.html", "privacy-2026-09-12-ai-source-evidence-v2.html", "privacy-2026-09-19-invited-evaluation.html", "privacy-2026-09-19-invitation-access.html"];
const legalPresentationOriginalHashes = {"privacy.html": "b6425860f43039b0af638a11f3a01f3adffb94a4dc1dcfc7dd885dfdd7b2a7ec", "privacy-2026-09-12-ai-source-evidence-v2.html": "41e4ef0367e55a4bff255934c42ea14b4b4e49a69dca78e4f14357f08bc2e3cc", "privacy-2026-09-19-invited-evaluation.html": "88a0ad179c9f8d24c478789946d7d5895a7721800022aff238f1a7fc81f26bce", "privacy-2026-09-19-invitation-access.html": "c71c0cf3fb3d66b58f4aecd1f52c33dabe6a52e24332548bd7763af294fe149d"};
const legalPresentationSha = text => createHash('sha256').update(text).digest('hex');
function legalPresentationBlock(text) {
  assert.equal(text.split('<!-- CONTENT_START -->').length,2);
  assert.equal(text.split('<!-- CONTENT_END -->').length,2);
  return text.split('<!-- CONTENT_START -->')[1].split('<!-- CONTENT_END -->')[0];
}
function verifyLegalPresentation(rawManifestSource, rawSources) {
  const actual=JSON.parse(rawManifestSource), record=actual.presentation_copy;
  assert.deepEqual(Object.keys(record||{}).sort(),['edition','files','original_manifest_fields','original_manifest_sha256','scope']);
  assert.equal(record.edition,'question-set-terminology-20261015.1');
  assert.equal(record.scope,'Eight exact visible terminology substitutions only; legal versions, acceptance and permissions unchanged.');
  assert.equal(record.original_manifest_sha256,'da09807a311fe1084087ee7cc7187178a412916a9d3c2f0d49ae931fd5a69cc0');
  assert.deepEqual(Object.keys(record.files).sort(),[...legalPresentationFiles].sort());
  const originalManifestSource=originalLegalSource('legal-document-manifest.json',rawManifestSource);
  assert.equal(legalPresentationSha(originalManifestSource),record.original_manifest_sha256);
  const original=JSON.parse(originalManifestSource), originalFields={privacy_notice_content_sha256:original.privacy_notice_content_sha256,published_privacy_notice_content_sha256:original.published_privacy_notice_content_sha256,documents:{}};
  for(const file of legalPresentationFiles.filter(f=>f!=='privacy.html')){const version=file.slice(8,-5);originalFields.documents[version]={privacy_notice_file_sha256:original.documents[version].privacy_notice_file_sha256};assert.equal(actual.documents[version].privacy_notice_file_sha256,record.files[file].presented_source_sha256);}
  assert.deepEqual(record.original_manifest_fields,originalFields);
  for(const file of legalPresentationFiles){
    const text=rawSources[file],row=record.files[file];
    assert.deepEqual(Object.keys(row).sort(),['original_marked_content_sha256','original_source_bytes','original_source_sha256','presented_marked_content_sha256','presented_source_bytes','presented_source_sha256','replacements']);
    assert.equal(legalPresentationSha(text),row.presented_source_sha256);assert.equal(Buffer.byteLength(text),row.presented_source_bytes);
    assert.equal(row.original_source_sha256,legalPresentationOriginalHashes[file]);
    assert.equal(row.replacements.length,2);let previousEnd=0;
    for(const [a,z,now,old]of row.replacements){assert.ok(Number.isSafeInteger(a)&&Number.isSafeInteger(z)&&a>=previousEnd&&z>=a);assert.equal(now,'question-set version');assert.equal(old,'questionnaire version');assert.equal(text.slice(a,z),now);previousEnd=z;}
    let restored=text;for(const[a,z,now,old]of [...row.replacements].reverse()){assert.equal(restored.slice(a,z),now);restored=restored.slice(0,a)+old+restored.slice(z);}
    assert.equal(restored,originalLegalSource(file,text));assert.equal(legalPresentationSha(restored),row.original_source_sha256);assert.equal(Buffer.byteLength(restored),row.original_source_bytes);
    assert.equal(legalPresentationSha(legalPresentationBlock(text).replace(/^\n+|\n+$/g,'')+'\n'),row.presented_marked_content_sha256);
    assert.equal(legalPresentationSha(legalPresentationBlock(restored).replace(/^\n+|\n+$/g,'')+'\n'),row.original_marked_content_sha256);
    assert.equal((text.match(/question-set version/g)||[]).length,2);assert.ok(!/questionnaire/i.test(text));
  }
  assert.equal(actual.file_hash_scope,'repository_source_html');
  assert.equal(actual.privacy_notice_content_sha256,record.files['privacy-2026-09-19-invitation-access.html'].presented_marked_content_sha256);
  assert.equal(actual.published_privacy_notice_content_sha256,record.files['privacy.html'].presented_marked_content_sha256);
  const reconstructed=JSON.parse(JSON.stringify(actual));delete reconstructed.presentation_copy;
  for(const key of ['privacy_notice_content_sha256','published_privacy_notice_content_sha256'])reconstructed[key]=originalFields[key];
  for(const[version,fields]of Object.entries(originalFields.documents))Object.assign(reconstructed.documents[version],fields);
  assert.deepEqual(reconstructed,original,'Every legal version, acceptance, permission and unrelated manifest field remains original');
  return {edition:record.edition,currentPhysicalFiles:4,exactPresentationHunks:8,historicalManifestSha256:record.original_manifest_sha256,originalAssertionsBasis:'Exact original-source inverse, not a claim of unchanged presented bytes'};
}

const legalPresentationProof=verifyLegalPresentation(readRaw('legal-document-manifest.json'),Object.fromEntries(legalPresentationFiles.map(file=>[file,readRaw(file)])));
const read=name=>legalPresentationFiles.includes(name)||name==='legal-document-manifest.json'?originalLegalSource(name,readRaw(name)):readRaw(name);
const sha=value=>createHash('sha256').update(value).digest('hex');
const version='2026-09-12-ai-source-evidence-v2',archive='privacy-'+version+'.html';
const currentVersion='2026-09-19-invitation-access',currentArchive='privacy-'+currentVersion+'.html';
const manifest=JSON.parse(read('legal-document-manifest.json')),notice=read(archive);
let checks=0,negatives=0;
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const required=[
  'For Synthesis of your own saved runs',
  'selected original structured answers and their questions',
  'These are records saved under one account, not evidence from independent participants.',
  'descriptive distributions of recorded answers to the same question',
  "not named participants' individual answer records",
  'Small or insufficiently supported groups are withheld.',
  'Grouped information can still be sensitive',
  "only with the participant's recorded permission under this edition for those saved observations",
  'A permission recorded for an earlier notice does not authorize this expanded use.',
  'Leaving the optional choice unchecked does not change the structured score',
  'check request size before drafting or review',
  'This check can occur even when no interpretation is generated.',
  'Monderman does not use customer content for model training or fine-tuning',
  'subject to its stated safety, legal and contractual exceptions',
  'This is not a zero-retention arrangement.',
  'Customer answers, observations, organization names and Workspace history are not sent to that search',
  'publication of this notice does not activate a feature or regenerate an earlier report',
  'Permission to use optional written observations is a separate choice',
];
function processingCopy(text){for(const phrase of required)assert(text.includes(phrase),phrase);}
processingCopy(notice);checks+=required.length;
for(const phrase of required){assert.throws(()=>processingCopy(notice.replace(phrase,'[removed processing disclosure]')));negatives++;}
const currentNotice=sourceAtOutreachImageNoticeBaseline('privacy.html',read('privacy.html'));
equal(currentNotice,read(currentArchive),'current alias matches the invited-evaluation edition');
equal(manifest.required_acknowledgement,{terms_version:currentVersion,privacy_notice_version:currentVersion});
equal(manifest.privacy_notice_version,currentVersion);equal(manifest.published_privacy_notice_file,currentArchive);
equal(sha(notice),manifest.documents[version].privacy_notice_file_sha256);
equal(sha(notice),'41e4ef0367e55a4bff255934c42ea14b4b4e49a69dca78e4f14357f08bc2e3cc','source-evidence permission edition remains immutable');
for(const phrase of required){
  const currentPhrase=phrase.replace('under this edition for those saved observations','under the September 12, 2026 source-evidence permission for those saved observations').replace('A permission recorded for an earlier notice does not authorize this expanded use.','Permission recorded before the September 12 source-evidence edition does not authorize that expanded use.');
  assert(currentNotice.includes(currentPhrase),'unchanged source processing: '+currentPhrase);checks++;
}
assert(currentNotice.includes('This September 19 notice does not expand the permitted report evidence or replace the separate per-run permission.'));checks++;
const content=text=>text.split('<!-- CONTENT_START -->')[1].split('<!-- CONTENT_END -->')[0].replace(/^\n+|\n+$/g,'')+'\n';
equal(sha(content(currentNotice)),manifest.privacy_notice_content_sha256);
equal(manifest.privacy_notice_content_sha256,manifest.published_privacy_notice_content_sha256);
equal(sha(read('privacy-2026-09-11-ai-evidence-v1.html')),'9286991d6f104c50a401fb4f987bdd751523e74d3fda713ceab17b5fdf49f460','published v1 is immutable');
equal(sha(content(read('terms-2026-09-09-beta.html'))),'ac5e307e3076542cef65bd82ad9834eeadae3742893495415dffc7b214480c0e','Historical Terms content unchanged');
equal(sha(content(read('terms-2026-09-15-annual-plans.html'))),'2dea883f1452b0158d61b12f10ce2bd3303642922c29754767faeb833f2a2215','Historical annual Terms content unchanged');
equal(sha(content(read('terms.html'))),manifest.terms_content_sha256,'Invited evaluation Terms content is pinned');
equal(read('terms.html'),read('terms-'+currentVersion+'.html'),'Current Terms have an exact new archive');
equal(sha(manifest.acceptance_copy),'2bef99a3fe3aa7efe1f70e2655a25167e7e6513b2ecd5305b63d3863a6e84775','acceptance copy unchanged');
const sourceDisclosurePhrases=['Synthesis of your own saved runs','September 12 notice','request-size checks'];
function sourceDisclosureCopy(text,label){
  for(const phrase of sourceDisclosurePhrases)assert(text.toLowerCase().includes(phrase.toLowerCase()),label+': '+phrase);
  assert(!text.includes('Synthesis uses aggregate results and a bounded selection'));
}
for(const file of ['security.html','pilot.html','pattern-trial.html']){
  const text=read(file);
  sourceDisclosureCopy(text,file);checks+=4;
}
const center=read('security.html'),legacy=read('subprocessors.html');
// Only historical copy is restored. Current canonical disclosures and exact
// legacy destinations remain independently required below.
sourceDisclosureCopy(sourceBeforeTrustSecurityCenter20260924('subprocessors.html',legacy),'historical subprocessors.html');checks+=4;
function canonicalPrivacyRoute(current,old){
  assert.equal((current.match(/<section\b[^>]*aria-labelledby="ai-processing"[^>]*>/g)||[]).length,1);
  const aiSection=current.match(/<section\b[^>]*aria-labelledby="ai-processing"[^>]*>[\s\S]*?<\/section>/)?.[0];
  sourceDisclosureCopy(aiSection||'','canonical AI processing section');
  assert.equal((old.match(/<link rel="canonical" href="https:\/\/www\.monderman\.com\/security\.html">/g)||[]).length,1);
  for(const anchor of ['providers','ai-processing','provider-security']){
    assert.equal(current.split('id="'+anchor+'"').length-1,1);
    assert.equal(old.split('id="'+anchor+'"').length-1,1);
    const sections=old.match(new RegExp('<section\\b[^>]*aria-labelledby="'+anchor+'"[^>]*>[\\s\\S]*?<\\/section>','g'))||[];
    assert.equal(sections.length,1);
    assert.equal(sections[0].split('href="security.html#'+anchor+'"').length-1,1);
  }
  assert.doesNotMatch(old,/<meta[^>]+http-equiv\s*=\s*["']?refresh/i);
}
canonicalPrivacyRoute(center,legacy);checks++;
const routeMutations=sourceDisclosurePhrases.map(phrase=>[center.replace(phrase,'[removed source disclosure]'),legacy]);
for(const anchor of ['providers','ai-processing','provider-security']){
  routeMutations.push([center,legacy.replace('href="security.html#'+anchor+'"','href="security.html#wrong-section"')]);
  routeMutations.push([center,legacy.replace('id="'+anchor+'"','id="retired-'+anchor+'"')]);
  routeMutations.push([center.replace('id="'+anchor+'"','id="retired-'+anchor+'"'),legacy]);
}
routeMutations.push([center,legacy.replace('href="https://www.monderman.com/security.html"','href="https://www.monderman.com/subprocessors.html"')]);
routeMutations.push([center,legacy.replace('</head>','<meta http-equiv="refresh" content="0;url=security.html"></head>')]);
for(const [changedCenter,changedLegacy]of routeMutations){
  assert.notDeepEqual([changedCenter,changedLegacy],[center,legacy],'Each canonical privacy mutation changes source');
  assert.throws(()=>canonicalPrivacyRoute(changedCenter,changedLegacy));negatives++;
}
for(const tool of ['decision-velocity','structural-clarity','operational-systems','institutional-performance']){
  const source=read(tool+'.html');
  assert(source.includes('diagnostic-note-permission.js?v=20260912-v2'));checks++;
  assert.match(source,/notes_processing_permission: window\.MondermanNotePermission\?\.value\(state\.runId\),/);checks++;
}
const permission=read('diagnostic-note-permission.js');
assert(permission.includes("const VERSION='"+version+"'"));checks++;
assert(permission.includes("link.href='"+archive+"'"));checks++;
assert(permission.includes('row?.version===VERSION&&row.allowed===true'));checks++;
assert(!permission.includes('input.checked=true'));checks++;
console.log(JSON.stringify({status:'PASS',checks,negativeCopyCases:negatives,version,networkCalls:0,acceptancesCreated:0,legalPresentation:legalPresentationProof,scope:'Current physical presentation verified; original source edition/assertions run on exact finite inverse. Not publication or live consent proof.'}));
