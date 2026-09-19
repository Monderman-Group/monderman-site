// Current product copy is no longer described as beta. Archived legal editions,
// internal CSS/version identifiers and cited third-party history are not product
// status claims and must not be rewritten by a broad text replacement.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const baseline='81f06cbe6974d5e7d1a276ce762e5a4b4699162e';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const prior=file=>execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
let assertions=0;
const check=(condition,label)=>{assert.ok(condition,label);assertions++;};

const oldStatus='<div><dt>Beta status</dt><dd>Monderman is in active beta and is available for production use. The product continues to change on a published cadence, and customers have a direct channel for reporting issues.</dd></div>';
const newStatus='<div><dt>Access and updates</dt><dd>Monderman is available by invitation. Product updates and issue reporting are part of ongoing platform support.</dd></div>';
const substitutions={
  'plan-signal.html':[[oldStatus,newStatus]],
  'plan-pattern.html':[[oldStatus,newStatus],['Pattern &middot; Active beta &middot; expanded campaigns','Pattern &middot; expanded campaigns']],
  'plan-enterprise.html':[[oldStatus,newStatus]],
  'platform-services.html':[[
    '<p class="ps-beta-note">Monderman is in active beta and is available for production use. The product continues to change on a published cadence, and customers have a direct channel for reporting issues.</p>',
    '<p class="ps-beta-note">Monderman is available by invitation. Product updates and issue reporting are part of ongoing platform support.</p>'
  ]],
  'security.html':[
    ['Native Safari and browser-managed print dialogs remain beta and best-effort until dedicated native testing is complete.','Native Safari and browser-managed print dialogs remain best-effort until dedicated native testing is complete.'],
    ['does not represent that the public beta has completed an independent penetration test.','does not represent that Monderman has completed an independent penetration test.']
  ]
};
for(const [file,pairs]of Object.entries(substitutions)){
  let expected=prior(file);
  for(const [before,after]of pairs){
    check(expected.split(before).length===2,file+': one exact approved status-copy substitution');
    expected=expected.replace(before,()=>after);
  }
  check(read(file)===expected,file+': every other byte, including scripts, styles, links and prices, remains unchanged');
}

const decode=text=>text.replace(/&#x([\da-f]+);/gi,(_,number)=>String.fromCodePoint(parseInt(number,16)))
  .replace(/&#(\d+);/g,(_,number)=>String.fromCodePoint(Number(number)))
  .replace(/&(?:nbsp|middot|amp|quot|apos|lt|gt);/g,' ');
function currentText(source){
  const html=source.replace(/<!--[\s\S]*?-->/g,'').replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,'');
  const descriptiveAttributes=[...html.matchAll(/\b(?:content|alt|title|aria-label)\s*=\s*(["'])([\s\S]*?)\1/gi)].map(match=>match[2]).join(' ');
  return decode(html.replace(/<[^>]*>/g,' ')+' '+descriptiveAttributes).replace(/\s+/g,' ');
}
const citedHistory='Publishers Weekly coverage of the January 2025 beta launch.';
function productBeta(file,source){
  let text=currentText(source);
  if(file==='merit-after-the-machine.html')text=text.replace(citedHistory,'');
  return /\bbeta\b/i.test(text);
}
for(const mutation of ['<h1>Active beta</h1>','<p>Public BETA</p>','<meta name="description" content="Monderman beta">','<img alt="Beta platform">','<p>Public b&#101;ta</p>']){
  check(productBeta('index.html',mutation),'negative control: visible or descriptive beta copy is rejected');
}
check(!productBeta('index.html','<style>.status-beta{display:none}</style><script>const version="2026-08-20-beta";</script><p>By invitation</p>'),'internal identifiers are not presented as status');
check(!productBeta('merit-after-the-machine.html',`<li>${citedHistory}</li>`),'specific third-party historical citation remains valid');
check(productBeta('merit-after-the-machine.html',`<li>${citedHistory}</li><p>Monderman beta</p>`),'historical exception cannot hide another beta claim');

const archives=fs.readdirSync(root).filter(file=>/^(?:terms|privacy)-\d{4}-\d{2}-\d{2}-.+\.html$/.test(file));
const pages=fs.readdirSync(root).filter(file=>file.endsWith('.html')&&!archives.includes(file));
for(const file of [...pages,'site-shell/header.html','site-shell/footer.html'])check(!productBeta(file,read(file)),file+': no current beta status in rendered or descriptive copy');
const baselineFiles=new Set(execFileSync('git',['ls-tree','--name-only',baseline],{cwd:root,encoding:'utf8'}).trim().split('\n'));
for(const file of archives){
  // New legal editions are owned by the current release. Earlier tracked legal
  // documents must remain the exact historical record, including their labels.
  if(!baselineFiles.has(file))continue;
  check(read(file)===prior(file),file+': historical legal record is unchanged');
}
for(const file of ['assistant.js','workspace-assistant.js'])check(!/\bbeta\b/i.test(read(file)),file+': current assistant source has no beta claim');
check(read('platform-services.html').includes('Available by invitation. Evaluate Monderman free for 60 days. No credit card. No automatic renewal.'),'access, duration and no-charge/renewal terms remain explicit');
check(read('security.html').includes('does not currently claim SOC 2, ISO 27001, FedRAMP'),'removing a label does not claim certification');
check(read('security.html').includes('remain best-effort until dedicated native testing is complete'),'native testing limitation remains accurate');
console.log(`PASS ${assertions} public status-copy checks across ${pages.length} current HTML pages; exact five-page copy-only delta and historical legal preservation.`);
