// Actual state functions, with private choice handlers exposed only by this VM
// harness in memory. The separate browser suite exercises the visible controls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const original = fs.readFileSync(new URL('../first-run-telemetry.js', import.meta.url), 'utf8');
const source = original.replace(/\}\)\(\);\s*$/, 'window.__testChoose=choose;window.__testObserve=observeCurrentPage;})();');
const PREF = 'monderman_measurement_choice', VERSION = '2026-09-10-v1';
let checks = 0;
const plain = value => JSON.parse(JSON.stringify(value));
const equal = (a, b, message) => { assert.deepEqual(plain(a), plain(b), message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
function run(search = '', { saved = new Map(), preferences = new Map(), blockPreference = false, blockPreferenceWrites = false, blockPreferenceRemoval = false, blockSession = false, pathname = '/index.html' } = {}) {
  const requests = [], reads = [], writes = [], listeners = {}, windowListeners = [];
  let ids = 0, queries = 0;
  const storage = { getItem: key => { reads.push(key); if (blockSession) throw Error('blocked'); return saved.get(key) || null; }, setItem: (key, value) => { writes.push(key); if (blockSession) throw Error('blocked'); saved.set(key, value); }, removeItem: key => { if (blockSession) throw Error('blocked'); saved.delete(key); } };
  const context = {
    URL, Uint8Array, AbortController, URLSearchParams: class extends URLSearchParams { constructor(...args) { super(...args); queries++; } },
    location: { search, pathname, href: `https://www.monderman.com${pathname}${search}`, origin: 'https://www.monderman.com' }, sessionStorage: storage,
    localStorage: { getItem: key => { if (blockPreference) throw Error('blocked'); return preferences.get(key) || null; }, setItem: (key, value) => { if (blockPreference || blockPreferenceWrites) throw Error('blocked'); preferences.set(key, value); }, removeItem:key=>{if(blockPreference||blockPreferenceRemoval)throw Error('blocked');preferences.delete(key);} },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}` },
    document: { readyState: 'loading', addEventListener: (name, callback) => (listeners[name] ||= []).push(callback), querySelectorAll: () => [] },
    addEventListener: (name, callback) => windowListeners.push({ name, callback }),
    fetch: (_url, options) => { requests.push({ body: JSON.parse(options.body), credentials: options.credentials }); return Promise.resolve(); }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  function link(href) {
    const attributes = { href }, node = { getAttribute: name => attributes[name], setAttribute: (name, value) => attributes[name] = value };
    const click = () => listeners.click.forEach(callback => callback({ target: { closest: selector => selector === 'a[href]' ? node : null } }));
    click();
    return { href: () => attributes.href, set: value => attributes.href = value, click };
  }
  return { api: context.MondermanFirstRun, choose: context.__testChoose, observe: context.__testObserve, requests, reads, writes, saved, preferences, ids: () => ids, queries: () => queries, link, fire: (name, event = {}) => windowListeners.filter(item => item.name === name).forEach(item => item.callback(event)) };
}

for (const preference of [null, '{bad', JSON.stringify({version:'old',choice:'allow'}), JSON.stringify({version:VERSION,choice:'allow',extra:'bad'}), JSON.stringify({version:VERSION,choice:'deny'})]) {
  const result = run('?utm_source=PRIVATE_EMAIL&utm_campaign=PRIVATE_CAMPAIGN', { preferences: new Map(preference ? [[PREF, preference]] : []) });
  result.api.track('diagnostic_started'); result.api.trackOnce('score_displayed');
  equal(result.api.journeyId(), '', 'no identifier before choice');
  equal(result.api.attribution(), {acquisitionSource:'unknown',acquisitionCampaign:null}, 'no preconsent attribution');
  equal(result.api.measurementConsentVersion(), null, 'no preconsent assertion');
  equal(result.link('pilot.html?source=homepage').href(), 'pilot.html?source=homepage', 'no preconsent link decoration');
  equal([result.requests.length,result.reads.length,result.writes.length,result.ids(),result.queries()], [0,0,0,0,0], 'OFF means no optional activity, even direct helper calls');
}
for (const channel of ['linkedin','facebook','x','email','referral','direct','unknown']) {
  const result = run(`?utm_source=${channel}&utm_campaign=first-dv-202609&email=PRIVATE_EMAIL`);
  result.choose('allow'); result.api.track('diagnostic_started', {diagnosticDepth:10,email:'PRIVATE_EMAIL',answer:'PRIVATE_ANSWER'});
  equal(result.requests[0].body, {eventName:'diagnostic_started',journeyId:'00000000-0000-4000-8000-000000000001',pagePath:'/index.html',acquisitionSource:channel,acquisitionCampaign:'first-dv-202609',measurementConsentVersion:VERSION,diagnosticDepth:10}, `${channel}: consented finite fields`);
  equal(result.requests[0].credentials, 'omit', 'no authentication credentials');
  ok(!JSON.stringify([...result.saved]).includes('PRIVATE_'), 'no raw query or form storage');
}
for (const search of ['', '?utm_source=PRIVATE_EMAIL&utm_campaign=PRIVATE_CAMPAIGN', '?utm_source=linkedin&utm_source=email&utm_campaign=bad', '?utm_campaign=first-dv-202609&utm_campaign=PRIVATE_CAMPAIGN']) {
  const result = run(search); result.choose('allow'); equal(result.api.attribution(), {acquisitionSource:'unknown',acquisitionCampaign:null}, 'unknown or ambiguous tags are bounded');
}
const first = run('?utm_source=%20LinkedIn%20&utm_campaign=first-dv-202609'); first.choose('allow');
equal(run('?source=homepage', {saved:first.saved,preferences:first.preferences}).api.attribution(), {acquisitionSource:'linkedin',acquisitionCampaign:'first-dv-202609'}, 'consented refresh retains session attribution');
equal(run('?utm_source=facebook', {saved:first.saved,preferences:first.preferences}).api.attribution().acquisitionSource, 'linkedin', 'first consented tagged touch retained');
const target = first.link('pilot.html?source=decision_velocity#apply');
equal(target.href(), '/pilot.html?source=decision_velocity&utm_source=linkedin&utm_campaign=first-dv-202609#apply', 'only coarse tags forwarded after Allow');
equal(run(new URL(target.href(), 'https://www.monderman.com').search, {preferences:first.preferences}).api.attribution(), first.api.attribution(), 'new tab uses choice without shared journey storage');
for (const href of ['https://other.example/pilot.html','signin.html?next=pattern-trial.html','workspace-diagnostics.html?report=fixture','decision-velocity.html?resume=1','#apply']) equal(first.link(href).href(), href, 'functional and external URLs preserved');
const changed = first.link('decision-velocity.html'); changed.set('decision-velocity.html?resume=1');
first.saved.set('auth-token','KEEP'); first.saved.set('saved-report','KEEP'); first.choose('deny');
equal(target.href(), 'pilot.html?source=decision_velocity#apply', 'withdrawal restores own decoration');
equal(changed.href(), 'decision-velocity.html?resume=1', 'withdrawal preserves later functional edit');
equal([...first.saved], [['auth-token','KEEP'],['saved-report','KEEP']], 'withdrawal removes only measurement keys');
const count = first.requests.length; first.api.track('score_displayed'); first.api.journeyId(); first.api.attribution(); equal(first.requests.length, count, 'withdrawal stops future events');
const stale = run('?utm_source=email', {pathname:'/decision-velocity.html'});
stale.api.trackOnce('score_displayed'); stale.api.track('diagnostic_started'); stale.choose('allow'); equal(stale.requests, [], 'no preconsent replay on Allow');
stale.observe(); stale.observe(); equal(stale.requests.map(item=>item.body.eventName), ['diagnostic_page_viewed'], 'only newly observed current view once');
stale.preferences.set(PREF, JSON.stringify({version:VERSION,choice:'deny'})); stale.fire('storage',{key:PREF});
equal(stale.api.isMeasurementAllowed(), false, 'cross-tab withdrawal stops state'); equal([...stale.saved], [], 'cross-tab withdrawal clears local measurement keys');
for (const signal of ['pageshow','focus']) { const result = run(); result.choose('allow'); result.api.journeyId(); result.preferences.delete(PREF); result.fire(signal); equal(result.api.isMeasurementAllowed(), false, `${signal}: stale choice defaults off`); }
for (const settings of [{blockPreference:true},{blockSession:true}]) { const result = run('?utm_source=email', settings); result.choose('allow'); result.api.track('diagnostic_started'); equal(result.api.isMeasurementAllowed(), false, 'storage failure defaults off'); equal(result.requests, [], 'storage failure cannot emit events'); }
const legacy = run('?utm_source=email', {saved:new Map([['monderman_first_run_journey','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],['auth-token','KEEP']])}); legacy.choose('allow');
ok(legacy.api.journeyId() !== 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'first Allow does not reuse preconsent journey'); equal(legacy.saved.get('auth-token'), 'KEEP', 'Allow preserves required auth state');
const invalid = run(); invalid.choose('allow'); invalid.api.track('PRIVATE_EMAIL'); equal(invalid.requests, [], 'arbitrary event rejected');
const failedWithdraw = run('?utm_source=email', {preferences:new Map([[PREF, JSON.stringify({version:VERSION,choice:'allow'})]]), blockPreferenceWrites:true,blockPreferenceRemoval:true});
ok(failedWithdraw.api.isMeasurementAllowed(), 'old stored Allow starts normally');
failedWithdraw.choose('deny');
for (const signal of ['focus','pageshow','storage']) { failedWithdraw.fire(signal,{key:PREF}); failedWithdraw.api.track('score_displayed'); equal(failedWithdraw.api.isMeasurementAllowed(),false, `${signal}: failed withdrawal never revives old Allow`); }
equal(failedWithdraw.requests, [], 'failed withdrawal stops requests despite unchanged persisted Allow');
equal(JSON.parse(failedWithdraw.preferences.get(PREF)).choice,'allow','both blocked writes preserve old preference but cannot enable it in this tab');
const removable=run('',{preferences:new Map([[PREF,JSON.stringify({version:VERSION,choice:'allow'})],['auth-token','KEEP']]),blockPreferenceWrites:true});
removable.choose('deny');equal([...removable.preferences],[['auth-token','KEEP']],'failed choice save removes only old preference where removal works');
equal(run('',{preferences:removable.preferences}).api.isMeasurementAllowed(),false,'navigation cannot revive removed old Allow');
console.log(`ACQUISITION_CONSENT_PASS ${checks} assertions; zero network requests`);
