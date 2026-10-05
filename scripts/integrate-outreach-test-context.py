from pathlib import Path
import hashlib

root=Path(__file__).resolve().parents[1]
def edit(name,expected,changes):
    p=root/name
    raw=p.read_bytes()
    sha=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()
    if sha!=expected: raise RuntimeError('Unexpected original revision: '+name)
    source=raw.decode()
    for before,after,count in changes:
        if source.count(before)!=count: raise RuntimeError('Unexpected anchor count: '+name)
        source=source.replace(before,after)
    p.write_text(source)

edit('scripts/mobile_site_presentation_smoke.mjs','6e398be0a684a08a7f6886f9e19709f4f18cbcf3',[
    ("assert.equal(pages.length, 86, 'rendered root-page inventory includes Governance Part 5');","assert.equal(pages.length, 87, 'rendered inventory retains every prior page and adds email preferences');",1),
    ("assert.equal(shellFreePages.length, 14, 'functional shell-free page inventory changed unexpectedly');","assert.equal(shellFreePages.length, 15, 'functional shell-free inventory adds email preferences only');\nassert.ok(shellFreePages.includes('email-preferences.html'), 'opt-out remains a quiet functional surface');",1),
])
manifest="const manifest = JSON.parse(read('legal-document-manifest.json'));"
bridge="""
// Execute the current bridge helpers in the isolated VM as well. Only module
// export/import syntax is adapted; no production handler or assertion is removed.
const bridgeSource = read('outreach-invitation.js').replace(/^export /gm, '');
const bridgeImport = "    import { loadOutreachInvitation, clearOutreachInvitation, outreachEmailMatches, outreachSignInUrl, outreachErrorMessage } from './outreach-invitation.js';";
"""
trial='const trial=read(\'pattern-trial.html\').match(/<script type="module">([\\s\\S]*?)<\\/script>/)[1];'
edit('scripts/signin_legal_documents_smoke.mjs','913dc239d52c51dca93e3e331281fda39091c6c6',[
    (manifest,manifest+bridge,1),
    ('vm.createContext({ui,forwarded:false','vm.createContext({outreachContext:null,ui,forwarded:false',2),
    ('  vm.runInContext(signCode,ctx);','  vm.runInContext(bridgeSource,ctx);\n  vm.runInContext(signCode,ctx);',1),
    ("  vm.runInContext(signCode+'\\n'+authEvents,ctx);","  vm.runInContext(bridgeSource,ctx);\n  vm.runInContext(signCode+'\\n'+authEvents,ctx);",1),
    (trial,trial+"\nassert.equal(trial.split(bridgeImport).length,2,'Exactly one known outreach module import');\nconst trialExecutable=trial.replace(bridgeImport,'');",1),
    ("location:{search:'',replace:x=>redirects.push(x)}","location:{search:'',hash:'',replace:x=>redirects.push(x)}",1),
    ("  await vm.runInContext('(async()=>{'+trial+'})()',ctx);","  vm.runInContext(bridgeSource,ctx);\n  await vm.runInContext('(async()=>{'+trialExecutable+'})()',ctx);",1),
])
print('Exact two-file test-context integration applied. Production handlers and all old assertions retained.')
