"""Offline browser tests. All API, identity and mail operations are mocked."""
import asyncio, json, re, subprocess, tempfile
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE='https://www.monderman.com/'
INTEREST='I'*43
OPTOUT='O'*43
INVITE={'id':'invite-test','email':'qa@example.test','recipientName':'QA Recipient','organizationName':'QA Organization','expiresAt':'2026-10-19T18:00:00Z'}
LEGAL={'ok':True,'termsVersion':'2026-09-19-invitation-access','privacyNoticeVersion':'2026-09-19-invitation-access','requiresAcceptance':False}
checks=[]

def session(email): return {'access_token':'test-session-token','user':{'id':'test-user','email':email}}

async def harness(browser,state):
    context=await browser.new_context(viewport={'width':1100,'height':850})
    calls=[]; errors=[]
    async def handle(route):
        request=route.request; u=urlparse(request.url)
        calls.append({'url':request.url,'method':request.method,'body':request.post_data})
        if u.hostname=='cdn.jsdelivr.net':
            mock="""window.__mockSession=SESSION;
window.__localEffects=[];
window.supabase={createClient:()=>({auth:{
getSession:async()=>({data:{session:window.__mockSession}}),
getUser:async()=>({data:{user:window.__mockSession?.user}}),
onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
signOut:async()=>{window.__localEffects.push('signOut');window.__mockSession=null;return {error:null}},
signInWithOAuth:async(value)=>{window.__oauth=value;return {error:null}},
signInWithOtp:async()=>{window.__localEffects.push('sendOtp');return {error:null}},
verifyOtp:async()=>({data:{session:window.__mockSession}})
},from:()=>({select:()=>({eq:async()=>({count:0,error:null})})}),
rpc:async()=>{window.__localEffects.push('bootstrap');return {data:{organization_id:'workspace-test',organizations:{name:'QA Organization'}}}}
})};""".replace('SESSION',json.dumps(state.get('session')))
            await route.fulfill(content_type='application/javascript',body=mock); return
        if u.hostname=='ptkxrzgmeldalrkfruth.supabase.co':
            body=json.loads(request.post_data or '{}')
            if u.path.endswith('/invitation'):
                if state.get('expired') or body.get('token')!=INTEREST:
                    await route.fulfill(status=404,json={'ok':False,'error':'invitation_unavailable'});return
                await route.fulfill(json={'ok':True,'invitation':INVITE});return
            if u.path.endswith('/optout'):
                assert body=={'token':OPTOUT,'confirmed':True}
                if state.pop('fail_optout_once',False):
                    await route.fulfill(status=503,json={'ok':False,'error':'temporarily_unavailable'});return
                await route.fulfill(json={'ok':True,'suppressed':True});return
            raise AssertionError('Unexpected Supabase operation: '+u.path)
        if u.hostname=='monderman-api.onrender.com':
            if u.path=='/api/billing/pattern-pilot-invitation':
                await route.fulfill(json={'ok':True,'invitation':INVITE});return
            if u.path=='/api/legal/acceptance/status':
                result=dict(LEGAL)
                if 'source=trial' in u.query: result['requiresAcceptance']=True
                await route.fulfill(json=result);return
            if u.path=='/api/billing/organizations':
                await route.fulfill(json={'ok':True,'organizations':state.get('organizations',[])});return
            if u.path in ('/api/legal/acceptance','/api/billing/start-pattern-trial'):
                await route.fulfill(json={'ok':True});return
            raise AssertionError('Unexpected API operation: '+u.path)
        if u.hostname=='www.monderman.com':
            if u.path=='/dv-journey-recovery.js':
                await route.fulfill(content_type='application/javascript',body='window.MondermanDVJourneyRecovery={bindAuthenticatedReturn:async()=>{},clearPending(){}};');return
            path=ROOT/u.path.lstrip('/')
            if path.is_file() and path.suffix in ('.html','.js','.css'):
                content=path.read_text()
                # Test-only SRI removal lets the explicit, offline SDK mock load.
                if path.suffix=='.html': content=re.sub(r' integrity="[^"]+"','',content)
                await route.fulfill(content_type={'.html':'text/html','.js':'application/javascript','.css':'text/css'}[path.suffix],body=content);return
        await route.abort()
    await context.route('**/*',handle)
    page=await context.new_page()
    page.on('pageerror',lambda err:errors.append(str(err)))
    return context,page,calls,errors

def activation_calls(calls): return [c for c in calls if '/start-pattern-trial' in c['url']]
def optout_calls(calls): return [c for c in calls if c['url'].endswith('/optout')]

def syntax_checks():
    for filename in ('pattern-trial.html','signin.html'):
        content=(ROOT/filename).read_text()
        assert 'outreach-invitation.js' in content
        for script in re.findall(r'<script\b[^>]*>([\s\S]*?)</script>',content):
            if not script.strip(): continue
            with tempfile.NamedTemporaryFile(suffix='.mjs',mode='w') as target:
                target.write(script);target.flush()
                subprocess.run(['node','--check',target.name],check=True,capture_output=True)
    checks.append('all modified inline scripts parse')

async def main():
    syntax_checks()
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        state={'session':None}
        ctx,page,calls,errors=await harness(browser,state)
        await page.goto(BASE+'pattern-trial.html#invitation='+INTEREST)
        await page.wait_for_url('**/signin.html?next=pattern-trial.html')
        await page.wait_for_function("document.getElementById('emailInput').value==='qa@example.test'")
        assert 'QA Organization' in await page.locator('#signinSub').inner_text()
        assert not activation_calls(calls)
        assert await page.evaluate('window.__localEffects')==[]
        assert all(INTEREST not in c['url'] for c in calls)
        assert (await page.evaluate("JSON.parse(sessionStorage.getItem('monderman.outreachInvitation')).token"))==INTEREST
        checks.append('guest prefill and privacy-safe same-tab handoff; no account/trial/mail action')
        await page.wait_for_function("document.getElementById('sessionCheck').classList.contains('hidden')")
        await page.locator('#googleBtn').click()
        target=await page.evaluate('window.__oauth.options.redirectTo')
        assert 'next=pattern-trial.html' in target and INTEREST not in target
        checks.append('OAuth destination preserved without leaking invitation token')
        state['session']=session(INVITE['email'])
        await page.goto(BASE+'pattern-trial.html')
        await page.wait_for_function("document.getElementById('workspaceName').value==='QA Organization'")
        assert not await page.locator('#ackStart').is_checked()
        assert await page.locator('#startBtn').is_disabled()
        assert not activation_calls(calls)
        assert await page.evaluate('window.__localEffects')==[]
        checks.append('authenticated return restores organization; terms remain unchecked; no auto-activation')
        await page.locator('#ackStart').check()
        await page.locator('#startBtn').click()
        await page.wait_for_function("document.getElementById('msg').textContent.includes('Pattern is active')")
        assert len(activation_calls(calls))==1
        assert await page.evaluate('window.__localEffects')==['bootstrap']
        assert await page.evaluate("sessionStorage.getItem('monderman.outreachInvitation')") is None
        legal_posts=[c for c in calls if c['url'].endswith('/api/legal/acceptance') and c['method']=='POST']
        assert len(legal_posts)==1 and calls.index(legal_posts[0])<calls.index(activation_calls(calls)[0])
        checks.append('only explicit acknowledgement and final activation bootstrap/start; legal acceptance first')
        assert not errors,errors
        await ctx.close()

        for entry in ('pattern-trial.html','signin.html?next=pattern-trial.html'):
            ctx,page,calls,errors=await harness(browser,{'session':session('different@example.test')})
            await page.goto(BASE+entry+'#invitation='+INTEREST)
            selector='#msg' if entry.startswith('pattern') else '#signinStatus'
            await page.wait_for_function(f"document.querySelector('{selector}').textContent.includes('qa@example.test')")
            assert not activation_calls(calls)
            assert await page.evaluate('window.__localEffects')==[]
            assert not errors,errors
            await ctx.close()
        checks.append('wrong signed-in identity blocked at both pages; no automatic sign-out')

        ctx,page,calls,errors=await harness(browser,{'session':session(INVITE['email']),'expired':True})
        await page.goto(BASE+'pattern-trial.html#invitation='+INTEREST)
        await page.wait_for_function("document.getElementById('msg').textContent.includes('expired')")
        assert await page.locator('#startBtn').is_disabled() and not activation_calls(calls)
        assert not errors,errors
        await ctx.close()
        checks.append('expired or invalid invitation fails closed')

        ctx,page,calls,errors=await harness(browser,{'fail_optout_once':True})
        await page.goto(BASE+'email-preferences.html#optout='+OPTOUT)
        await page.wait_for_timeout(400)
        assert len(optout_calls(calls))==0
        await page.locator('#confirm').click()
        await expect(page.locator('#status')).to_contain_text('try again')
        assert not await page.locator('#confirm').is_disabled()
        await page.locator('#confirm').click()
        await expect(page.locator('#heading')).to_have_text('Your preference is saved.')
        assert len(optout_calls(calls))==2 and not activation_calls(calls)
        assert '#' not in page.url
        assert not errors,errors
        await ctx.close()
        checks.append('scanner page load causes zero preference writes; explicit confirmation and safe retry work')

        ctx,page,calls,errors=await harness(browser,{})
        await page.goto(BASE+'email-preferences.html#optout=bad-token')
        assert await page.locator('#confirm').is_disabled()
        assert not optout_calls(calls)
        await ctx.close()
        checks.append('malformed opt-out token cannot submit')
        await browser.close()
    print(json.dumps({'ok':True,'checks':checks,'real_emails_sent':0,'real_trials_started':0},indent=2))

asyncio.run(main())
