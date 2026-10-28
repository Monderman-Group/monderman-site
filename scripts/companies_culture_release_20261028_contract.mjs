// Raw successor admission and finite historical textual preconditions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const ROOT=path.resolve(import.meta.dirname,'..');
export const FIXTURE_SHA256='6de8e996525e166309d36c45cf21b2769ef1037083f0f4327d6f5e7ade859127';
const FILE='scripts/fixtures/companies-culture-release-20261028.json';
const BASELINE='a344cf9ba4c263d381fb4f94c77ca16b3f6a5f8f';
const SOURCE_TEXT_PRECONDITIONS=Object.freeze(['index.html','research.html','research-topics.html','sitemap.xml','public-search-index.json','scripts/public_sample_fixture.mjs','scripts/refresh_public_sample_previews.mjs','accumulated-drag-department-of-war.html','built-to-please.html','every-node-for-itself.html','from-tokens-to-outcomes.html','the-art-of-interior-reasoning.html','we-gave-bureaucracy-the-fastest-tools.html']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',['-c','core.fsmonitor=false',...args],{cwd:ROOT}).toString();
function names(root){const out=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);assert.ok(!e.isSymbolicLink());if(e.isDirectory())walk(f);else{assert.ok(e.isFile());out.push(path.relative(root,f).split(path.sep).join('/'));}}}walk(root);return out.sort();}
function exact(root,rows,actual){
 if(new Set(actual).size!==actual.length||JSON.stringify([...actual].sort())!==JSON.stringify(rows.map(r=>r.path).sort()))return false;
 try{for(const r of rows){const f=path.join(root,r.path),before=fs.lstatSync(f,{bigint:true});if(!before.isFile()||before.isSymbolicLink())return false;const b=fs.readFileSync(f),after=fs.lstatSync(f,{bigint:true});for(const k of['dev','ino','mode','size','mtimeNs','ctimeNs'])if(before[k]!==after[k])return false;if(r.kind==='release_revision'){if(!/^\{"revision":"[a-f0-9]{40}"\}\n$/.test(b.toString()))return false;}else if(b.length!==r.bytes||sha(b)!==r.sha256||(before.mode&0o111n?'100755':'100644')!==r.mode)return false;}return true;}catch{return false;}
}
export function releaseLayer(){
 const raw=fs.readFileSync(path.join(ROOT,FILE));assert.match(FIXTURE_SHA256,/^[a-f0-9]{64}$/);assert.equal(sha(raw),FIXTURE_SHA256);
 const d=JSON.parse(raw);assert.equal(d.schema,'companies-culture-release-20261028-v1');
 function guards(){try{for(const f of d.guardFiles){const p=path.join(ROOT,f),s=fs.lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o111))return false;if(f===FILE)continue;const prefix=f.endsWith('.mjs')?'export const ':'';const pattern=new RegExp('^'+prefix+"FIXTURE_SHA256='([a-f0-9]{64}|FINAL_FIXTURE_SHA256_PENDING)'"+(prefix?';$':'$'),'gm'),text=fs.readFileSync(p,'utf8'),matches=[...text.matchAll(pattern)];if(matches.length!==1||matches[0][1]!==FIXTURE_SHA256)return false;const normalized=text.replace(pattern,prefix+"FIXTURE_SHA256='NORMALIZED_FIXTURE_PIN'"+(prefix?';':''));if(sha(normalized)!==d.guardTemplates[f])return false;}return sha(fs.readFileSync(path.join(ROOT,FILE)))===FIXTURE_SHA256;}catch{return false;}}
 const sourceExact=()=>{try{const current=git('ls-files','--cached','--others','--exclude-standard').split('\n').filter(Boolean).sort();return JSON.stringify(current)===JSON.stringify(d.sourcePaths)&&guards()&&exact(ROOT,d.sourceRows,current.filter(f=>!d.guardFiles.includes(f)));}catch{return false;}};
 return Object.freeze({sourceExact,channel(root){try{const c=JSON.parse(fs.readFileSync(path.join(root,'.well-known/monderman-questionnaire-release.json'))).channel;return['current','legacy'].includes(c)?c:null;}catch{return null;}},publicExact(root,channel){return sourceExact()&&Object.hasOwn(d.publicEditions,channel)&&exact(root,d.publicEditions[channel],names(root));}});
}

export function assertCurrentRelease(publicRoot=path.join(ROOT,'.render-public')){
 const layer=releaseLayer();assert.ok(layer.sourceExact(),'Complete actual successor source before browser observations');
 const root=path.resolve(publicRoot),channel=layer.channel(root);assert.ok(channel==='current'||channel==='legacy');assert.ok(layer.publicExact(root,channel),'Complete actual successor public artifact');
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.well-known/monderman-release.json'))).revision,git('rev-parse','HEAD').trim(),'Actual candidate revision');
 const data=JSON.parse(fs.readFileSync(path.join(ROOT,FILE)));return Object.freeze({channel,publicPaths:data.publicEditions[channel].map(r=>r.path)});
}

const PRIOR_TEXT_PATHS=new Set(["accumulated-drag-department-of-war.html", "ai-wont-land-in-the-middle.html", "built-to-please.html", "careers-privacy.html", "careers.html", "compensatory-systems.html", "decision-velocity-article.html", "designing-for-decision-velocity.html", "divide-and-rule-inside-the-company.html", "durable-organization.html", "every-node-for-itself.html", "fast-to-cut-slow-to-build.html", "from-tokens-to-outcomes.html", "governing-complexity.html", "hiring-blind-spot.html", "hold-collide-come-apart.html", "index.html", "institutional-performance-article.html", "merit-after-the-machine.html", "nothing-stays-tuned.html", "operational-systems-article.html", "posting-has-outgrown-the-job.html", "public-search-index.json", "quarter-trillion-friction-us-healthcare.html", "research-topics.html", "research.html", "scripts/public_sample_fixture.mjs", "scripts/refresh_public_sample_previews.mjs", "sitemap.xml", "structural-clarity-article.html", "terminal-fidelity.html", "the-art-of-interior-reasoning.html", "the-culture-trap-brief.html", "the-culture-trap.html", "the-drift-problem.html", "the-unmeasured-layer.html", "trenches-not-silos.html", "we-gave-bureaucracy-the-fastest-tools.html", "when-bureaucracy-became-the-obstacle.html"]);

function admittedSource(file,value){if(!PRIOR_TEXT_PATHS.has(file)||!(typeof value==='string'||Buffer.isBuffer(value)))return null;const data=JSON.parse(fs.readFileSync(path.join(ROOT,FILE))),row=data.sourceRows.find(r=>r.path===file);return row&&sha(value)===row.sha256&&releaseLayer().sourceExact()?row:null;}
function historyArgs(){return process.env.COMPANIES_CULTURE_WORKTREE_REVIEW==='1'?['--worktree']:[];}
function priorAPI(fn,file,root=null){const args=[path.join(ROOT,'scripts/companies_culture_release_20261028_contract.py'),...historyArgs(),'--history-api',fn,'--history-file',file];if(root!==null){const {channel}=assertCurrentRelease(root);args.push('--built',path.resolve(root),'--channel',channel);}return JSON.parse(execFileSync('python3',args,{cwd:ROOT,maxBuffer:32*1024*1024}));}
function decode(answer,original){if(answer.kind==='buffer'){const b=Buffer.from(answer.value,'base64');return typeof original==='string'?b.toString('utf8'):b;}return answer.value;}
function sourceAPI(fn,file,value){return admittedSource(file,value)?decode(priorAPI(fn,file),value):value;}
export const sourceAtReleaseBaseline=(file,value)=>sourceAPI('sourceAtReleaseBaseline',file,value);
export const sourceAtHomepageRefinementBaselineAtRelease=(file,value)=>sourceAPI('sourceAtHomepageRefinementBaselineAtRelease',file,value);
export const sourceAtMarketingRefreshBaselineAtRelease=(file,value)=>sourceAPI('sourceAtMarketingRefreshBaselineAtRelease',file,value);
export const sourceAtScopeBetaBaselineAtRelease=(file,value)=>sourceAPI('sourceAtScopeBetaBaselineAtRelease',file,value);
export const sourceBeforePublicCopyClarityAtRelease=(file,value)=>sourceAPI('sourceBeforePublicCopyClarityAtRelease',file,value);
export const sourceBeforeOverviewSiteCompatibilityAtRelease=(file,value)=>sourceAPI('sourceBeforeOverviewSiteCompatibilityAtRelease',file,value);
export function publicAtReleaseBaseline(file,value,root=path.join(ROOT,'.render-public')){if(!PRIOR_TEXT_PATHS.has(file))return value;const {channel}=assertCurrentRelease(root),d=JSON.parse(fs.readFileSync(path.join(ROOT,FILE))),row=d.publicEditions[channel].find(r=>r.path===file);if(!row||sha(value)!==row.sha256)return value;return decode(priorAPI('publicAtReleaseBaseline',file,root),value);}
export function historicalReleaseBrowserBodies(kind,root=path.join(ROOT,'.render-public')){assert.ok(kind==='scope'||kind==='design');const {channel}=assertCurrentRelease(root);const raw=execFileSync('python3',[path.join(ROOT,'scripts/companies_culture_release_20261028_contract.py'),...historyArgs(),'--built',path.resolve(root),'--channel',channel,'--browser-history',kind],{cwd:ROOT,maxBuffer:32*1024*1024});return new Map(JSON.parse(raw).map(([p,b])=>[p,Buffer.from(b,'base64')]));}
export const isCurrentReleaseSource=()=>releaseLayer().sourceExact();
export const assertCurrentReleaseChannel=root=>assertCurrentRelease(root).channel;
export const historicalScopeBetaBrowserBodiesAtRelease=root=>historicalReleaseBrowserBodies('scope',root);
export const historicalSiteDesignBrowserBodiesAtRelease=root=>historicalReleaseBrowserBodies('design',root);
export function isCurrentHomepageRefinementSourceAtRelease(value){if(!admittedSource('index.html',value))return false;const answer=priorAPI('isCurrentHomepageRefinementSourceAtRelease','index.html');assert.equal(answer.kind,'json');assert.equal(typeof answer.value,'boolean');return answer.value;}
export function assertSeriesPublicationSurfaceAtRelease(file,value,channel=null,root=path.join(ROOT,'.render-public')){const data=JSON.parse(fs.readFileSync(path.join(ROOT,FILE)));assert.ok(releaseLayer().sourceExact());if(channel!==null)assert.equal(assertCurrentRelease(root).channel,channel);const row=(channel===null?data.sourceRows:data.publicEditions[channel]).find(r=>r.path===file);assert.ok(row&&sha(value)===row.sha256,'Exact current publication bytes');if(file==='companies-dont-have-a-culture.html')return row;assert.ok(PRIOR_TEXT_PATHS.has(file),'Only named prior publication surfaces');return decode(priorAPI('assertSeriesPublicationSurfaceAtRelease',file,channel===null?null:root),value);}
