// Current publication integrity plus exact backward compatibility. Offline only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DURABLE_PUBLICATION_BASELINE, DURABLE_PUBLICATION_VERSION, DURABLE_PUBLICATION_FILES,
  durablePublicationDelta, sourceBeforeDurablePublication20261007, sourceAtDurablePublicationBaseline} from './durable_organization_publication_20261007_inverse.mjs';
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
const prior = file => execFileSync('git', ['show', DURABLE_PUBLICATION_BASELINE + ':' + file], {cwd:root, maxBuffer:32e6});
const sha = value => createHash('sha256').update(value).digest('hex');
const compact = text => text.replace(/\s/g, '');
const decode = text => text.replace(/&#(x[\da-f]+|\d+);/gi, (_, number) => String.fromCodePoint(number[0].toLowerCase() === 'x' ? parseInt(number.slice(1),16) : Number(number)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp|rarr);/g, (_, name) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rarr:'→'}[name]));
const visible = text => compact(decode(text.replace(/<[^>]*>/g, '')));
const sourceFixtureBytes = read('scripts/fixtures/durable-organization-source-20261007.json');
assert.equal(sha(sourceFixtureBytes), 'f1938ca731515030bcfe593811a5bfedba7353213f6eb1723fd2ac8752e97a2b', 'Independent immutable source extraction');
const source = JSON.parse(sourceFixtureBytes);
const slug = 'durable-organization.html';
const pdf = 'Monderman_Insight_The_Durable_Organization_2026-10-07.pdf';
const social = 'assets/research/durable-organization-social.png';
const title = 'The Durable Organization';
const subtitle = 'Why strong is not the same as lasting';
const deck = 'A system can look strong because it refuses to change, and that refusal is what makes it brittle. This paper sets what political history shows about strong states beside what the research shows about organizations, and argues for changing at the speed of need.';
const data = JSON.parse(read('pdf-src/the-durable-organization.json'));
const files = Object.fromEntries([slug, 'index.html', 'research.html', 'hold-collide-come-apart.html', 'trenches-not-silos.html', 'sitemap.txt', 'sitemap.xml', 'public-search-index.json'].map(file => [file,read(file).toString()]));
let checks = 0, negativeControls = 0;
const eq = (actual, expected, label) => {assert.deepEqual(actual, expected, label); checks++;};
const ok = (value, label) => {assert.ok(value,label); checks++;};
const reject = (fn, label) => {assert.throws(fn, {name:'AssertionError'},label); checks++; negativeControls++;};
eq(DURABLE_PUBLICATION_VERSION, 'durable-organization-publication-20261007.1', 'Independent publication edition');
eq(DURABLE_PUBLICATION_BASELINE, '74bcf2e86cf7829e2d4aaa5f83ade90b6b6ffaad', 'Exact preceding deployed release');
eq(DURABLE_PUBLICATION_FILES, ['index.html','research.html','hold-collide-come-apart.html','trenches-not-silos.html','sitemap.txt','sitemap.xml','public-search-index.json','scripts/build_public_search_index.py','pdf-src/hold-collide-come-apart.json','scripts/build_hold_collide_come_apart.py','scripts/runtime_asset_release_build_smoke.mjs'], 'Finite eleven-file existing-source whitelist');
let hunks = 0;
for (const file of DURABLE_PUBLICATION_FILES) {
  const current = read(file), before = prior(file), entry = durablePublicationDelta.files[file];
  eq(sha(before), entry.before_sha256, file + ': immutable preceding source');
  eq(sha(current), entry.after_sha256, file + ': exact reviewed publication source');
  eq(sourceBeforeDurablePublication20261007(file,current), before, file + ': every preceding byte reconstructed');
  eq(sourceBeforeDurablePublication20261007(file,current.toString()), before.toString(), file + ': string type preserved');
  eq(sourceAtDurablePublicationBaseline(file,current), before, file + ': conditional exact-source inverse');
  eq(sourceAtDurablePublicationBaseline(file,before), before, file + ': original bytes never double-inverted');
  for (const [start,end,now] of entry.replacements) {
    eq(current.toString().slice(start,end),now,file + ': finite hunk position');
    const mutant = Buffer.from(current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(end));
    reject(() => sourceBeforeDurablePublication20261007(file,mutant),file + ': changed publication hunk rejected');
    eq(sourceAtDurablePublicationBaseline(file,mutant),mutant,file + ': unknown hunk remains visible');
    hunks++;
  }
  for (const mutant of [Buffer.concat([current,Buffer.from('\n')]),Buffer.from('UNREVIEWED'+current),before]) {
    reject(() => sourceBeforeDurablePublication20261007(file,mutant),file + ': unrelated edit or double inversion rejected');
    eq(sourceAtDurablePublicationBaseline(file,mutant),mutant,file + ': unfamiliar bytes are not hidden');
  }
}
for (const file of ['workspace.html','pilot.html','pattern-trial.html','unknown.js','__proto__']) {
  const bytes=Buffer.from('Outside the publication transition');
  eq(sourceBeforeDurablePublication20261007(file,bytes),bytes,file + ': unrelated source unchanged');
  eq(sourceAtDurablePublicationBaseline(file,bytes),bytes,file + ': unrelated source unchanged conditionally');
}

function validateCurrent(d, f) {
  eq(d.source_sha256,source.source_pdf_sha256,'Original supplied PDF identity');
  eq(d.source_pages,14,'Original fourteen-page source');
  eq(d.editorial_changes,[],'No editorial corrections to authored text');
  eq([d.title,d.subtitle,d.standfirst,d.author,d.publication_date,d.part,d.read_minutes],[title,subtitle,deck,'Jason Adamson','2026-10-07',5,35],'Exact article metadata');
  eq(d.paragraphs.map(p=>p.number),Array.from({length:100},(_,i)=>i+1),'All one hundred numbered paragraphs');
  eq(d.body_blocks.filter(b=>b.type==='paragraph').map(b=>[b.number,b.text,b.html]),d.paragraphs.map(p=>[p.number,p.text,p.html]),'Source paragraph mapping and emphasis');
  eq(compact(d.body_blocks.map(b=>b.text).join(' ')),compact(source.body_text),'Entire independently extracted source body, including caveats, headings and pullquote');
  eq(compact(d.references.join(' ')),compact(source.references_text),'Entire independently extracted nineteen-reference sequence');
  eq(d.references.length,19,'Nineteen complete references');
  eq(d.sections.length,6,'Six source sections');
  for (const [index,ref] of d.references.entries()) eq(visible(d.references_html[index]),compact(ref),'Reference '+(index+1)+': original emphasis has the same wording');
  const html=f[slug];
  for (const token of ['<title>'+title+' | Monderman</title>', 'rel="canonical" href="https://www.monderman.com/'+slug+'"', 'content="2026-10-07"', 'class="article-kicker">Governance and Performance · Part 5', subtitle, deck, '15 pages · 35-minute read', 'href="'+pdf+'"', 'assets/research/durable-organization-social.png', 'content="1200"', 'content="630"']) ok(html.includes(token),'Current article metadata '+token);
  const paragraphs=[...html.matchAll(/<p data-source-paragraph="(\d+)">([\s\S]*?)<\/p>/g)];
  eq(paragraphs.map(m=>[Number(m[1]),m[2]]),d.paragraphs.map(p=>[p.number,p.html]),'Every complete paragraph with original emphasis in order');
  const refs=[...html.matchAll(/<li id="reference-(\d+)" data-source-reference="\1">([\s\S]*?)<\/li>/g)];
  eq(refs.map(m=>[Number(m[1]),m[2]]),d.references_html.map((text,i)=>[i+1,text]),'Every complete reference with original links in order');
  const headings=[...html.matchAll(/<h2 id="part-[^"]+"><span class="section-number">([^<]+)<\/span>([^<]+)<\/h2>/g)].map(m=>[m[1],decode(m[2])]);
  eq(headings,d.sections.map(s=>[s.label,s.title]),'All source section headings in order');
  for (const key of ['biography','copyright']) ok(visible(html).includes(compact(d[key])),'Original '+key);
  eq(d.figure.kind,'illustrative','Illustration remains qualitative');
  eq(d.figure.caption,'An illustration of this paper’s argument. It is not drawn from data.','Exact illustration caveat');
  for (const text of [d.figure.title,d.figure.subtitle,d.figure.caption,...Object.values(d.figure.labels)]) ok(compact(source.cover_text).includes(compact(text)),'Figure wording verified against original cover '+text);
  ok(html.includes(d.figure.svg),'Exact qualitative SVG with unchanged axes, labels and paths');
  eq((html.match(/<figure\b/g)||[]).length,1,'One source illustration');
  eq((html.match(/<sup\b/g)||[]).length,0,'No invented inline citation markers');
  ok(html.includes('href="trenches-not-silos.html">Read Part 4:'),'Durable previous part is Trenches');
  ok(html.includes('href="hold-collide-come-apart.html">Read Part 6:'),'Durable next part is Hold');
  ok(f['hold-collide-come-apart.html'].includes('class="article-kicker">Governance and Performance · Part 6'),'Actual Hold article is Part 6');
  ok(f['hold-collide-come-apart.html'].includes('?v=20261007.part6'),'Hold social image cache identity');
  ok(f['hold-collide-come-apart.html'].includes('href="'+slug+'">Read Part 5:'),'Hold links to Durable');
  ok(f['trenches-not-silos.html'].includes('href="'+slug+'">Read Part 5:'),'Trenches links to Durable');
  const governance=f['research.html'].match(/<section class="series" aria-labelledby="governance-performance-title">[\s\S]*?<\/section>/)?.[0]||'';
  const cards=[...governance.matchAll(/<article class="series-card">[\s\S]*?<\/article>/g)].map(m=>m[0]);
  eq(cards.length,6,'Exactly six Governance library cards');
  eq(cards.map(c=>c.match(/class="series-chip">([^<]+)/)?.[1]),['Part 1','Part 2','Part 3','Part 4','Part 5','Part 6'],'Unique ordered six-part series');
  ok(cards[4].includes(title)&&cards[4].includes('15 pages · ~35 min')&&cards[4].includes('href="'+pdf+'"'),'New fifth library card and accurate PDF metadata');
  ok(cards[5].includes('Hold, Collide, Come Apart'),'Hold sixth library card');
  ok(f['research.html'].includes('22 items · Updated October 2026'),'Accurate complete library count');
  const carousel=[...f['index.html'].matchAll(/<article class="latest-card\b[^>]*>[\s\S]*?<\/article>\n/g)].map(m=>m[0]);
  eq(carousel.length,19,'Nineteen unique source carousel cards');
  ok(carousel[0].includes(title)&&carousel[0].includes('Governance and Performance · Part 5'),'Durable newest homepage card');
  ok(carousel[1].includes('Hold, Collide, Come Apart')&&carousel[1].includes('Governance and Performance · Part 6'),'Hold second homepage card');
  for (const file of ['index.html','research.html']) for (const target of [slug,pdf]) eq(f[file].split('href="'+target+'"').length-1,1,file+': one publication destination '+target);
  for (const file of ['sitemap.txt','sitemap.xml']) eq(f[file].split('https://www.monderman.com/'+slug).length-1,1,file+': exactly one canonical listing');
  const search=JSON.parse(f['public-search-index.json']);
  const records=Array.isArray(search)?search:search.pages;
  const record=records.filter(p=>(p.url||p.path||p.href)===slug);
  eq(record.length,1,'Exactly one complete public search record');
  ok(visible(record[0].text||record[0].content||'').includes(compact(d.paragraphs[99].text)),'Search reaches complete closing body');
  for (const sourceLink of d.source_links||[]) ok(html.includes(sourceLink.url||sourceLink.uri||sourceLink.href),'Original published source hyperlink retained');
  ok(!/localhost|127\.0\.0\.1/.test(html),'No local verification URLs in publication');
}
validateCurrent(data,files);
for (const [name,mutate] of [
  ['missing paragraph',d=>d.paragraphs.pop()],
  ['changed caveat',d=>{d.body_blocks.find(b=>b.number===23).text='States always collapse.';}],
  ['missing source block',d=>d.body_blocks.splice(5,1)],
  ['changed reference',d=>{d.references[18]='Incomplete citation';}],
  ['reference link/wording altered',d=>{d.references_html[0]='Different source';}],
  ['wrong series part',d=>{d.part=6;}],
  ['data chart claim',d=>{d.figure.caption='Measured organizational results.';}],
  ['invented editorial changes',d=>{d.editorial_changes=['Unapproved'];}],
]) {const changed=structuredClone(data);mutate(changed);reject(()=>validateCurrent(changed,files),name+' must fail actual source/metadata checks');}
for (const [name,file,before,after] of [
  ['missing HTML paragraph',slug,data.paragraphs[99].html,''],
  ['wrong HTML part',slug,'class="article-kicker">Governance and Performance · Part 5','class="article-kicker">Governance and Performance · Part 6'],
  ['wrong page count',slug,'15 pages · 35-minute read','16 pages · 35-minute read'],
  ['changed illustration',slug,data.figure.svg,'<svg></svg>'],
  ['wrong Hold part','hold-collide-come-apart.html','class="article-kicker">Governance and Performance · Part 6','class="article-kicker">Governance and Performance · Part 5'],
  ['wrong library order','research.html','<span class="series-chip">Part 6</span>','<span class="series-chip">Part 5</span>'],
  ['wrong library count','research.html','22 items · Updated October 2026','21 items · Updated October 2026'],
  ['missing sitemap','sitemap.txt','https://www.monderman.com/'+slug,''],
]) {const changed={...files,[file]:files[file].replace(before,after)};assert.notEqual(changed[file],files[file],name+': real mutation');reject(()=>validateCurrent(data,changed),name+' must fail current publication checks');}
for (const file of ['pilot.html','pattern-trial.html','signin.html','terms.html','privacy.html','security.html','subprocessors.html','legal-document-manifest.json','pilot-pool.js','pilot-waitlist.js','evaluation-capacity.js','workspace-access-gate.js','workspace-evaluation.js','participant-evidence-safety.js','monderman-report.js','public-sample-model.js','sample-report-production.js','sample-data/production-diagnostic-samples.json','sample-data/production-sample-release.json','site-shell/header.html','site-shell/footer.html','canonical-site-shell.js']) eq(read(file),prior(file),file+': legal, identity, admission and existing report controls remain byte-identical');
const historical=execFileSync('git',['ls-tree','-r','--name-only',DURABLE_PUBLICATION_BASELINE,'--','scripts/fixtures','sample-data'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for (const file of historical) eq(read(file),prior(file),file+': historical fixture/evidence never repinned');
eq(Object.keys(durablePublicationDelta.artifacts),[slug,'pdf-src/the-durable-organization.json','scripts/build_durable_organization.py',pdf,social,'Monderman_Insight_Hold_Collide_Come_Apart_2026-10-01.pdf','assets/research/hold-collide-come-apart-social.png'],'Finite seven-artifact reviewed publication scope');
for (const [file,entry] of Object.entries(durablePublicationDelta.artifacts)) {
  eq(sha(read(file)),entry.after_sha256,file+': exact reviewed publication artifact');
  if (entry.before_sha256) eq(sha(prior(file)),entry.before_sha256,file+': original artifact pin unchanged');
}
for (const file of [slug,pdf,social,'pdf-src/the-durable-organization.json']) ok(read(file).length>0,'Published artifact exists '+file);
console.log(JSON.stringify({passed:true,checks,negativeControls,files:DURABLE_PUBLICATION_FILES.length,hunks,sourceParagraphs:100,references:19,sourcePages:14,publishedPages:15,governanceParts:6,historicalFixtures:historical.length,networkCalls:0,productionWrites:0}));
