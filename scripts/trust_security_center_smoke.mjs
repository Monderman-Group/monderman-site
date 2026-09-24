// Current Trust & Security Center contract; local source only, no provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);checks++;};
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const ids=html=>[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const blocks=(html,tag)=>[...html.matchAll(new RegExp('<'+tag+'\\b[^>]*>[\\s\\S]*?<\\/'+tag+'>','gi'))].map(match=>match[0]);
const main=html=>html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0]||'';
const center=read('security.html'), compatibility=read('subprocessors.html');
const expectedAnchors=['main-content','access-controls','data-processing','ai-processing','chat','privacy-and-retention','providers','provider-security','administrative-device-protection','documents-and-contact'];
const boundaries=[
  'row-level security and server-side authorization',
  'do not make the recipient a Workspace member',
  'Privileged database, payment, AI and email credentials stay on the server',
  'The browser does not set the saved score',
  'uses HTTPS/TLS',
  'AI-assisted interpretation is currently enabled for eligible Diagnostic and Synthesis reports, including evaluation reports.',
  "Monderman's diagnostic engine produces the scores, classifications, evidence limits and available action options.",
  'The interpretation does not change the saved score.',
  'they do not establish scientific validity or guarantee an outcome.',
  'does not automatically regenerate or replace older saved reports',
  'Synthesis of your own saved runs can include selected original structured answers and their exact questions',
  "not named participants' individual answer records. Small or insufficiently supported groups are withheld.",
  'new per-run permission under the September 12 notice for those saved observations',
  'Earlier permission does not authorize this expanded use.',
  'Earlier observations are not automatically made eligible.',
  'request-size checks before drafting or review, even if no interpretation is generated',
  'model training, fine-tuning, provider feedback, shared benchmarks or cross-customer research, including in aggregated or de-identified form',
  'only predefined sector and Diagnostic categories, not customer answers, organization names or Workspace history',
  'Reports show the research date or disclose that no newly checked research is included.',
  'submitted messages, limited recent replies, approved public product information',
  'server-checked plan and role',
  'does not store transcripts in its database or intentionally log message contents',
  'cannot change a score, send a campaign, modify records or buy a subscription',
  'that context may make a person identifiable',
  'invitation, request, delivery and security metadata',
  'not a promise of physical deletion',
  'within 30 days',
  'usage-policy, legal, contractual, and customer-agreement exceptions',
  'This is not a zero-retention arrangement.',
  'Deleting a Workspace does not create another evaluation.',
  'they do not certify Monderman',
  'CrowdStrike Falcon Go',
  'are not covered by this device subscription',
  'does not currently claim SOC 2, ISO 27001, FedRAMP',
  'does not represent that Monderman has completed an independent penetration test',
  'contact us before using Monderman for that data',
  'Native Safari and browser-managed print dialogs remain best-effort',
  'applicable signed organizational data-processing terms'
];
function validateCenter(html){
  check(!/\u2014|&mdash;|&#(?:8212|x2014);/i.test(main(html)),'Trust Center prose uses no em-dash separators');
  for(const id of expectedAnchors)check(ids(html).includes(id),'Center anchor: '+id);
  equal(ids(html).length,new Set(ids(html)).size,'Center IDs are unique');
  equal((html.match(/<h1\b/g)||[]).length,1,'One center page heading');
  check(html.includes('<h1>Trust &amp; Security Center</h1>'),'Clear center title');
  check(html.includes('aria-label="Trust and security topics"'),'Topic navigation has an accessible name');
  for(const phrase of boundaries)check(main(html).includes(phrase),'Preserved disclosure: '+phrase);
  for(const anchor of expectedAnchors.filter(id=>id!=='main-content'&&id!=='provider-security'))check(html.includes('href="#'+anchor+'"'),'Topic/skip link reaches '+anchor);
  check(!main(html).includes('href="subprocessors.html'),'Center does not send readers back to the former provider page');
}
validateCenter(center);
assert.throws(()=>validateCenter(center.replace('</a>: information','</a> \u2014 information')),{name:'AssertionError'},'New em-dash separator must fail');checks++;
const providerCards=blocks(center,'article').filter(html=>html.includes('class="trust-provider"'));
equal(providerCards.length,7,'All seven existing core providers remain, with no new provider');
const providers=[['Supabase','https://supabase.com/security'],['Render','https://render.com/docs/ddos-protection'],['Anthropic','https://trust.anthropic.com/'],['Resend','https://resend.com/legal/subprocessors'],['Stripe','https://stripe.com/legal/dpa'],['Google','https://safety.google/safety/'],['Cloudflare','https://www.cloudflare.com/trust-hub/']];
for(const [name,url]of providers){
  const card=providerCards.find(html=>html.includes('>'+name+'</a>'));
  check(card?.includes('href="'+url+'"'),name+' retains the reviewed provider reference');
  check(card?.includes('<dt>Purpose</dt>')&&card.includes('<dt>Information received</dt>'),name+' has purpose and data information');
}
for(const phrase of ['GitHub provides the source repository','jsDelivr and cdnjs deliver versioned browser libraries','content-delivery-layer protection against distributed denial-of-service attacks for Supabase',"DDoS protection for Render's hosted applications and websites",'web application firewall for Resend','do not make Cloudflare responsible for every part'])check(center.includes(phrase),'Infrastructure scope: '+phrase);
for(const anchor of ['ai-processing','provider-security']){
  check(ids(compatibility).includes(anchor),'Legacy fragment retained: '+anchor);
  check(compatibility.includes('href="security.html#'+anchor+'"'),'Legacy fragment has a direct current destination: '+anchor);
}
check(compatibility.includes('href="security.html#providers"'),'Legacy provider URL has a direct inventory destination');
check(compatibility.includes('href="https://www.monderman.com/security.html"'),'Compatibility canonical points to the center');
check(!/<meta[^>]+http-equiv\s*=\s*["']?refresh/i.test(compatibility),'No forced timed redirect');
check(!main(compatibility).includes('<table')&&!main(compatibility).includes('trust-provider-grid'),'No second, drifting provider inventory');
for(const [file,html]of [['security.html',center],['subprocessors.html',compatibility]]){
  check(!/\u2014|&mdash;|&#(?:8212|x2014);/i.test(main(html)),file+': no em dashes in newly organized content');
  equal(ids(html).length,new Set(ids(html)).size,file+': no duplicate IDs');
  check(html.includes('class="skip-link" href="#main-content"'),file+': skip link retained');
  check(html.includes('href="trust-security-center.css?v=20260924.center1"'),file+': scoped stylesheet is versioned');
  const head=execFileSync('git',['show','HEAD:'+file],{cwd:root,encoding:'utf8'});
  equal(blocks(html,'script'),blocks(head,'script'),file+': executable blocks unchanged');
  equal(blocks(html,'style'),blocks(head,'style'),file+': existing inline styles unchanged');
  for(const [,href]of html.matchAll(/\bhref="([^"]+)"/g)){
    if(/^(?:https?:|mailto:)/.test(href))continue;
    const [target,fragment]=href.split('#');
    const targetFile=(target||file).split('?')[0];
    check(fs.existsSync(path.join(root,targetFile)),file+': local destination exists: '+href);
    if(fragment&&targetFile.endsWith('.html'))check(ids(read(targetFile)).includes(fragment),file+': local fragment resolves: '+href);
  }
}
const tracked=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).trim().split('\n');
const legal=tracked.filter(file=>/^(?:privacy|terms)(?:-[^/]*)?\.html$/.test(file)||file==='legal-document-manifest.json');
for(const file of legal)equal(fs.readFileSync(path.join(root,file)),execFileSync('git',['show','HEAD:'+file],{cwd:root}),file+': authoritative legal bytes unchanged');
for(const token of ['Earlier permission does not authorize this expanded use.','This is not a zero-retention arrangement.','id="administrative-device-protection"']){
  assert.throws(()=>validateCenter(center.replace(token,'')),{name:'AssertionError'},'Missing disclosure/legacy anchor must fail');checks++;
}
const css=read('trust-security-center.css');
for(const phrase of ['grid-template-columns: repeat(2, minmax(0, 1fr))','@media (max-width: 700px)','grid-template-columns: minmax(0, 1fr)','focus-visible','scroll-margin-top: 110px','prefers-reduced-motion'])check(css.includes(phrase),'Responsive and accessible presentation: '+phrase);
console.log(JSON.stringify({status:'PASS',checks,coreProviders:providerCards.length,unchangedLegalFiles:legal.length,scope:'Current consolidated disclosures, preserved legacy links, unchanged scripts/legal documents and responsive style rules; no network or visual certification'}));
