"""Current article/series/topic closure before exact historical compatibility.

Historical assertions inspect only fully hash-bound 1858 bytes. Current content,
all source modes/blobs, every compiled body, and topic destinations are checked
here independently; unknown edits or names are never mapped to a baseline.
"""
import base64, hashlib, json, os, re, subprocess, sys
from pathlib import Path
from html.parser import HTMLParser
from html import unescape
from hiring_work_design_series_20261017_inverse import (
 ROOT,series_delta as D,sha,source_at_series_baseline as source_view,
 public_source_at_series_baseline as public_view,source_paths_at_series_baseline,
 public_paths_at_series_baseline,series_source_exact,series_public_exact,
)
BASE=D['baseline']
GUARDS=['scripts/fixtures/hiring-work-design-series-20261017.json','scripts/hiring_work_design_series_20261017_contract.py','scripts/hiring_work_design_series_20261017_inverse.mjs','scripts/hiring_work_design_series_20261017_inverse.py']
HELPER_HASHES={'scripts/hiring_work_design_series_20261017_inverse.mjs':'27f68efc308872ca720693dfa18880b30b20ae9f1bfd27c5fdb25d5e2c1e4c53','scripts/hiring_work_design_series_20261017_inverse.py':'640c3b3e5bc5ae7c04ae676065141421c27c86e63a395e8172f92dfa91dafc2b'}
AUDITED=False
CHECKS=0
NEGATIVES=0
PARITY=[]
def check(value,label):
 global CHECKS
 assert value,label
 CHECKS+=1
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def _git_rows(revision):
 out=[]
 for line in git('ls-tree','-rl',revision).decode().splitlines():
  info,name=line.split('\t',1);mode,kind,blob,size=info.split()
  check(kind=='blob' and mode in ('100644','100755'),'Regular authoritative source only '+name)
  out.append(dict(path=name,mode=mode,gitBlobSha1=blob,bytes=int(size)))
 return sorted(out,key=lambda r:r['path'])
def _row(path,value):return dict(path=path,bytes=len(value),sha256=sha(value))
class Links(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.hrefs=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a' and 'href' in a:self.hrefs.append(a['href'])
def audit_current_release():
 global AUDITED,NEGATIVES
 if AUDITED:return
 check(D['guardFiles']==GUARDS,'Four explicit independently reviewed bootstrap roots')
 check(sha((ROOT/'scripts/fixtures/hiring-blind-spot-publication-20261015.json').read_bytes())=='52abd075da1ae7474d41fb23f0635d1cbe7ca35c382a15490ffe5cac257919b6','Original combined native-publication and owner fixture remains byte-identical')
 check(git('rev-parse',BASE+'^{tree}').decode().strip()==D['baselineTree'],'Actual1858 authoritative tree')
 check(_git_rows(BASE)==D['baselineSourceRows'],'Full prior source path/mode/blob/size closure')
 names=git('ls-files','--cached').decode().splitlines()
 check(not git('ls-files','--others','--exclude-standard').strip(),'No untracked current source')
 check(not git('diff','--name-only','HEAD').strip() and not git('diff','--cached','--name-only','HEAD').strip(),'Current source must be clean committed bytes')
 check(sorted(names)==D['currentSourcePaths'] and len(names)==len(set(names)),'Exact current source inventory with every addition visible')
 heads={r['path']:r for r in _git_rows('HEAD')}
 check(sorted(heads)==sorted(names),'All current source is actually committed')
 for name in names:
  p=ROOT/name;check(p.is_file() and not p.is_symlink(),'Regular current source '+name)
  b=p.read_bytes();r=heads[name]
  check(len(b)==r['bytes'] and ('100755' if p.stat().st_mode&0o111 else '100644')==r['mode'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['gitBlobSha1'],'Physical current body/mode equals committed blob '+name)
 check(series_source_exact(),'Every non-bootstrap source current SHA/bytes/mode/blob exact')
 check(sorted(git('diff','--name-only',BASE,'HEAD').decode().splitlines())==D['changedSourcePaths'],'Closed actual changed source set')
 for file,digest in HELPER_HASHES.items():check(sha((ROOT/file).read_bytes())==digest,'Separately pinned finite implementation '+file)
 check(source_paths_at_series_baseline(names)==D['baselineSourcePaths'],'Exact current complete inventory projects only after raw audit')
 for mutant in [names+['UNKNOWN.js'],names+[names[0]],names[:-1]]:
  check(source_paths_at_series_baseline(mutant)==mutant,'Missing/extra/duplicate source remains visible');NEGATIVES+=1
 for file,entry in D['files'].items():
  b=(ROOT/file).read_bytes();prior=source_view(file,b)
  check(sha(b)==entry['after_sha256'] and len(b)==entry['after_bytes'],'Exact current finite file '+file)
  check(prior==git('show',BASE+':'+file),'Exact native1858 source recovered '+file)
  check(source_view(file,prior)==prior,'Historical input not inverted twice '+file)
  PARITY.append(['source',file,'bytes',base64.b64encode(b).decode(),sha(prior)])
  try:b.decode('utf8');prior.decode('utf8')
  except UnicodeError:pass
  else:
   check(source_view(file,b.decode())==prior.decode(),'Exact Unicode string type '+file)
   PARITY.append(['source',file,'str',base64.b64encode(b).decode(),sha(prior)])
  for mutant in [b+b'\n',b'UNAPPROVED'+b,b[1:],b+b'<script>fetch("/api/activate",{method:"POST"})</script>']:
   check(source_view(file,mutant)==mutant,'Unknown complete source remains visible '+file);NEGATIVES+=1
   PARITY.append(['source',file,'bytes',base64.b64encode(mutant).decode(),sha(mutant)])
 for unknown in ['__proto__','constructor','UNKNOWN.js','private-api.js']:
  for value in ['Unknown 😀',b'Unknown Unicode']:
   check(source_view(unknown,value)==value and public_view(unknown,value)==value,'Unknown path and type remain visible');NEGATIVES+=1
 # Certify actual current owned-navigation failure semantics before the exact
 # historical projection supplies the unchanged old consumer to older guards.
 navigation_name='scripts/homepage_sample_discovery_smoke.mjs'
 navigation_source=(ROOT/navigation_name).read_text()
 navigation_before=source_view(navigation_name,navigation_source)
 check(sha(navigation_before)=='11872d7c6f2170699ac4c33cb2ee13dd00bdec075baad72b3412c709d1a2be38' and len(navigation_before.encode())==16681,'Owned navigation exact native1858 before body')
 original_assertions=[line.strip() for line in navigation_before.splitlines() if line.strip().startswith('assert.')]
 current_assertions=iter(line.strip() for line in navigation_source.splitlines() if line.strip().startswith('assert.'))
 check(all(any(actual==expected for actual in current_assertions) for expected in original_assertions),'Every original navigation assertion line retained exactly and in order')
 def owned_navigation_intent(source):
  first=source.index('async function ownNavigationOperations(')
  last=source.index("process.once('exit',",first)
  helper=source[first:last]
  for token in [
   'let hasFirstRejection=false,firstRejection,hasObservationFailure=false,firstObservationFailure;',
   'let promise;try{promise=start();}catch(error){promise=Promise.reject(error);}',
   'if(!hasFirstRejection){hasFirstRejection=true;firstRejection=error;}',
   'const settled=await Promise.allSettled(pending);',
   "emit({status:'all-settled',settled});",
   'if(hasFirstRejection)throw firstRejection;',
   'if(hasObservationFailure)throw firstObservationFailure;',
   'return settled.map(result=>result.value);',
  ]:assert token in helper,'Owned navigation helper preserves '+token
  assert helper.index('await Promise.allSettled(pending)')<helper.index("emit({status:'all-settled',settled})")<helper.index('if(hasFirstRejection)throw firstRejection;')<helper.index('if(hasObservationFailure)throw firstObservationFailure;'),'Join precedes exact original-first error propagation and observer failures'
  original_operations=[
   "page.waitForRequest(request=>request.isNavigationRequest()&&new URL(request.url()).pathname===destination.path)",
   "page.waitForNavigation({waitUntil:'load'})",
   "page.locator(destination.selector).click()",
  ]
  assert all(source.count(operation)==1 for operation in original_operations),'Same three actual original browser operations remain once each'
  assert [source.index(operation) for operation in original_operations]==sorted(source.index(operation) for operation in original_operations),'Original request/navigation/click start order'
  assert source.count('const [request,response]=await ownNavigationOperations([')==1,'Exactly one owned original destination transaction'
  for token in [
   "{selector:'.hero-actions .btn-accent',path:'/pilot.html',query:'?source=homepage'}",
   "{selector:'.hero-actions .btn-secondary',path:'/sample-report.html',query:''}",
   "{selector:'.hero-invitation-link',path:'/pattern-trial.html',query:''}",
   "if(u.origin!==new URL(base).origin)return route.abort();",
   "[['chromium',chromium],['webkit',webkit]]",
   'for(const width of [320,390,768,834,1440])for(const javaScriptEnabled of [false,true])',
   'for(const viewport of entryViewports)for(const javaScriptEnabled of [false,true])',
   'const entryViewports=[{width:375,height:667},{width:390,height:844},{width:1280,height:720}];',
   "assert.equal(states,20,'All twenty existing browser states remain covered');",
   "assert.equal(entryStates,12,'All twelve exact-viewport entry states are covered');",
   "transaction.allOperationsSettled=true;navigationEvent({kind:'transaction-all-settled'",
   "navigationArtifact(name+'-FAILURE_BEFORE_CLEANUP.json'",
   "navigationEvent({kind:'browser-close-start',browser:name,priorFailure:engineFailed});",
   'if(cleanupFailed&&!engineFailed)throw cleanupError;',
   'if(engineFailed&&cleanupFailed)console.error(',
   "assert.equal(navigationTelemetryErrors.length,0,'All navigation and cleanup evidence is durably recorded');",
  ]:assert token in source,'Actual current original matrix, fence, evidence or cleanup invariant '+token
  assert source.index("navigationArtifact(name+'-FAILURE_BEFORE_CLEANUP.json'")<source.index("navigationEvent({kind:'browser-close-start'"),'Failure state recorded before browser cleanup'
  assert not re.search(r'(?:setDefault(?:Navigation)?Timeout\s*\(|\btimeout\s*:|\bforce\s*:\s*true)',source),'No new operation deadline override or forced click'
 owned_navigation_intent(navigation_source);check(True,'Actual current owned navigation matrix, first-error and cleanup semantics')
 for label,old,new in [
  ('missing complete ownership join','await Promise.allSettled(pending)','await Promise.all(pending)'),
  ('missing first-observed rejection flag','if(!hasFirstRejection){hasFirstRejection=true;firstRejection=error;}','firstRejection=error;'),
  ('observer masks original rejection','if(hasFirstRejection)throw firstRejection;\n  if(hasObservationFailure)throw firstObservationFailure;','if(hasObservationFailure)throw firstObservationFailure;\n  if(hasFirstRejection)throw firstRejection;'),
  ('changed original request predicate','request.isNavigationRequest()&&new URL(request.url()).pathname===destination.path','new URL(request.url()).pathname===destination.path'),
  ('raised click deadline','page.locator(destination.selector).click()','page.locator(destination.selector).click({timeout:60000})'),
  ('cleanup replaces original failure','if(cleanupFailed&&!engineFailed)throw cleanupError;','if(cleanupFailed)throw cleanupError;'),
  ('dropped original twelve states',"assert.equal(entryStates,12,'All twelve exact-viewport entry states are covered');",''),
  ('missing durable-evidence success assertion',"assert.equal(navigationTelemetryErrors.length,0,'All navigation and cleanup evidence is durably recorded');",''),
 ]:
  mutant=navigation_source.replace(old,new,1);check(mutant!=navigation_source,'Meaningful clearly fabricated owned-navigation negative '+label)
  try:owned_navigation_intent(mutant)
  except (AssertionError,ValueError):check(True,'Clearly fabricated owned-navigation negative rejects '+label);NEGATIVES+=1
  else:raise AssertionError('Synthetic owned-navigation negative unexpectedly accepted '+label)
 # Exact reviewed pure Promise controls are embedded to avoid a new source
 # file or any dependency on local evidence paths in hosted CI. They remain
 # explicitly fabricated controls, not browser or native-cause proof.
 navigation_controls_packed='Ly8gQ2xlYXJseSBmYWJyaWNhdGVkIHB1cmUgUHJvbWlzZSBjb250cm9scy4gTm8gYnJvd3Nlci9wcm9kdWN0L25hdGl2ZS9saXZlIGNsYWltLgovLyBQcmVwYXJlZCBvbmx5OyBydW4gYWZ0ZXIgcm9vdCArIGluZGVwZW5kZW50IHJldmlldyBhdXRob3JpemF0aW9uLgppbXBvcnQgYXNzZXJ0IGZyb20gJ25vZGU6YXNzZXJ0L3N0cmljdCc7CmltcG9ydCBmcyBmcm9tICdub2RlOmZzJzsKaW1wb3J0IHtjcmVhdGVIYXNofSBmcm9tICdub2RlOmNyeXB0byc7CmNvbnN0IHNvdXJjZVBhdGg9bmV3IFVSTCgnLi9ob21lcGFnZV9zYW1wbGVfZGlzY292ZXJ5X3Ntb2tlLnYyLlBST1BPU0VEX09OTFkubWpzJyxpbXBvcnQubWV0YS51cmwpOwpjb25zdCBzb3VyY2U9ZnMucmVhZEZpbGVTeW5jKHNvdXJjZVBhdGgsJ3V0ZjgnKTsKY29uc3Qgc2hhPWJ5dGVzPT5jcmVhdGVIYXNoKCdzaGEyNTYnKS51cGRhdGUoYnl0ZXMpLmRpZ2VzdCgnaGV4Jyk7CmFzc2VydC5lcXVhbChzaGEoc291cmNlKSwnYmU5MjE4MTgzOTg4N2YxOGZmMTRlZGVkNjQ1YjQ2Y2EwNGJlMjgwYmRmODM5NWI4MDBkOThhOTM1NTViZDFkMycpOwpjb25zdCBoZWxwZXI9c291cmNlLnNsaWNlKHNvdXJjZS5pbmRleE9mKCdhc3luYyBmdW5jdGlvbiBvd25OYXZpZ2F0aW9uT3BlcmF0aW9ucygnKSxzb3VyY2UuaW5kZXhPZigicHJvY2Vzcy5vbmNlKCdleGl0JywiLHNvdXJjZS5pbmRleE9mKCdhc3luYyBmdW5jdGlvbiBvd25OYXZpZ2F0aW9uT3BlcmF0aW9ucygnKSkpOwphc3NlcnQuZXF1YWwoc2hhKGhlbHBlciksJzNjY2NiY2QxYmQ4NDFhOGRhOTc0OWY5ZTU2YjkyNmIzYjgzNzA4ZjMyZTI2Mzk5MjRkNWZlM2FhN2E4NDg2ZGEnKTsKY29uc3Qge293bk5hdmlnYXRpb25PcGVyYXRpb25zfT1hd2FpdCBpbXBvcnQoJ2RhdGE6dGV4dC9qYXZhc2NyaXB0O2Jhc2U2NCwnK0J1ZmZlci5mcm9tKGhlbHBlcisnXG5leHBvcnQge293bk5hdmlnYXRpb25PcGVyYXRpb25zfTsnKS50b1N0cmluZygnYmFzZTY0JykpOwpjb25zdCByZXN1bHRzPVtdO2xldCBjaGVja3M9MDsKZnVuY3Rpb24gY2hlY2soYWN0dWFsLGV4cGVjdGVkLGxhYmVsKXthc3NlcnQuZGVlcEVxdWFsKGFjdHVhbCxleHBlY3RlZCxsYWJlbCk7Y2hlY2tzKys7fQpmdW5jdGlvbiBzYW1lKGFjdHVhbCxleHBlY3RlZCxsYWJlbCl7YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCxleHBlY3RlZCxsYWJlbCk7Y2hlY2tzKys7fQpmdW5jdGlvbiBkZWZlcnJlZCgpe2xldCByZXNvbHZlLHJlamVjdDtjb25zdCBwcm9taXNlPW5ldyBQcm9taXNlKCh5ZXMsbm8pPT57cmVzb2x2ZT15ZXM7cmVqZWN0PW5vO30pO3JldHVybntwcm9taXNlLHJlc29sdmUscmVqZWN0fTt9CmNvbnN0IG9wZXJhdGlvbnM9Wyd3YWl0Rm9yUmVxdWVzdCcsJ3dhaXRGb3JOYXZpZ2F0aW9uJywnY2xpY2snXTsKYXN5bmMgZnVuY3Rpb24gZmFicmljYXRlZChuYW1lLHtvcmRlcj1bXSxyZWFzb25zPXt9LHN5bmNJbmRleD0tMSxzeW5jUmVhc29uLG9ic2VydmVyRmFpbHVyZT1udWxsLGV4cGVjdGVkUmVqZWN0aW9uPWZhbHNlLGV4cGVjdGVkUmVhc29ufT17fSl7CiAgY29uc3QgZmFrZT1vcGVyYXRpb25zLm1hcCgoKT0+ZGVmZXJyZWQoKSksY2FsbHM9W10sZXZlbnRzPVtdOwogIGNvbnN0IG93bmVkPW93bk5hdmlnYXRpb25PcGVyYXRpb25zKG9wZXJhdGlvbnMubWFwKChvcGVyYXRpb24saW5kZXgpPT4oe29wZXJhdGlvbixzdGFydDooKT0+e2NhbGxzLnB1c2gob3BlcmF0aW9uKTtpZihpbmRleD09PXN5bmNJbmRleCl0aHJvdyBzeW5jUmVhc29uO3JldHVybiBmYWtlW2luZGV4XS5wcm9taXNlO319KSksZXZlbnQ9PntldmVudHMucHVzaChldmVudCk7aWYob2JzZXJ2ZXJGYWlsdXJlJiZldmVudC5vcGVyYXRpb249PT0nd2FpdEZvclJlcXVlc3QnJiZldmVudC5zdGF0dXM9PT0nc3RhcnRlZCcpdGhyb3cgb2JzZXJ2ZXJGYWlsdXJlO30pOwogIGxldCBzZXR0bGVkT2JzZXJ2ZWQ9ZmFsc2U7CiAgY29uc3Qgb2JzZXJ2ZWQ9b3duZWQudGhlbih2YWx1ZT0+e3NldHRsZWRPYnNlcnZlZD10cnVlO3JldHVybntzdGF0dXM6J2Z1bGZpbGxlZCcsdmFsdWV9O30scmVhc29uPT57c2V0dGxlZE9ic2VydmVkPXRydWU7cmV0dXJue3N0YXR1czoncmVqZWN0ZWQnLHJlYXNvbn07fSk7CiAgLy8gRWFjaCBzdGVwIGlzIGV4cGxpY2l0bHkgb3JkZXJlZCBmYWJyaWNhdGVkIHNldHRsZW1lbnQsIG5ldmVyIGEgYnJvd3NlciByZXRyeS4KICBpZihzeW5jSW5kZXg+PTApYXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7CiAgZm9yKGNvbnN0IGluZGV4IG9mIG9yZGVyKXtmYWtlW2luZGV4XS5yZWplY3QocmVhc29uc1tpbmRleF0pO2F3YWl0IFByb21pc2UucmVzb2x2ZSgpO30KICBjb25zdCByZWplY3RlZD1uZXcgU2V0KG9yZGVyKTsKICBmb3IobGV0IGluZGV4PTA7aW5kZXg8MztpbmRleCsrKWlmKGluZGV4IT09c3luY0luZGV4JiYhcmVqZWN0ZWQuaGFzKGluZGV4KSlmYWtlW2luZGV4XS5yZXNvbHZlKCdmYWJyaWNhdGVkLXZhbHVlLScraW5kZXgpOwogIGNvbnN0IHJlc3VsdD1hd2FpdCBvYnNlcnZlZDsKICBjaGVjayhjYWxscyxvcGVyYXRpb25zLG5hbWUrJzogYWxsIG9yaWdpbmFsIG9wZXJhdGlvbiBzdGFydHMgcmVtYWluIG9yZGVyZWQgb25jZScpOwogIGNoZWNrKGV2ZW50cy5maWx0ZXIoZXZlbnQ9PmV2ZW50LnN0YXR1cz09PSdzdGFydGVkJykubWFwKGV2ZW50PT5ldmVudC5vcGVyYXRpb24pLG9wZXJhdGlvbnMsbmFtZSsnOiB0aHJlZSBzdGFydHMgb2JzZXJ2ZWQnKTsKICBjaGVjayhldmVudHMuZmlsdGVyKGV2ZW50PT5ldmVudC5zdGF0dXM9PT0nZnVsZmlsbGVkJ3x8ZXZlbnQuc3RhdHVzPT09J3JlamVjdGVkJykubGVuZ3RoLDMsbmFtZSsnOiBhbGwgdGhyZWUgb3BlcmF0aW9ucyBhY3R1YWxseSBzZXR0bGUnKTsKICBjaGVjayhldmVudHMuZmlsdGVyKGV2ZW50PT5ldmVudC5zdGF0dXM9PT0nYWxsLXNldHRsZWQnKS5sZW5ndGgsMSxuYW1lKyc6IG9uZSBjb21wbGV0ZSBvd25lcnNoaXAgam9pbicpOwogIGNoZWNrKGV2ZW50cy5hdCgtMSkuc3RhdHVzLCdhbGwtc2V0dGxlZCcsbmFtZSsnOiBqb2luIHByZWNlZGVzIGZpbmFsIGZ1bGZpbGxtZW50L3JlamVjdGlvbicpOwogIHNhbWUoc2V0dGxlZE9ic2VydmVkLHRydWUsbmFtZSsnOiByZXR1cm5lZCBwcm9taXNlIG5hdHVyYWxseSBqb2luZWQnKTsKICBjaGVjayhyZXN1bHQuc3RhdHVzLGV4cGVjdGVkUmVqZWN0aW9uPydyZWplY3RlZCc6J2Z1bGZpbGxlZCcsbmFtZSsnOiBleHBlY3RlZCBvdXRjb21lJyk7CiAgaWYoZXhwZWN0ZWRSZWplY3Rpb24pc2FtZShyZXN1bHQucmVhc29uLGV4cGVjdGVkUmVhc29uLG5hbWUrJzogY2hyb25vbG9naWNhbCBmaXJzdCByZWFzb24gaWRlbnRpdHkgcHJlc2VydmVkJyk7CiAgZWxzZSBjaGVjayhyZXN1bHQudmFsdWUsWydmYWJyaWNhdGVkLXZhbHVlLTAnLCdmYWJyaWNhdGVkLXZhbHVlLTEnLCdmYWJyaWNhdGVkLXZhbHVlLTInXSxuYW1lKyc6IG9yaWdpbmFsIGZ1bGZpbGxtZW50IHZhbHVlcyByZXRhaW5lZCcpOwogIHJlc3VsdHMucHVzaCh7bmFtZSxwYXNzZWQ6dHJ1ZSxvcGVyYXRpb25TdGFydHM6Y2FsbHMsc3RhdHVzZXM6ZXZlbnRzLm1hcCgoe29wZXJhdGlvbixzdGF0dXN9KT0+KHtvcGVyYXRpb24sc3RhdHVzfSkpLHF1YWxpZmljYXRpb246J0NMRUFSTFlfRkFCUklDQVRFRF9QVVJFX1BST01JU0VfQ09OVFJPTF9OT1RfQlJPV1NFUl9QUk9EVUNUX1FBJ30pOwp9CmF3YWl0IGZhYnJpY2F0ZWQoJ2FsbCB0aHJlZSBmdWxmaWxsZWQnKTsKZm9yKGxldCBpbmRleD0wO2luZGV4PDM7aW5kZXgrKyl7Y29uc3QgZXJyb3I9bmV3IEVycm9yKCdmYWJyaWNhdGVkIGZpcnN0IHJlamVjdGlvbiAnK2luZGV4KTthd2FpdCBmYWJyaWNhdGVkKCdlYWNoIG9wZXJhdGlvbiBmaXJzdCByZWplY3RlZCAnK2luZGV4LHtvcmRlcjpbaW5kZXhdLHJlYXNvbnM6e1tpbmRleF06ZXJyb3J9LGV4cGVjdGVkUmVqZWN0aW9uOnRydWUsZXhwZWN0ZWRSZWFzb246ZXJyb3J9KTt9CnsKIGNvbnN0IGE9bmV3IEVycm9yKCdmYWJyaWNhdGVkIGlucHV0MCBsYXRlcicpLGI9bmV3IEVycm9yKCdmYWJyaWNhdGVkIGlucHV0MSBsYXRlc3QnKSxjPW5ldyBFcnJvcignZmFicmljYXRlZCBpbnB1dDIgZmlyc3QnKTsKIGF3YWl0IGZhYnJpY2F0ZWQoJ2xhdGUgbXVsdGlwbGUgcmVqZWN0aW9ucyByZXRhaW4gdGVtcG9yYWwgZmlyc3QgaW5wdXQyJyx7b3JkZXI6WzIsMCwxXSxyZWFzb25zOnswOmEsMTpiLDI6Y30sZXhwZWN0ZWRSZWplY3Rpb246dHJ1ZSxleHBlY3RlZFJlYXNvbjpjfSk7Cn0KLy8gU2FtZS10dXJuIHJlamVjdGVkIHByb21pc2VzOiBoYW5kbGVyIG9ic2VydmF0aW9uIG9yZGVyLCBub3QgYXJyYXkgc2VhcmNoIG9yZGVyLgp7CiBjb25zdCBhPW5ldyBFcnJvcignZmFicmljYXRlZCBzYW1lLXR1cm4gaW5wdXQwJyksYj1uZXcgRXJyb3IoJ2ZhYnJpY2F0ZWQgc2FtZS10dXJuIGlucHV0MScpLGM9bmV3IEVycm9yKCdmYWJyaWNhdGVkIHNhbWUtdHVybiBpbnB1dDIgZmlyc3QnKTsKIGNvbnN0IGNhbGxzPVtdLGV2ZW50cz1bXSxmYWtlPW9wZXJhdGlvbnMubWFwKCgpPT5kZWZlcnJlZCgpKTsKIGNvbnN0IHA9b3duTmF2aWdhdGlvbk9wZXJhdGlvbnMob3BlcmF0aW9ucy5tYXAoKG9wZXJhdGlvbixpbmRleCk9Pih7b3BlcmF0aW9uLHN0YXJ0OigpPT57Y2FsbHMucHVzaChvcGVyYXRpb24pO3JldHVybiBmYWtlW2luZGV4XS5wcm9taXNlO319KSksZXZlbnQ9PmV2ZW50cy5wdXNoKGV2ZW50KSk7CiBjb25zdCBqb2luZWQ9cC50aGVuKCgpPT4oe3N0YXR1czondW5leHBlY3RlZC1mdWxmaWxsbWVudCd9KSxyZWFzb249Pih7cmVhc29ufSkpOwogZmFrZVsyXS5yZWplY3QoYyk7ZmFrZVswXS5yZWplY3QoYSk7ZmFrZVsxXS5yZWplY3QoYik7CiBjb25zdCByZXN1bHQ9YXdhaXQgam9pbmVkO3NhbWUocmVzdWx0LnJlYXNvbixjLCdzYW1lLXR1cm4gZmlyc3QgcmVqZWN0aW9uIHByZXNlcnZlcyBpbnB1dDIgcmVhc29uJyk7Y2hlY2soY2FsbHMsb3BlcmF0aW9ucywnc2FtZS10dXJuIGFsbCBzdGFydHMgb25jZScpO2NoZWNrKGV2ZW50cy5maWx0ZXIoZT0+ZS5zdGF0dXM9PT0ncmVqZWN0ZWQnKS5tYXAoZT0+ZS5vcGVyYXRpb24pLFsnY2xpY2snLCd3YWl0Rm9yUmVxdWVzdCcsJ3dhaXRGb3JOYXZpZ2F0aW9uJ10sJ3NhbWUtdHVybiBvYnNlcnZlZCBjaHJvbm9sb2dpY2FsIG9yZGVyJyk7Y2hlY2soZXZlbnRzLmF0KC0xKS5zdGF0dXMsJ2FsbC1zZXR0bGVkJywnc2FtZS10dXJuIGFsbCBqb2luZWQnKTsKIHJlc3VsdHMucHVzaCh7bmFtZTonc2FtZS10dXJuIG11bHRpcGxlIHJlamVjdGlvbiBvcmRlciBkaWZmZXJzIGZyb20gaW5wdXQgb3JkZXInLHBhc3NlZDp0cnVlLHF1YWxpZmljYXRpb246J0NMRUFSTFlfRkFCUklDQVRFRF9QVVJFX1BST01JU0VfQ09OVFJPTF9OT1RfQlJPV1NFUl9QUk9EVUNUX1FBJ30pOwp9CmZvcihjb25zdCBbbGFiZWwsdmFsdWVdb2YgW1sndW5kZWZpbmVkJyx1bmRlZmluZWRdLFsnbnVsbCcsbnVsbF0sWyd6ZXJvJywwXSxbJ2ZhbHNlJyxmYWxzZV0sWydlbXB0eSBzdHJpbmcnLCcnXV0pewogY29uc3QgbGF0ZT1uZXcgRXJyb3IoJ2ZhYnJpY2F0ZWQgbGF0ZXIgcmVqZWN0aW9uIG11c3Qgbm90IHJlcGxhY2UgJytsYWJlbCk7CiBhd2FpdCBmYWJyaWNhdGVkKCdmYWxzZXkgZmlyc3QgcmVqZWN0aW9uICcrbGFiZWwse29yZGVyOlsxLDBdLHJlYXNvbnM6ezE6dmFsdWUsMDpsYXRlfSxleHBlY3RlZFJlamVjdGlvbjp0cnVlLGV4cGVjdGVkUmVhc29uOnZhbHVlfSk7Cn0KewogY29uc3QgZmlyc3Q9bmV3IEVycm9yKCdmYWJyaWNhdGVkIHN5bmNocm9ub3VzIHN0YXJ0IHRocm93JyksbGF0ZT1uZXcgRXJyb3IoJ2ZhYnJpY2F0ZWQgbGF0ZXIgYXN5bmMgcmVqZWN0aW9uJyk7CiBhd2FpdCBmYWJyaWNhdGVkKCdzeW5jaHJvbm91cyBzdGFydCB0aHJvdyBzdGlsbCBqb2lucyBzaWJsaW5ncycse3N5bmNJbmRleDoxLHN5bmNSZWFzb246Zmlyc3Qsb3JkZXI6WzBdLHJlYXNvbnM6ezA6bGF0ZX0sZXhwZWN0ZWRSZWplY3Rpb246dHJ1ZSxleHBlY3RlZFJlYXNvbjpmaXJzdH0pOwogYXdhaXQgZmFicmljYXRlZCgnZmFsc2V5IHN5bmNocm9ub3VzIHN0YXJ0IHRocm93IHN0aWxsIGpvaW5zIHNpYmxpbmdzJyx7c3luY0luZGV4OjEsc3luY1JlYXNvbjp1bmRlZmluZWQsb3JkZXI6WzBdLHJlYXNvbnM6ezA6bGF0ZX0sZXhwZWN0ZWRSZWplY3Rpb246dHJ1ZSxleHBlY3RlZFJlYXNvbjp1bmRlZmluZWR9KTsKfQp7CiBjb25zdCBvYnNlcnZlcj1uZXcgRXJyb3IoJ2ZhYnJpY2F0ZWQgb2JzZXJ2ZXIgZmFpbHVyZScpLG9yaWdpbmFsPW5ldyBFcnJvcignZmFicmljYXRlZCBvcmlnaW5hbCBvcGVyYXRpb24gcmVqZWN0aW9uJyk7CiBhd2FpdCBmYWJyaWNhdGVkKCdvYnNlcnZlciBmYWlsdXJlIGZhaWxzIGFmdGVyIGFsbCBvcmlnaW5hbCBvcGVyYXRpb25zIGZ1bGZpbGwnLHtvYnNlcnZlckZhaWx1cmU6b2JzZXJ2ZXIsZXhwZWN0ZWRSZWplY3Rpb246dHJ1ZSxleHBlY3RlZFJlYXNvbjpvYnNlcnZlcn0pOwogYXdhaXQgZmFicmljYXRlZCgnb2JzZXJ2ZXIgZmFpbHVyZSBjYW5ub3QgbWFzayBvcmlnaW5hbCByZWplY3Rpb24nLHtvYnNlcnZlckZhaWx1cmU6b2JzZXJ2ZXIsb3JkZXI6WzFdLHJlYXNvbnM6ezE6b3JpZ2luYWx9LGV4cGVjdGVkUmVqZWN0aW9uOnRydWUsZXhwZWN0ZWRSZWFzb246b3JpZ2luYWx9KTsKfQpjaGVjayhyZXN1bHRzLmxlbmd0aCwxNSwnYWxsIGZpZnRlZW4gY2xlYXJseSBmYWJyaWNhdGVkIG93bmVyc2hpcCBjb250cm9scyByYW4nKTsKY29uc3QgcmVjZWlwdD17c3RhdHVzOidDTEVBUkxZX0ZBQlJJQ0FURURfUFVSRV9PV05FUlNISVBfQ09OVFJPTFNfUEFTU19OT1RfQlJPV1NFUl9QUk9EVUNUX05BVElWRV9PUl9DQVVTQUxfUFJPT0YnLGNvbnRyb2xzOnJlc3VsdHMubGVuZ3RoLGNoZWNrcyxoZWxwZXJTaGEyNTY6c2hhKGhlbHBlcikscHJvcG9zZWRTb3VyY2VTaGEyNTY6c2hhKHNvdXJjZSkscmVzdWx0c307CmNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHJlY2VpcHQsbnVsbCwyKSk7Cg=='
 navigation_controls_bytes=base64.b64decode(navigation_controls_packed,validate=True)
 check(base64.b64encode(navigation_controls_bytes).decode()==navigation_controls_packed and sha(navigation_controls_bytes)=='1ae18f469bca80850fe08d5de6803c5f77161ba71c0e87e07d4ce35012f1b1a9','Whole exact reviewed fifteen fabricated ownership controls')
 navigation_controls=navigation_controls_bytes.decode()
 navigation_old_binding="const sourcePath=new URL('./homepage_sample_discovery_smoke.v2.PROPOSED_ONLY.mjs',import.meta.url);"
 check(navigation_controls.count(navigation_old_binding)==1,'One original fabricated-control source binding')
 navigation_current_binding='const sourcePath=new URL('+json.dumps((ROOT/navigation_name).as_uri())+');'
 navigation_program=navigation_controls.replace(navigation_old_binding,navigation_current_binding,1)
 check(navigation_program.replace(navigation_current_binding,navigation_old_binding,1)==navigation_controls,'Only exact source binding changes in the reviewed pure control program')
 navigation_result=subprocess.run(['node','--input-type=module','-e',navigation_program],cwd=ROOT,text=True,capture_output=True,check=True)
 navigation_control_result=json.loads(navigation_result.stdout)
 check(navigation_control_result['status']=='CLEARLY_FABRICATED_PURE_OWNERSHIP_CONTROLS_PASS_NOT_BROWSER_PRODUCT_NATIVE_OR_CAUSAL_PROOF' and navigation_control_result['controls']==15 and navigation_control_result['checks']==117 and navigation_control_result['helperSha256']=='3cccbcd1bd841a8da9749f9e56b926b3b83708f32e2639924d5fe3aa7a8486da' and navigation_control_result['proposedSourceSha256']=='be92181839887f18ff14eded645b46ca04be280bdf8395b800d98a93555bd1d3','All fifteen clearly fabricated pure ownership controls execute against the actual reviewed consumer; no browser cause claim')
 topics=json.loads((ROOT/'research-topics.json').read_bytes());articles=topics['articles'];topicids={t['id'] for t in topics['topics']}
 check(len(articles)==28 and len({a['path'] for a in articles})==28 and len(topicids)==17,'All28 articles and17 distinct topics')
 authored=[]
 for p in ROOT.glob('*.html'):
  if re.search(r'<meta\b(?=[^>]*property=["\']og:type["\'])(?=[^>]*content=["\']article["\'])',p.read_text(),re.I):authored.append(p.name)
 check(set(authored)|{'the-culture-trap.html'}=={a['path'] for a in articles},'All27 article-metadata pages plus the existing Culture Trap editorial page have keyword assignments')
 directory=Links();directory.feed((ROOT/'research-topics.html').read_text())
 check(topicids<=set(directory.ids),'Every keyword has a static working topic anchor')
 for a in articles:
  text=(ROOT/a['path']).read_text();links=Links();links.feed(text)
  check(text.count('<!-- MONDERMAN RESEARCH TOPICS: START -->')==1 and text.count('<!-- MONDERMAN RESEARCH TOPICS: END -->')==1,'One actual topic navigation '+a['path'])
  check(set('research-topics.html#'+x for x in a['topics'])<=set(links.hrefs),'All assigned keyword hyperlinks '+a['path'])
  peers={other['path'] for other in articles if other['path']!=a['path'] and set(a['topics'])&set(other['topics'])}
  check(bool(peers&set(links.hrefs)),'Real related article destinations '+a['path'])
  check(a['path'] in directory.hrefs,'Article reachable from topic directory '+a['path'])
  check('href="https://www.monderman.com/'+a['path']+'"' in text,'One canonical article route '+a['path'])
 subprocess.run([sys.executable,'scripts/build_research_topics.py','--check'],cwd=ROOT,check=True)
 subprocess.run([sys.executable,'scripts/build_public_search_index.py','--check'],cwd=ROOT,check=True)
 article=(ROOT/'posting-has-outgrown-the-job.html').read_text();hiring=(ROOT/'hiring-blind-spot.html').read_text();research=(ROOT/'research.html').read_text();home=(ROOT/'index.html').read_text()
 AI_PARTS=[
  ('from-tokens-to-outcomes.html','From Tokens to Outcomes','Monderman_Insight_From_Tokens_to_Outcomes_2026-08.pdf?v=20260906-publication2'),
  ('merit-after-the-machine.html','Merit After the Machine','Monderman_Insight_Merit_After_the_Machine_2026-09-02.pdf?v=20260924-copy'),
  ('every-node-for-itself.html','Every Node for Itself','Monderman_Insight_Every_Node_for_Itself_2026-09-02.pdf?v=20260906-publication2'),
  ('built-to-please.html','Built to Please','Monderman_Insight_Built_to_Please_2026-09-02.pdf?v=20260924-copy'),
 ]
 def ai_series_content(library,homepage,pages):
  sections=re.findall(r'<section class="series" aria-labelledby="ai-institutions-title">(.*?)</section>',library,re.S)
  assert len(sections)==1,'One actual AI and Institutions series'
  section=sections[0]
  ai_cards=re.findall(r'<article class="series-card">(.*?)</article>',section,re.S)
  assert len(ai_cards)==4,'AI series has exactly four parts'
  assert re.findall(r'class="series-chip">([^<]+)',section)==['Part '+str(n) for n in range(1,5)],'AI series ordered Parts1 through4'
  assert re.findall(r'<h3 class="series-card-title">([^<]+)</h3>',section)==[r[1] for r in AI_PARTS],'Tokens leads the original three AI articles in reading order'
  assert 'Four papers on AI economics, the evidence institutions use, independent review, and the risks of systems optimized in part for agreement.' in section,'AI deck includes four papers and their economics scope'
  additional=re.findall(r'<section class="library">(.*?)</section>',library,re.S)
  assert len(additional)==1 and 'HTML + PDF · 7 documents' in additional[0],'Additional research accurately declares seven documents'
  assert len(re.findall(r'<article class="paper-card\b',additional[0]))==7,'Actual Additional research contains seven cards'
  assert 'from-tokens-to-outcomes.html' not in additional[0] and 'From Tokens to Outcomes' not in additional[0],'Tokens is not duplicated in Additional research'
  carousel=re.findall(r'<article class="latest-card\b[^>]*>.*?</article>',homepage,re.S)
  assert len(carousel)==21,'All21 homepage cards remain'
  for number,((name,title,pdf),card) in enumerate(zip(AI_PARTS,ai_cards),1):
   assert card.count('class="series-chip">Part '+str(number)+'</span>')==1 and '<h3 class="series-card-title">'+title+'</h3>' in card,'Correct exact AI part/title association'
   assert card.count('publication-primary-link" href="'+name+'"')==1 and card.count('publication-secondary-link" href="'+pdf+'"')==1,'AI part retains exact original HTML and PDF destinations'
   assert library.count('publication-primary-link" href="'+name+'"')==1,'One current library listing per AI article'
   hero=re.search(r'<p class="article-kicker">(.*?)</p>',pages[name],re.S)
   assert hero and hero.group(1)=='Research insight · AI and Institutions · Part '+str(number),'Article hero has the same series and part'
   home_cards=[c for c in carousel if 'class="latest-card-link" href="'+name+'"' in c]
   assert len(home_cards)==1,'One original homepage destination per AI article'
   home_card=home_cards[0]
   assert home_card.count('<span class="placeholder-cover-chip">Series, Part '+str(number)+'</span>')==1,'Homepage AI cover shows correct part'
   assert home_card.count('<p class="latest-card-kicker">AI and Institutions · Part '+str(number)+' · Insight</p>')==1,'Homepage AI kicker shows correct series and part'
 ai_pages={name:(ROOT/name).read_text() for name,_,_ in AI_PARTS}
 ai_series_content(research,home,ai_pages);check(True,'Current library, carousel and all four AI article heroes agree on Parts1 through4')
 ai_section=re.findall(r'<section class="series" aria-labelledby="ai-institutions-title">(.*?)</section>',research,re.S)[0]
 ai_cards=re.findall(r'<article class="series-card">.*?</article>',ai_section,re.S)
 for label,mutate in [
  ('duplicate AI part',lambda r,h,p:(r.replace(ai_section,ai_section.replace('class="series-chip">Part 1</span>','class="series-chip">Part 2</span>',1),1),h,p)),
  ('wrong first AI article',lambda r,h,p:(r.replace(ai_cards[0],'AI_SYNTHETIC_SWAP_MARKER',1).replace(ai_cards[1],ai_cards[0],1).replace('AI_SYNTHETIC_SWAP_MARKER',ai_cards[1],1),h,p)),
  ('old three-paper deck',lambda r,h,p:(r.replace('Four papers on AI economics,','Three papers on AI economics,',1),h,p)),
  ('obsolete additional count',lambda r,h,p:(r.replace('HTML + PDF · 7 documents','HTML + PDF · 8 documents',1),h,p)),
  ('duplicate additional Tokens destination',lambda r,h,p:(r.replace('<div class="left">Additional research</div>','<div class="left">Additional research</div><a href="from-tokens-to-outcomes.html">From Tokens to Outcomes</a>',1),h,p)),
  ('changed AI PDF destination',lambda r,h,p:(r.replace(AI_PARTS[0][2],'UNAPPROVED.pdf',1),h,p)),
  ('wrong home Tokens part',lambda r,h,p:(r,h.replace('AI and Institutions · Part 1 · Insight','AI and Institutions · Part 4 · Insight',1),p)),
  ('wrong AI article hero part',lambda r,h,p:(r,h,{**p,AI_PARTS[0][0]:p[AI_PARTS[0][0]].replace('AI and Institutions · Part 1','AI and Institutions · Part 2',1)})),
 ]:
  changed=mutate(research,home,ai_pages)
  assert changed!=(research,home,ai_pages),'Synthetic AI negative must change its exact intended input '+label
  try:ai_series_content(*changed)
  except AssertionError:check(True,'Clearly synthetic AI series negative rejects '+label);NEGATIVES+=1
  else:raise AssertionError('Synthetic AI series negative unexpectedly accepted '+label)
 def prior_ai_carousel_labels(card):
  # Exact four reviewed presentation-label inverses only. All link, artwork,
  # title, summary, card position and other bytes remain in the equality below.
  for number,(name,_,_) in enumerate(AI_PARTS,1):
   if 'class="latest-card-link" href="'+name+'"' not in card:continue
   kicker='<p class="latest-card-kicker">AI and Institutions · Part '+str(number)+' · Insight</p>'
   chip='<span class="placeholder-cover-chip">Series, Part '+str(number)+'</span>'
   assert card.count(kicker)==1 and card.count(chip)==1,'Only exact reviewed AI card labels invert'
   prior_kicker='<p class="latest-card-kicker">'+('Enterprise' if number==1 else 'Artificial Intelligence')+' · Insight</p>'
   result=card.replace(kicker,prior_kicker,1)
   if number==1:
    assert result.count(chip+'\n')==1,'Only the new Tokens chip line is removed'
    result=result.replace(chip+'\n','',1)
   else:result=result.replace(chip,'<span class="placeholder-cover-chip">Series, Part '+str(number-1)+'</span>',1)
   return result
  return card
 check('Hiring and Work Design · Part 1' in hiring and 'Hiring and Work Design · Part 2' in article,'Requested new Part1 and Part2 labels')
 for name in ['posting-has-outgrown-the-job.html','hiring-blind-spot.html']:
  check(home.count('data-publication="'+name[:-5]+'"')==1,'One carousel entry '+name)
  for sitemap in ['sitemap.txt','sitemap.xml']:check((ROOT/sitemap).read_text().count('https://www.monderman.com/'+name)==1,'One canonical sitemap entry '+name)
 cards=re.findall(r'<article class="latest-card\b[^>]*>.*?</article>',home,re.S)
 check(len(cards)==21 and 'data-publication="posting-has-outgrown-the-job"' in cards[0] and 'data-publication="hiring-blind-spot"' in cards[1],'21carousel cards with Part2 thenPart1')
 prior_cards=re.findall(r'<article class="latest-card\b[^>]*>.*?</article>',git('show',BASE+':index.html').decode(),re.S)
 check(len(prior_cards)==20 and [prior_ai_carousel_labels(card) for card in cards[2:]]==prior_cards[1:],'All19 earlier native carousel cards retained byte-for-byte in order after only the exact reviewed four AI presentation-label inverses')
 governance=re.search(r'<section class="series" aria-labelledby="governance-performance-title">(.*?)</section>',research,re.S).group(1)
 series=re.search(r'<section class="series" aria-labelledby="hiring-work-design-title">(.*?)</section>',research,re.S).group(1)
 check(re.findall(r'class="series-chip">([^<]+)',governance)==['Part '+str(n) for n in range(1,7)],'Six unchanged Governance and Performance parts')
 check(re.findall(r'class="series-chip">([^<]+)',series)==['Part 1','Part 2'],'Two correctly ordered hiring series parts')
 check('24 items · Updated October 2026' in research,'Accurate current research item count')
 check(research.index('governance-performance-title')<research.index('hiring-work-design-title'),'New series follows Governance and Performance')
 check(series.count('<blockquote')==1 and 'A requirement the work does not need cannot select for the work.' in series,'One source-authored series pull quote')
 check('7 pages' in article and '10-minute read' in article,'New article current PDF and reading metadata')
 artwork=(ROOT/'assets/research/posting-has-outgrown-the-job-figure.png').read_bytes()
 check('src="data:image/png;base64,'+base64.b64encode(artwork).decode()+'"' in article,'Exact original PNG artwork embedded without negotiated transformation')
 for file in ['Monderman_Insight_The_Posting_Has_Outgrown_the_Job_2026-10-16.pdf','Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf']:
  b=(ROOT/file).read_bytes();check(b.startswith(b'%PDF-') and b.rstrip().endswith(b'%%EOF'),'Actual PDF envelope '+file)
 data=json.loads((ROOT/'pdf-src/posting-has-outgrown-the-job.json').read_bytes())
 check(len(data['paragraphs'])==30 and len(data['references'])==9,'All30 source paragraphs and9 references preserved in curated source')
 for paragraph in data['paragraphs']:
  match=re.search(r'<p\b[^>]*data-source-paragraph="'+str(paragraph['number'])+r'"[^>]*>(.*?)</p>',article,re.S)
  check(match is not None,'Every source paragraph appears in new HTML '+str(paragraph['number']))
  normalize=lambda text:re.sub(r'\s+','',unescape(re.sub(r'<[^>]+>','',text)))
  check(normalize(match.group(1))==normalize(paragraph['text']),'Every complete source paragraph is exact '+str(paragraph['number']))
 for number,reference in enumerate(data['references'],1):
  match=re.search(r'<li\b[^>]*data-source-reference="'+str(number)+r'"[^>]*>(.*?)</li>',article,re.S)
  check(match is not None and normalize(match.group(1))==normalize(reference),'Every complete source reference is exact '+str(number))
 # Current careers is checked as an actual résumé-intake surface before any
 # historical projection. These are semantic controls, separate from byte pins.
 role_source=(ROOT/'careers-role-data.js').read_text()
 role_start=role_source.index('  var data = {')+len('  var data = ')
 careers_data=json.JSONDecoder().raw_decode(role_source[role_start:])[0]
 career=(ROOT/'careers.html').read_text();notice=(ROOT/'careers-privacy.html').read_text()
 career_script=(ROOT/'careers.js').read_text();header=(ROOT/'site-shell/header.html').read_text();footer=(ROOT/'site-shell/footer.html').read_text()
 def careers_content(html,privacy,roles):
  rows=roles['roles'];locations=roles['workStates']
  assert len(rows)==20 and len({a['id'] for a in rows})==20,'Careers20 unique role slots'
  assert [a['slot'] for a in rows]==list(range(1,21)),'Careers complete ordered20 slots'
  assert len({re.sub(r' \(position [12]\)$','',a['title']) for a in rows})==17,'Careers17 role types'
  assert {g:sum(a['group']==g for a in rows) for g in ['product','research','delivery','operations']}=={'product':7,'research':4,'delivery':5,'operations':4},'Careers actual group counts'
  expected='AL AK AZ AR FL GA ID IN IA KS KY LA MI MS MO MT NE NH NM NC ND OK OR PA SC SD TN TX UT WV WI WY'.split()
  assert [a['code'] for a in locations]==expected,'Careers owner-authorized32 actual work locations'
  assert roles['workLocationPolicyId']=='careers-work-locations-20261018.1','Careers explicit work-location policy version'
  assert re.findall(r'data-work-state="([A-Z]{2})"',html)==expected,'All32 eligible work locations visible without JavaScript'
  select=re.search(r'<select\b[^>]*name="workState"[^>]*>(.*?)</select>',html,re.S)
  assert select and re.findall(r'<option value="([A-Z]{2})"',select.group(1))==expected,'Actual form has only the32 eligible work locations'
  assert 'You must be able to perform the role from an eligible state when employment begins.' in html,'Eligibility concerns place of work'
  assert 'Your current residence does not prevent you from applying if you can genuinely relocate and perform the role from an eligible state when employment begins.' in html,'Genuine relocation remains possible'
  excluded=re.search(r'<p id="career-excluded-locations"[^>]*>(.*?)</p>',html,re.S)
  assert excluded and all(name in excluded.group(1) for name in ['California','Colorado','Connecticut','Delaware','Hawaii','Illinois','Maine','Maryland','Massachusetts','Minnesota','Nevada','New Jersey','New York','Ohio','Rhode Island','Vermont','Virginia','Washington','District of Columbia']),'Excluded work jurisdictions are disclosed before applying'
  assert 'Accepting résumés · Remote · eligible U.S. work locations' in html and 'Explore the 20 positions below and submit your résumé for the roles that match your skills and experience.' in html,'Careers direct positions invitation and résumé intake'
  assert html.count('Submit your résumé for this position using the application form below.')==20,'Careers every position has a direct application instruction'
  assert '20 positions across 17 types of work.' in html and not any(phrase in html+privacy+career_script for phrase in ['We plan to fill','Hiring timelines','as recruitment progresses']),'Careers actual role types without obsolete planned or timing copy'
  assert re.findall(r'<details class="career-role"[^>]*data-role-id="([^"]+)"',html)==[a['id'] for a in rows],'Careers visible roles equal authored data'
  assert re.findall(r'name="roleInterest" value="([^"]+)"',html)==[a['id'] for a in rows],'Careers picker equals all actual roles'
  assert all(unescape('<strong>'+a['title']+'</strong>') in unescape(html) for a in rows),'Careers every actual title visible'
  cards=re.findall(r'<details class="career-role"[^>]*data-role-id="([^"]+)"[^>]*>(.*?)</details>',html,re.S)
  text=lambda value:unescape(re.sub(r'<[^>]+>','',value))
  for row,(role_id,card) in zip(rows,cards):
   assert role_id==row['id'],'Careers expanded card preserves its role identity'
   description=re.search(r'<p class="career-role-description">(.*?)</p>',card,re.S)
   assert description and text(description.group(1))==row['description'] and len(row['description'])>=100 and len(re.findall(r'[.!?](?:\s|$)',row['description']))>=2,'Every position has a longer complete role-specific description'
   bullet_count=0
   for key,css in [('responsibilities','career-responsibilities'),('qualifications','career-qualifications')]:
    listing=re.search(r'<ul class="'+css+r'">(.*?)</ul>',card,re.S)
    assert listing,'Every position separates responsibilities and qualifications'
    bullets=[text(value) for value in re.findall(r'<li>(.*?)</li>',listing.group(1),re.S)]
    assert bullets==row[key] and len(bullets)>=2 and all(len(value.strip())>=15 for value in bullets),'All substantive role bullets equal their authored data'
    bullet_count+=len(bullets)
   assert 5<=bullet_count<=10,'Every vacancy has five to ten substantive bullets'
   assert 'Remote · eligible U.S. work locations' in card,'Every position communicates restricted work locations'
  assert 'U.S. state where you would perform the work' in html,'Careers intended work location'
  assert 'Monderman, LLC is an equal opportunity employer.' in html and 'any other status protected by applicable law' in html,'Careers equal opportunity policy'
  assert 'We provide reasonable accommodations in the application process.' in html,'Careers application accommodation policy'
  for policy in ['You will not be penalized for doing so.','dates of school attendance or graduation','You may include verified work performed on a volunteer basis in your experience history.']:
   assert policy in html and policy in privacy,'Uniform application-materials instructions and privacy explanation'
  assert not re.search(r'(potential future position|not an active vacancy|not currently hiring|anywhere in the U\.S\.)',text(html+privacy),re.I),'No obsolete non-vacancy or nationwide-work claim'
  assert 'id="career-form-fields" disabled' in html and 'Résumé submissions are temporarily unavailable.' in html,'Careers defaults closed before config'
  for name in ['fullName','email','workState','roleInterest','resumePDF','privacyConsent','futureOpportunityAcknowledgement']:
   assert 'name="'+name+'"' in html,'Careers required field '+name
  assert 'name="resumePDF" type="file" accept=".pdf,application/pdf" required' in html,'Careers actual required PDF'
  assert 'Cover letter PDF <span class="career-optional">(optional)' in html and 'Portfolio or professional profile <span class="career-optional">(optional)' in html,'Careers optional materials'
  assert 'For questions, an accommodation or another way to apply' in html and all('href="mailto:careers@monderman.com"' in page and 'mailto:jason.adamson@monderman.com' not in page for page in [html,privacy]),'Careers and applicant privacy use the monitored Careers alternative'
  assert 'I have read the <a href="careers-privacy.html"' in html and 'does not guarantee an interview or employment' in html,'Careers notice acknowledgement and no guarantee'
  assert '12 months from submission, without automatic renewal' in privacy and 'up to four years from submission' in privacy,'Careers finite active and restricted retention'
  assert 'legal obligations or a legal hold' in privacy and 'actual recruitment follows the applicable recruitment retention schedule' in privacy,'Careers mandatory preservation distinction'
  assert 'Deletion is reviewed and performed manually, including recruiting copies in the owner’s email inbox' in privacy,'Careers mailbox copies covered by manual retention'
  assert 'does not subscribe you to a marketing campaign' in privacy and 'not used for AI ranking, organizational diagnostics or marketing' in privacy,'Careers purpose limitation'
  assert 'Applicant acknowledgement emails do not include those attachments' in privacy,'Careers applicant receipt contains no resume'
  assert 'salary history, citizenship, immigration documents or demographic monitoring information' in privacy,'Careers sensitive initial inquiries deferred'
  assert not re.search(r'"@type"\s*:\s*"JobPosting"',html),'Careers no false active JobPosting'
 careers_content(career,notice,careers_data);check(True,'Actual current careers20/17/positions/intake/notice/retention semantics')
 for label,mutate in [
  ('prominent status',lambda h,n,d:(h.replace('Accepting résumés · Remote · eligible U.S. work locations','Not currently hiring',1),n,d)),
  ('individual vacancy',lambda h,n,d:(h.replace('Submit your résumé for this position using the application form below.','Immediate start guaranteed',1),n,d)),
  ('unknown jurisdiction',lambda h,n,d:(h,n,{**d,'workStates':d['workStates']+[{'code':'PR','name':'Puerto Rico'}]})),
  ('excluded jurisdiction',lambda h,n,d:(h,n,{**d,'workStates':d['workStates']+[{'code':'CA','name':'California'}]})),
  ('missing expanded description',lambda h,n,d:(h.replace('class="career-role-description"','class="UNAPPROVED"',1),n,d)),
  ('missing vacancy bullets',lambda h,n,d:(h.replace('class="career-responsibilities"','class="UNAPPROVED"',1),n,d)),
  ('missing equal opportunity policy',lambda h,n,d:(h.replace('Monderman, LLC is an equal opportunity employer.','',1),n,d)),
  ('missing redaction protection',lambda h,n,d:(h.replace('You will not be penalized for doing so.','',1),n,d)),
  ('duplicate role',lambda h,n,d:(h,n,{**d,'roles':[d['roles'][0],d['roles'][0],*d['roles'][2:]]})),
  ('missing notice acknowledgement',lambda h,n,d:(h.replace('name="privacyConsent"','name="UNAPPROVED"'),n,d)),
  ('missing legal preservation',lambda h,n,d:(h,n.replace('legal obligations or a legal hold','unconditional deletion'),d)),
  ('missing mailbox retention',lambda h,n,d:(h,n.replace('Deletion is reviewed and performed manually, including recruiting copies in the owner’s email inbox','Storage cleanup only'),d)),
  ('false JobPosting',lambda h,n,d:(h+'<script type="application/ld+json">{"@type":"JobPosting"}</script>',n,d)),
 ]:
  try:careers_content(*mutate(career,notice,careers_data))
  except AssertionError:check(True,'Clearly synthetic careers negative rejects '+label);NEGATIVES+=1
  else:raise AssertionError('Synthetic careers negative unexpectedly accepted '+label)
 for name in ['careers.html','careers-privacy.html']:
  page=(ROOT/name).read_text()
  for token in ['favicon.svg?v=20260906-enterprise1','favicon.ico?v=20260906-enterprise1','favicon-192.png?v=20260906-enterprise1','apple-touch-icon.png?v=20260906-enterprise1','property="og:image"','name="twitter:card"']:
   check(token in page,'Current careers canonical metadata '+name+' '+token)
  for sitemap in ['sitemap.txt','sitemap.xml']:check((ROOT/sitemap).read_text().count('https://www.monderman.com/'+name)==1,'One careers sitemap route '+name)
  check(sum(a['url']==name for a in json.loads((ROOT/'public-search-index.json').read_text()))==1,'One actual careers search route '+name)
 check(header.count('href="careers.html"')==1 and footer.count('href="careers.html"')==1 and 'href="careers-privacy.html"' in career,'Current shared Careers destinations and actual form privacy link')
 check(not re.search(r'localStorage|sessionStorage|indexedDB',career_script),'Careers browser does not retain applicant materials')
 check('if (error.code === "outcome_unknown")' in career_script and 'Please do not submit again' in career_script,'Careers unknown upload outcome is preserved')
 if '--built' in sys.argv:
  build=Path(os.environ.get('HIRING_PUBLICATION_BUILD_ROOT',ROOT/'.render-public')).resolve();physical=sorted(p.relative_to(build).as_posix() for p in build.rglob('*') if p.is_file())
  check(not any(p.is_symlink() for p in build.rglob('*')),'No compiled symlinks')
  check(physical==D['currentPublicPaths'],'Exact physical current public closure')
  channel=json.loads((build/'.well-known/monderman-questionnaire-release.json').read_bytes())['channel']
  check(series_public_exact(build,channel),'All physical compiled current bodies bound')
  check(json.loads((build/'.well-known/monderman-release.json').read_bytes())=={'revision':git('rev-parse','HEAD').decode().strip()},'Truthful actual HEAD compiled marker')
  check(public_paths_at_series_baseline(physical,build)==D['baselinePublicPaths'],'Exact approved compiled inventory projects after raw binding')
  for mutant in [physical+['UNKNOWN.js'],physical+[physical[0]],physical[:-1]]:
   check(public_paths_at_series_baseline(mutant,build)==mutant,'Unknown/missing/duplicate public paths stay visible');NEGATIVES+=1
  for file,entry in D['publicEditions'][channel]['files'].items():
   b=(build/file).read_bytes();prior=public_view(file,b);check(sha(prior)==entry['before_sha256'] and len(prior)==entry['before_bytes'],'Exact prior official compiled channel body '+file)
   PARITY.append(['public',file,'bytes',base64.b64encode(b).decode(),sha(prior)])
   for mutant in [b+b'\n',b'UNAPPROVED'+b,b[1:],b+b'<script>fetch("/api/activate",{method:"POST"})</script>']:
    check(public_view(file,mutant)==mutant,'Unknown compiled bytes stay visible '+file);NEGATIVES+=1
    PARITY.append(['public',file,'bytes',base64.b64encode(mutant).decode(),sha(mutant)])
 node="import fs from 'node:fs';import{createHash}from'node:crypto';import{sourceAtSeriesBaseline as s,publicSourceAtSeriesBaseline as p}from'./scripts/hiring_work_design_series_20261017_inverse.mjs';const rows=JSON.parse(fs.readFileSync(0));for(const[k,f,t,b,h]of rows){const raw=Buffer.from(b,'base64'),v=t==='str'?raw.toString():raw,o=(k==='source'?s:p)(f,v);if((t==='str'?typeof o!=='string':!Buffer.isBuffer(o))||createHash('sha256').update(o).digest('hex')!==h)throw Error('Post1858 parity '+f);}console.log(rows.length);"
 result=subprocess.run(['node','--input-type=module','-e',node],cwd=ROOT,input=json.dumps(PARITY),text=True,capture_output=True,check=True)
 check(int(result.stdout.strip())==len(PARITY),'All ordered independent JS/Python byte/text positive/negative cases')
 AUDITED=True
 print(json.dumps(dict(ok=True,checks=CHECKS,negativeControls=NEGATIVES,parityCases=len(PARITY),sourceFiles=len(names),publicFiles=len(D['currentPublicPaths']),articles=28,topics=17,built='--built' in sys.argv,networkCalls=0,productionWrites=0)))
def historical_read(file):
 audit_current_release()
 return source_view(file,(ROOT/file).read_bytes())
def historical_public_read(root,file):
 audit_current_release()
 return public_view(file,(Path(root)/file).read_bytes())
def historical_public_names(names,root):
 audit_current_release()
 return public_paths_at_series_baseline(names,root)
def historical_git(*args):
 audit_current_release()
 # Only complete raw-current certification enables these exact old read shapes.
 if args==('ls-files','--cached'):return ('\n'.join(D['baselineSourcePaths'])+'\n').encode()
 if args==('ls-files','--others','--exclude-standard'):return b''
 if args in [('diff','--name-only','HEAD'),('diff','--cached','--name-only','HEAD')]:return b''
 if args==('ls-tree','-rl','HEAD'):return git('ls-tree','-rl',BASE)
 if args[-1:] == ('HEAD',) and args[:2] in [('diff','--name-only'),('diff','--raw')]:return git(*args[:-1],BASE)
 return git(*args)
if __name__=='__main__':audit_current_release()
