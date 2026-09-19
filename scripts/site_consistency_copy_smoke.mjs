import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {assertInvitedEvaluationSourceContract} from './invited_evaluation_source_contract.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
assert.ok(read('index.html').includes('<h1 class="hero-title" id="hero-title">Less bureaucracy. Better performance.</h1>'));
assert.ok(read('index.html').includes('"slogan": "Less bureaucracy. Better performance."'));
const brandStatement='Monderman reveals where decisions stall, unnecessary work accumulates and performance falls short. See what needs attention, decide what to change and measure the results.';
assert.equal(read('index.html').split(brandStatement).length-1,4,'Hero, search/share metadata and structured description use the approved statement');
assert.ok(read('site-shell/footer.html').includes(`<p class="mf-copy">${brandStatement}</p>`),'Shared footer uses the exact approved statement');
for(const f of [...fs.readdirSync(root).filter(f=>f.endsWith('.html')),'site-shell/footer.html','public-search-index.json']) {
  assert.ok(!read(f).replace(/\s+/g,' ').includes('Monderman helps you examine responsibilities, decisions, processes and performance.'),f+': retired sub-hero must not return');
}
const homepageSearch=JSON.parse(read('public-search-index.json')).find(row=>row.url==='index.html');
assert.ok(homepageSearch.text.includes(brandStatement),'Homepage search entry uses the approved statement');
assert.ok(read('Monderman_Platform_Brief.html').includes('Examine operating conditions. Save the results. Compare them later.'));
assertInvitedEvaluationSourceContract(root);
const price=read('platform-services.html');
assert.ok(!price.includes('Create a free account')&&!price.includes('checkout.html?'),'No public free-account or purchase CTA');
assert.ok(price.includes('<tr><td class="rowlabel">New eligible Syntheses: evaluation / annual paid term</td><td>Unlimited during evaluation</td><td class="num">60</td><td class="num">300</td><td class="yes">Unlimited</td></tr>'),'Unlimited ordinary evaluation with distinct paid annual pools');
assert.ok(price.includes('Available by invitation. Evaluate Monderman free for 60 days. No credit card. No automatic renewal.'));
assert.ok(!price.includes('60 / year')&&!price.includes('300 / year'),'No duplicated allowance pool');
assert.ok(price.includes('unlimited self-runs for authorized Workspace users'));
const catalog=read('diagnostics.html');
assert.equal((catalog.match(/class="dx-card-time">10, 30, or 60 minutes/g)||[]).length,4);
assert.ok(catalog.includes('Participation is counted separately for each diagnostic. Each person counts once, even if they complete that diagnostic more than once.'));
const details=catalog.match(/<details class="dx-method-detail">([\s\S]*?)<\/details>/)?.[1];
assert.ok(details?.includes('Independent statistical review: <strong>not reviewed</strong>'));
assert.ok(details.includes('same instrument score band'));
assert.ok(catalog.includes('not forecasts or measured savings'));
assert.ok(!read('decision-velocity.html').match(/<meta[^>]*what delay costs/));
assert.ok(!read('canonical-site-shell.js').includes('copy.textContent ='));
assert.ok(!read('signin.html').includes('#26496f'));
assert.ok(!read('workspace.html').includes('fonts.googleapis.com'));
const faces=[...read('brand-fonts.css').matchAll(/@font-face\{([^}]+)\}/g)].map(m=>m[1]);
for(const style of ['normal','italic']) for(const weight of [400,500,600,700]) {
  const matches=faces.filter(face=>face.includes(`font-style:${style};`)&&face.includes(`font-weight:${weight};`));
  assert.equal(matches.length,1,`${style} ${weight}: shared font mapping must be a single discrete face`);
  const file=(style==='italic'?{400:'56',500:'66',600:'66',700:'76'}:{400:'55',500:'65',600:'65',700:'75'})[weight];
  assert.ok(matches[0].includes(`url("${file}font.woff2")`));
}
assert.ok(read('accept-invite.html').includes('class="invitation-brand"')&&!read('accept-invite.html').includes('&#9679;'));
console.log('PASS approved site consistency: exact copy, shared allowances, technical details, exact approved invitation/access deltas, unchanged scoring/evidence, and exact Sankey-only report delta.');
