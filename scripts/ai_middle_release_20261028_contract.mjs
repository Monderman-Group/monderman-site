// Raw successor admission and finite historical textual preconditions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isCurrentHomepageRefinementSource as oldRefinementSource,sourceAtHomepageRefinementBaseline as oldRefinementBaseline} from './homepage_refinement_20261014_inverse.mjs';
import {sourceAtMarketingRefreshBaseline as oldMarketingBaseline} from './marketing_refresh_20261012_inverse.mjs';
import {sourceAtScopeBetaBaseline as oldScopeBaseline} from './scope_beta_20261014_inverse.mjs';
import {sourceBeforePublicCopyClarity as oldPublicCopy} from './public_copy_clarity_inverse.mjs';
import {assertSeriesPublicationSurface as oldSeriesSurface} from './hiring_work_design_series_20261017_inverse.mjs';
import {sourceBeforeOverviewSiteCompatibility as oldOverviewSite} from './report_overview_site_compatibility_inverse.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
export const FIXTURE_SHA256='b0bfe6b4b90f06aec51289933578f567b49fef27dbf2fb22d2f41dfbb0686afe';
const FILE='scripts/fixtures/ai-middle-release-20261028.json';
const BASELINE='c76fb3d01606b277ec2b5e0708ee1c0de9c82f00';
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
 const d=JSON.parse(raw);assert.equal(d.schema,'ai-middle-release-20261028-v1');
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

export function sourceAtReleaseBaseline(file,value){
 if(!SOURCE_TEXT_PRECONDITIONS.includes(file))return value;
 assert.ok(typeof value==='string'||Buffer.isBuffer(value));
 const data=JSON.parse(fs.readFileSync(path.join(ROOT,FILE))),row=data.sourceRows.find(r=>r.path===file);
 if(!row||sha(value)!==row.sha256||!releaseLayer().sourceExact())return value;
 const prior=execFileSync('git',['show',BASELINE+':'+file],{cwd:ROOT,maxBuffer:4*1024*1024});
 return typeof value==='string'?prior.toString('utf8'):Buffer.from(prior);
}

export function publicAtReleaseBaseline(file,value,publicRoot=path.join(ROOT,'.render-public')){
 // Frozen 29-article inventory; the new article has no historical text view.
 const priorArticles=JSON.parse(git('show',BASELINE+':article-audio-manifest.json')).articles.map(a=>a.path);
 if(!['index.html','research-topics.html','sitemap.xml','careers.html','careers-privacy.html',...priorArticles].includes(file))return value;
 assert.ok(typeof value==='string'||Buffer.isBuffer(value));
 const data=JSON.parse(fs.readFileSync(path.join(ROOT,FILE))),layer=releaseLayer(),root=path.resolve(publicRoot),channel=layer.channel(root),row=data.publicEditions[channel]?.find(r=>r.path===file);
 if(!row||sha(value)!==row.sha256||!layer.sourceExact()||!layer.publicExact(root,channel))return value;
 const worktree=process.env.AI_MIDDLE_WORKTREE_REVIEW==='1'?['--worktree']:[];
 const prior=execFileSync('python3',[path.join(ROOT,'scripts/ai_middle_release_20261028_contract.py'),...worktree,'--built',root,'--channel',channel,'--read-baseline-public',file],{cwd:ROOT,maxBuffer:4*1024*1024});
 return typeof value==='string'?prior.toString('utf8'):Buffer.from(prior);
}

export function historicalReleaseBrowserBodies(kind,publicRoot=path.join(ROOT,'.render-public')){
 assert.ok(kind==='scope'||kind==='design');const root=path.resolve(publicRoot),{channel}=assertCurrentRelease(root);
 const worktree=process.env.AI_MIDDLE_WORKTREE_REVIEW==='1'?['--worktree']:[];
 const raw=execFileSync('python3',[path.join(ROOT,'scripts/ai_middle_release_20261028_contract.py'),...worktree,'--built',root,'--channel',channel,'--browser-history',kind],{cwd:ROOT,maxBuffer:32*1024*1024});
 return new Map(JSON.parse(raw).map(([file,bytes])=>[file,Buffer.from(bytes,'base64')]));
}
export const isCurrentReleaseSource=()=>releaseLayer().sourceExact();
export const assertCurrentReleaseChannel=root=>assertCurrentRelease(root).channel;
export const historicalScopeBetaBrowserBodiesAtRelease=root=>historicalReleaseBrowserBodies('scope',root);
export const historicalSiteDesignBrowserBodiesAtRelease=root=>historicalReleaseBrowserBodies('design',root);
export const isCurrentHomepageRefinementSourceAtRelease=value=>oldRefinementSource(sourceAtReleaseBaseline('index.html',value));
export const sourceAtHomepageRefinementBaselineAtRelease=(file,value)=>oldRefinementBaseline(file,sourceAtReleaseBaseline(file,value));
export const sourceAtMarketingRefreshBaselineAtRelease=(file,value)=>oldMarketingBaseline(file,sourceAtReleaseBaseline(file,value));
export const sourceAtScopeBetaBaselineAtRelease=(file,value)=>oldScopeBaseline(file,sourceAtReleaseBaseline(file,value));
export const sourceBeforePublicCopyClarityAtRelease=(file,value)=>oldPublicCopy(file,sourceAtReleaseBaseline(file,value));
export const sourceBeforeOverviewSiteCompatibilityAtRelease=(file,value)=>oldOverviewSite(file,sourceAtReleaseBaseline(file,value));
export function assertSeriesPublicationSurfaceAtRelease(file,value,channel=null,root=path.join(ROOT,'.render-public')){
 if(file==='ai-wont-land-in-the-middle.html'){
  const data=JSON.parse(fs.readFileSync(path.join(ROOT,FILE)));assert.ok(releaseLayer().sourceExact());
  if(channel!==null)assert.equal(assertCurrentRelease(root).channel,channel);
  const row=(channel===null?data.sourceRows:data.publicEditions[channel]).find(r=>r.path===file);assert.ok(row&&sha(value)===row.sha256,'Exact new publication surface');return row;
 }
 return oldSeriesSurface(file,channel===null?sourceAtReleaseBaseline(file,value):publicAtReleaseBaseline(file,value,root),channel,root);
}
