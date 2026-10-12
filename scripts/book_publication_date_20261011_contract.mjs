// Offline proof of only the approved dated book-copy update and exact adapters.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {BOOK_PUBLICATION_DATE_BASELINE,BOOK_PUBLICATION_DATE_VERSION,BOOK_PUBLICATION_DATE_FILES,bookPublicationDateDelta,sourceBeforeBookPublicationDate20261011,sourceAtBookPublicationDateBaseline} from './book_publication_date_20261011_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));
const prior=file=>execFileSync('git',['show',BOOK_PUBLICATION_DATE_BASELINE+':'+file],{cwd:root,maxBuffer:64e6});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0,hunks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
const files=['index.html','about.html','roi.html','research.html','public-search-index.json',
  'scripts/homepage_invitation_focus_20261011_inverse.mjs','scripts/homepage_invitation_focus_20261011_inverse.py',
  'scripts/homepage_invitation_focus_20261011_contract.mjs','scripts/homepage_invitation_focus_20261011_contract.py',
  'scripts/public_sample_manifest_sensitivity_smoke.mjs','.github/workflows/frontend-release.yml','.github/workflows/sample-report-marketing-certification.yml'];
eq(BOOK_PUBLICATION_DATE_BASELINE,'c1574cb534f77f55fc74fd52bc66064ab9bdc464','Exact deployed homepage/focus baseline');
eq(BOOK_PUBLICATION_DATE_VERSION,'book-publication-date-20261011.1','Independent dated-copy version');
eq(BOOK_PUBLICATION_DATE_FILES,files,'Four public pages, generated search and seven exact compatibility/wiring files only');
for(const file of files){
  const current=read(file),before=prior(file),entry=bookPublicationDateDelta.files[file];
  eq(sha(before),entry.before_sha256,file+': original deployed source pin');
  eq(sha(current),entry.after_sha256,file+': complete current source pin');
  for(const source of [current,current.toString()]){
    const expected=Buffer.isBuffer(source)?before:before.toString();
    eq(sourceBeforeBookPublicationDate20261011(file,source),expected,file+': strict inverse restores every original byte and type');
    eq(sourceAtBookPublicationDateBaseline(file,source),expected,file+': conditional inverse restores exact reviewed source');
    eq(sourceAtBookPublicationDateBaseline(file,expected),expected,file+': preceding source is not double-inverted');
  }
  for(const [start,end,now]of entry.replacements){
    eq(current.toString().slice(start,end),now,file+': exact finite hunk offset');
    const mutant=Buffer.from(current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(end));
    reject(()=>sourceBeforeBookPublicationDate20261011(file,mutant),file+': changed hunk rejected');
    eq(sourceAtBookPublicationDateBaseline(file,mutant),mutant,file+': unknown hunk is never hidden');
    hunks++;
  }
  for(const mutant of [Buffer.concat([current,Buffer.from('\n')]),Buffer.from('UNREVIEWED'+current),Buffer.from(current.toString().replace(/./,'!')),before]){
    reject(()=>sourceBeforeBookPublicationDate20261011(file,mutant),file+': unknown complete source or double inversion rejected');
    eq(sourceAtBookPublicationDateBaseline(file,mutant),mutant,file+': unknown source stays visible to old guards');
  }
}
function replaceExact(text,old,value,count=1){
  eq(text.split(old).length-1,count,'Exact authorized replacement occurrence count');
  return text.split(old).join(value);
}
for(const [file,replacements]of [
 ['index.html',[['Forthcoming October 12, 2026','Publication date: 21 October 2026']]],
 ['about.html',[['forthcoming October 12, 2026','publication date: 21 October 2026']]],
 ['roi.html',[['forthcoming October 12, 2026','publication date: 21 October 2026']]],
 ['research.html',[['Forthcoming October 12, 2026','Publication date: 21 October 2026'],['<strong>October 12, 2026</strong><span>Forthcoming</span>','<strong>21 October 2026</strong><span>Publication date</span>']]],
]){
  let expected=prior(file).toString();for(const [old,value]of replacements)expected=replaceExact(expected,old,value);
  eq(read(file).toString(),expected,file+': only the individually approved date/status bytes change');
  assert.doesNotMatch(read(file).toString(),/October 12, 2026|12 October 2026/);checks++;
}
const index=JSON.parse(read('public-search-index.json')),oldIndex=JSON.parse(prior('public-search-index.json'));
const publicPages=['index.html','about.html','roi.html','research.html'];
for(const file of publicPages)eq(index.filter(row=>row.url===file).length,1,file+': one indexed public page');
const expectedIndex=oldIndex.map(row=>!publicPages.includes(row.url)?row:{...row,text:row.text
  .replaceAll('Forthcoming October 12, 2026','Publication date: 21 October 2026')
  .replaceAll('forthcoming October 12, 2026','publication date: 21 October 2026')
  .replaceAll('October 12, 2026 Forthcoming','21 October 2026 Publication date')});
eq(index,expectedIndex,'Only exact indexed date/status text changes; all fields and other entries preserved');
const changedRows=index.filter((row,i)=>JSON.stringify(row)!==JSON.stringify(oldIndex[i]));
eq(changedRows.map(row=>row.url).sort(),['about.html','index.html','research.html'],'Exactly three generated search records change');
eq(oldIndex.filter(row=>['about.html','index.html','research.html'].includes(row.url)).reduce((count,row)=>count+(row.text.match(/October 12, 2026/g)||[]).length,0),4,'Four outdated date occurrences across three indexed records');
eq(index.find(row=>row.url==='roi.html'),oldIndex.find(row=>row.url==='roi.html'),'ROI search record remains unchanged because its indexed excerpt omits the book authorship paragraph');
eq(index.filter(row=>!publicPages.includes(row.url)),oldIndex.filter(row=>!publicPages.includes(row.url)),'Every unrelated search record stays byte-equivalent data');
const jsImport="import {sourceAtBookPublicationDateBaseline} from './book_publication_date_20261011_inverse.mjs';\n";
const pyImport='from book_publication_date_20261011_inverse import source_at_book_publication_date_baseline\n';
let expected=replaceExact(prior(files[5]).toString(),"import {createHash} from 'node:crypto';\n","import {createHash} from 'node:crypto';\n"+jsImport);
for(const name of ['sourceBeforeHomepageInvitationFocus20261011','sourceAtHomepageInvitationFocusBaseline']){
 const line=`export function ${name}(file,source){\n`;expected=replaceExact(expected,line,line+'  source=sourceAtBookPublicationDateBaseline(file,source);\n');
}
eq(read(files[5]).toString(),expected,'JavaScript prior inverse only composes the new independent exact layer');
expected=replaceExact(prior(files[6]).toString(),'from pathlib import Path\n','from pathlib import Path\n'+pyImport);
for(const name of ['source_before_homepage_invitation_focus_20261011','source_at_homepage_invitation_focus_baseline']){
 const line=`def ${name}(file, source):\n`;expected=replaceExact(expected,line,line+'    source = source_at_book_publication_date_baseline(file, source)\n');
}
eq(read(files[6]).toString(),expected,'Python prior inverse only composes the new independent exact layer');
expected=replaceExact(prior(files[7]).toString(),"import {execFileSync} from 'node:child_process';\n","import {execFileSync} from 'node:child_process';\n"+jsImport);
expected=replaceExact(expected,'const read=file=>fs.readFileSync(path.join(root,file));','const read=file=>sourceAtBookPublicationDateBaseline(file,fs.readFileSync(path.join(root,file)));');
eq(read(files[7]).toString(),expected,'Every original JavaScript focus assertion and negative control preserved');
expected=replaceExact(prior(files[8]).toString(),'import subprocess\n','import subprocess\n'+pyImport);
for(const [old,value,count]of [
 ["ROOT = Path(__file__).resolve().parents[1]\n","ROOT = Path(__file__).resolve().parents[1]\n\ndef read(file):\n    return source_at_book_publication_date_baseline(file, (ROOT / file).read_bytes())\n\n",1],
 ['(ROOT / file).read_bytes(), prior(file)','read(file), prior(file)',1],
 ["(ROOT / 'index.html').read_bytes().decode('utf-8')","read('index.html').decode('utf-8')",1],
 ['(ROOT / original_fixture).read_bytes()','read(original_fixture)',2],
 ['(ROOT / file).read_text()',"read(file).decode('utf-8')",1],
 ['(ROOT / file).read_bytes() == prior(file)','read(file) == prior(file)',1],
])expected=replaceExact(expected,old,value,count);
eq(read(files[8]).toString(),expected,'Every original Python focus assertion and negative control preserved');
const dependency="  'scripts/homepage_invitation_focus_20261011_inverse.mjs','scripts/fixtures/homepage-invitation-focus-20261011.json',\n";
expected=replaceExact(prior(files[9]).toString(),dependency,dependency+"  'scripts/book_publication_date_20261011_inverse.mjs','scripts/fixtures/book-publication-date-20261011.json',\n");
eq(read(files[9]).toString(),expected,'Only the actual new isolated module/fixture dependencies added; all sensitivity controls retained');
const focusCall='          node scripts/homepage_invitation_focus_20261011_contract.mjs\n';
const newCalls='          node scripts/book_publication_date_20261011_contract.mjs\n          python scripts/book_publication_date_20261011_contract.py\n';
expected=replaceExact(prior(files[10]).toString(),focusCall,newCalls+focusCall);
eq(read(files[10]).toString(),expected,'Frontend gate only adds both new contracts before unchanged focus and other checks');
const focusPath="      - 'scripts/homepage_invitation_focus_20261011_contract.mjs'\n";
const newPaths=["scripts/book_publication_date_20261011_contract.mjs","scripts/book_publication_date_20261011_contract.py","scripts/book_publication_date_20261011_inverse.mjs","scripts/book_publication_date_20261011_inverse.py","scripts/fixtures/book-publication-date-20261011.json"].map(file=>`      - '${file}'\n`).join('');
expected=replaceExact(prior(files[11]).toString(),focusPath,newPaths+focusPath,2);
expected=replaceExact(expected,focusCall,newCalls+focusCall);
eq(read(files[11]).toString(),expected,'Certification preserves every command/timeout/job and adds only new contracts plus dependency triggers');
const tracked=execFileSync('git',['ls-tree','-r','--name-only',BOOK_PUBLICATION_DATE_BASELINE],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
let immutableFiles=0,historicalFixtures=0,pdfs=0;
for(const file of tracked){
  if(files.includes(file))continue;
  eq(read(file),prior(file),file+': every other baseline source/artifact byte preserved');immutableFiles++;
  if(file.startsWith('scripts/fixtures/'))historicalFixtures++;
  if(file.endsWith('.pdf'))pdfs++;
}
for(const [file,pin]of [['scripts/fixtures/homepage-invitation-focus-20261011.json','4fbcdeb2cfa4aea4b141515100c02be04d3796db89025d516f97cc6a30c75c49'],['scripts/fixtures/homepage-sample-entry-20261011.json','08ea78334ab895c29d9bd057aa21194421e2aac7e11aa2a5f8efe3c24d49f253']])eq(sha(read(file)),pin,'Both completed hero fixture pins remain immutable');
for(const file of ['unknown.js','__proto__','workspace.html','pattern-trial.html','legal-document-manifest.json']){
 const source=Buffer.from('Outside the approved dated book-copy delta');eq(sourceBeforeBookPublicationDate20261011(file,source),source,file+': strict inverse leaves unlisted source alone');eq(sourceAtBookPublicationDateBaseline(file,source),source,file+': conditional inverse leaves unlisted source alone');
}
console.log(JSON.stringify({ok:true,checks,negativeControls,files:files.length,hunks,immutableFiles,historicalFixtures,pdfs,networkCalls:0,productionWrites:0,scope:'Five exact dated book mentions and matching search copies; all prior hero/admission/legal/research/PDF source bytes and checks preserved'}));
