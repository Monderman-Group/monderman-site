// Source and negative-copy checks only. No acceptance, API, browser or account writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=name=>fs.readFileSync(new URL(name,root),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const version='2026-09-12-ai-source-evidence-v2',archive='privacy-'+version+'.html';
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
equal(read('privacy.html'),notice,'current alias matches the new immutable edition');
equal(manifest.required_acknowledgement,{terms_version:'2026-09-09-beta',privacy_notice_version:version});
equal(manifest.privacy_notice_version,version);equal(manifest.published_privacy_notice_file,archive);
equal(sha(notice),manifest.documents[version].privacy_notice_file_sha256);
const content=text=>text.split('<!-- CONTENT_START -->')[1].split('<!-- CONTENT_END -->')[0].replace(/^\n+|\n+$/g,'')+'\n';
equal(sha(content(notice)),manifest.privacy_notice_content_sha256);
equal(manifest.privacy_notice_content_sha256,manifest.published_privacy_notice_content_sha256);
equal(sha(read('privacy-2026-09-11-ai-evidence-v1.html')),'9286991d6f104c50a401fb4f987bdd751523e74d3fda713ceab17b5fdf49f460','published v1 is immutable');
equal(sha(content(read('terms.html'))),'ac5e307e3076542cef65bd82ad9834eeadae3742893495415dffc7b214480c0e','Terms content unchanged');
equal(sha(manifest.acceptance_copy),'2bef99a3fe3aa7efe1f70e2655a25167e7e6513b2ecd5305b63d3863a6e84775','acceptance copy unchanged');
for(const file of ['security.html','subprocessors.html','pilot.html','pattern-trial.html']){
  const text=read(file);
  for(const phrase of ['Synthesis of your own saved runs','September 12 notice','request-size checks']){assert(text.toLowerCase().includes(phrase.toLowerCase()),file+': '+phrase);checks++;}
  assert(!text.includes('Synthesis uses aggregate results and a bounded selection'));checks++;
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
console.log(JSON.stringify({status:'PASS',checks,negativeCopyCases:negatives,version,networkCalls:0,acceptancesCreated:0,scope:'Local source edition and frontend choice contract; not publication or live consent proof.'}));
