"""Seal a reviewed full29 narration release, never a pending sample/draft.

All inputs are explicit. Prior source blobs come from the supplied immutable
Git baseline. Both before/after public builds must already exist and pass their
own build/release checks. This tool does not mutate the site or run hosting APIs.
"""
from pathlib import Path
import argparse,base64,hashlib,importlib.util,json,re,subprocess,zlib
from article_audio_20261026_inverse import GUARDS,SCHEMA,HASH,sha,names_in,git,REV,normalized_inverse
from inject_article_audio import EXPECTED_ARTICLES,validate_manifest,HEAD,SCRIPT,player,recover

def row(path,b,mode=None):
 r={'path':path,'bytes':len(b),'sha256':sha(b)}
 if mode:r.update(mode=mode,gitBlobSha1=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest())
 return r

def pin_inverses(source,fixture):
 """Only substitute the one normalized pin token in each sealed template."""
 raw=fixture.read_bytes();pin=sha(raw);d=json.loads(raw)
 for f in GUARDS[:-1]:
  p=source/f;b=p.read_bytes();normalized,_=normalized_inverse(f,b)
  assert normalized==d['guardTemplates'][f]['normalized_sha256']
  prefix='export const ' if f.endswith('.mjs') else ''
  pattern=re.compile(r"(?m)^"+re.escape(prefix)+r"FIXTURE_SHA256='([a-f0-9]{64}|FINAL_FIXTURE_SHA256_PENDING)'"+(r';$' if prefix else r'$'))
  replacement=prefix+"FIXTURE_SHA256='"+pin+"'"+(';' if prefix else '')
  updated,count=pattern.subn(replacement,b.decode('utf8'));assert count==1
  assert normalized_inverse(f,updated.encode())[0]==normalized
  p.write_text(updated)
 return pin

def seal(source,baseline,spec,manifest,review,before_builds,after_builds,output):
 source=source.resolve();assert re.fullmatch('[a-f0-9]{40}',baseline)
 assert spec['baseline']==baseline and spec['guardFiles']==GUARDS
 prior_fixture_path='scripts/fixtures/divide-rule-publication-20261025.json'
 prior_fixture_raw=git(source,'show',baseline+':'+prior_fixture_path);prior_fixture=json.loads(prior_fixture_raw)
 assert (source/prior_fixture_path).read_bytes()==prior_fixture_raw,'Prior Part7 fixture stays byte-identical'
 entries=validate_manifest(manifest,source)
 for k in ['voice_identity_sha256','voice_config_sha256','corpus_boundary_audit_sha256','narration_review_sha256']:assert HASH.fullmatch(manifest[k]),'Final immutable review binding '+k
 assert review['status']=='passed' and review['all29_reviewed'] is True and len(review['articles'])==29
 assert {a['path'] for a in review['articles']}==set(EXPECTED_ARTICLES)
 by={a['path']:a for a in review['articles']}
 for a in entries:
  r=by[a['path']]
  assert all(r[k]==a[k] for k in ['audio_sha256','script_sha256','source_sha256','bytes','duration_seconds'])
  assert r['decoded_aac'] is True and r['exact_source_coverage'] is True and r['all_chunks_accepted'] is True
 assert sha((json.dumps(review,ensure_ascii=False,indent=2)+'\n').encode())==manifest['narration_review_sha256'],'Canonical actual review evidence hash'
 baseline_rows=[]
 for line in git(source,'ls-tree','-rl',baseline).decode().splitlines():
  info,path=line.split('\t');mode,kind,oid,size=info.split();assert kind=='blob' and mode in {'100644','100755'}
  b=git(source,'show',baseline+':'+path);assert len(b)==int(size)
  baseline_rows.append(row(path,b,mode))
 before_paths=sorted(r['path'] for r in baseline_rows);prior={r['path']:r for r in baseline_rows}
 assert not set(spec['addedSourcePaths'])&set(before_paths)
 expected_current=sorted(before_paths+spec['addedSourcePaths']);actual=git(source,'ls-files','--cached','--others','--exclude-standard').decode().splitlines()
 assert len(actual)==len(set(actual)) and sorted(actual)==expected_current,'Exact proposed current source closure'
 changes=sorted(set(spec['changedSourcePaths']));assert changes==spec['changedSourcePaths']
 assert set(spec['addedSourcePaths'])<=set(changes) and not set(EXPECTED_ARTICLES)&set(changes),'No authored source HTML changes'
 blobs={};files={};source_rows=[];actual_changed=[]
 for f in expected_current:
  p=source/f;assert p.is_file() and not p.is_symlink();b=p.read_bytes();mode='100755' if p.stat().st_mode&0o111 else '100644'
  if f in before_paths:
   r=prior[f]
   if sha(b)!=r['sha256'] or mode!=r['mode']:
    actual_changed.append(f);assert mode==r['mode'],'No unreviewed existing mode change'
    prior_b=git(source,'show',baseline+':'+f);blobs[r['sha256']]=base64.b64encode(zlib.compress(prior_b,9)).decode()
    files[f]={'before_sha256':r['sha256'],'before_bytes':r['bytes'],'after_sha256':sha(b),'after_bytes':len(b)}
  else:actual_changed.append(f)
  if f not in GUARDS:source_rows.append(row(f,b,mode))
 assert sorted(actual_changed)==changes,'Every changed source path is explicitly proposed; no extra changes'
 assert all((source/f).is_file() for f in GUARDS)
 added_public=sorted([a['audio_path'] for a in entries]+['article-audio.css','article-audio.js'])
 assert len(added_public)==31 and len(set(added_public))==31
 editions={}
 for channel in ['current','legacy']:
  before=before_builds[channel].resolve();after=after_builds[channel].resolve();bp=names_in(before);ap=names_in(after)
  prior_edition=prior_fixture['publicEditions'][channel]
  assert bp==prior_edition['currentPaths'],'Before build is the full previously certified Part7 edition'
  for old_row in prior_edition['currentMap']:
   b=(before/old_row['path']).read_bytes()
   if old_row['path']=='.well-known/monderman-release.json':assert len(b)==56 and REV.fullmatch(b)
   else:assert len(b)==old_row['bytes'] and sha(b)==old_row['sha256'],'Actual prior certified public body '+old_row['path']
  assert set(ap)==set(bp)|set(added_public) and not set(bp)&set(added_public)
  assert json.loads((before/'.well-known/monderman-release.json').read_bytes())=={'revision':baseline}
  assert json.loads((before/'.well-known/monderman-questionnaire-release.json').read_bytes())['channel']==channel
  assert json.loads((after/'.well-known/monderman-questionnaire-release.json').read_bytes())['channel']==channel
  current_map=[];public_files={};baseline_map=[];actual_public_changed=[]
  for f in bp:baseline_map.append(row(f,(before/f).read_bytes()))
  for f in ap:
   p=after/f;assert p.is_file() and not p.is_symlink();b=p.read_bytes();r=row(f,b)
   if f=='.well-known/monderman-release.json':assert len(b)==56 and REV.fullmatch(b);r={'path':f,'kind':'release_revision','bytes':56}
   elif f in bp:
    old=(before/f).read_bytes()
    if old!=b:
     actual_public_changed.append(f);assert f in EXPECTED_ARTICLES
     e=next(a for a in entries if a['path']==f)
     assert recover(b.decode('utf8'),e).encode()==old,'Exact raw29 compiled body recovery'
     blobs[sha(old)]=base64.b64encode(zlib.compress(old,9)).decode();public_files[f]={'before_sha256':sha(old),'before_bytes':len(old),'after_sha256':sha(b),'after_bytes':len(b)}
   else:
    assert f in added_public
    source_b=(source/f).read_bytes();assert b==source_b,'Exact reviewed runtime/encoded asset copy'
   current_map.append(r)
  assert sorted(actual_public_changed)==list(EXPECTED_ARTICLES),'Exactly29 compiled pages differ, no other public body'
  editions[channel]={'baselinePaths':bp,'baselineMap':baseline_map,'currentPaths':ap,'currentMap':current_map,'files':public_files}
 templates={f:{'normalized_sha256':normalized_inverse(f,(source/f).read_bytes())[0],'mode':'100755' if (source/f).stat().st_mode&0o111 else '100644'} for f in GUARDS[:-1]}
 d={'schema':SCHEMA,'baseline':baseline,'baselineTree':git(source,'rev-parse',baseline+'^{tree}').decode().strip(),'priorPublicationFixtureSha256':sha(prior_fixture_raw),'guardFiles':GUARDS,'guardTemplates':templates,'baselineSourceRows':baseline_rows,'baselineSourcePaths':before_paths,'currentSourcePaths':expected_current,'sourceRows':source_rows,'changedSourcePaths':changes,'addedSourcePaths':spec['addedSourcePaths'],'files':files,'addedPublicPaths':added_public,'publicEditions':editions,'beforeBlobs':blobs,'articles':entries,'runtime_sha256':manifest['runtime_sha256'],'review':{k:manifest[k] for k in ['voice_identity_sha256','voice_config_sha256','corpus_boundary_audit_sha256','narration_review_sha256']}|{'all29_reviewed':True,'manifest_sha256':sha((json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode())},'qualification':'Actual reviewed29 narration source/media and exact current/legacy builds. Prior views only after complete current closure; unknown mutations remain visible. No native/reference WAVs or absolute paths.'}
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');return {'fixture':str(output),'sha256':sha(output.read_bytes()),'source_paths':len(expected_current),'public_paths':{c:len(e['currentPaths']) for c,e in editions.items()},'media_bytes':manifest['total_audio_bytes']}

def main():
 p=argparse.ArgumentParser();p.add_argument('--source-root',required=True,type=Path);p.add_argument('--baseline',required=True);p.add_argument('--delta-spec',required=True,type=Path);p.add_argument('--manifest',required=True,type=Path);p.add_argument('--review',required=True,type=Path)
 for c in ['current','legacy']:
  p.add_argument('--before-'+c,required=True,type=Path);p.add_argument('--after-'+c,required=True,type=Path)
 p.add_argument('--output',required=True,type=Path);p.add_argument('--write-pins',action='store_true');a=p.parse_args()
 result=seal(a.source_root,a.baseline,json.loads(a.delta_spec.read_text()),json.loads(a.manifest.read_text()),json.loads(a.review.read_text()),{c:getattr(a,'before_'+c) for c in ['current','legacy']},{c:getattr(a,'after_'+c) for c in ['current','legacy']},a.output)
 if a.write_pins:assert pin_inverses(a.source_root,a.output)==result['sha256'];result['inverse_pins_written']=True
 print(json.dumps(result,sort_keys=True))
if __name__=='__main__':main()
