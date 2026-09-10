// Executes the actual browser tracking source in isolated local VM contexts.
// No network, authentication, customer records, or form submission is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../first-run-telemetry.js', import.meta.url), 'utf8');
let checks = 0;
const equal = (a, b, message) => { assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), message); checks++; };
function run(search = '', { saved = new Map(), blocked = false, pathname = '/index.html' } = {}) {
  const requests = [], listeners = {};
  const storage = { getItem: key => { if (blocked) throw Error('blocked'); return saved.get(key) || null; }, setItem: (key, value) => { if (blocked) throw Error('blocked'); saved.set(key, value); } };
  let sequence = 0;
  const context = {
    URL, URLSearchParams, Uint8Array, location: { search, pathname, href: `https://www.monderman.com${pathname}${search}`, origin: 'https://www.monderman.com' }, sessionStorage: storage,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
    document: { addEventListener: (name, callback) => (listeners[name] ||= []).push(callback), querySelectorAll: () => [] },
    fetch: (_url, options) => { requests.push({ body: JSON.parse(options.body), credentials: options.credentials }); return Promise.resolve(); }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  const api = context.MondermanFirstRun;
  function link(href) {
    const attributes = { href };
    const node = { getAttribute: name => attributes[name], setAttribute: (name, value) => attributes[name] = value };
    listeners.click.forEach(callback => callback({ target: { closest: selector => selector === 'a[href]' ? node : null } }));
    return attributes.href;
  }
  return { api, requests, saved, link };
}

for (const channel of ['linkedin', 'facebook', 'x', 'email', 'referral', 'direct', 'unknown']) {
  const result = run(`?utm_source=${channel}&utm_campaign=first-dv-202609&email=PRIVATE_EMAIL&referrer=PRIVATE_REFERRER`);
  result.api.track('diagnostic_started', { diagnosticDepth: 10, email: 'PRIVATE_EMAIL', answer: 'PRIVATE_ANSWER' });
  equal(result.requests[0].body, { eventName: 'diagnostic_started', journeyId: '00000000-0000-4000-8000-000000000001', pagePath: '/index.html', acquisitionSource: channel, acquisitionCampaign: 'first-dv-202609', diagnosticDepth: 10 }, `${channel}: bounded payload`);
  equal(result.requests[0].credentials, 'omit', 'anonymous fetch');
  assert.doesNotMatch(JSON.stringify([...result.saved]), /PRIVATE_/); checks++;
}
for (const search of ['', '?utm_source=PRIVATE_EMAIL&utm_campaign=PRIVATE_CAMPAIGN', '?utm_source=linkedin&utm_source=email&utm_campaign=bad', '?utm_campaign=first-dv-202609&utm_campaign=PRIVATE_CAMPAIGN']) {
  equal(run(search).api.attribution(), { acquisitionSource: 'unknown', acquisitionCampaign: null }, 'unknown/multiple values do not leak or imply direct traffic');
}
equal(run('?utm_source=%20LinkedIn%20').api.attribution(), { acquisitionSource: 'linkedin', acquisitionCampaign: null }, 'source normalization');
const first = run('?utm_source=linkedin&utm_campaign=first-dv-202609');
equal(run('?source=homepage', { saved: first.saved }).api.attribution(), { acquisitionSource: 'linkedin', acquisitionCampaign: 'first-dv-202609' }, 'same-tab propagation');
equal(run('?utm_source=facebook', { saved: first.saved }).api.attribution(), { acquisitionSource: 'linkedin', acquisitionCampaign: 'first-dv-202609' }, 'first tagged touch is not silently reattributed');
const stored = new Map([['monderman_first_run_attribution', JSON.stringify({ acquisitionSource: 'PRIVATE_EMAIL', acquisitionCampaign: 'PRIVATE_CAMPAIGN', private: 'PRIVATE_ANSWER' })], ['monderman_first_run_journey', 'PRIVATE_ID']]);
const sanitized = run('', { saved: stored, pathname: '/PRIVATE_EMAIL' });
sanitized.api.track('score_displayed', { diagnosticDepth: 'PRIVATE_ANSWER' });
equal(sanitized.requests[0].body.pagePath, '/unknown', 'only known static paths are emitted');
assert.doesNotMatch(JSON.stringify([...stored]) + JSON.stringify(sanitized.requests), /PRIVATE_/); checks++;
const blocked = run('?utm_source=email', { blocked: true });
blocked.api.track('diagnostic_started'); blocked.api.track('score_displayed');
equal(blocked.requests[0].body.journeyId, blocked.requests[1].body.journeyId, 'storage failure keeps memory-only journey consistent');
equal(blocked.api.attribution().acquisitionSource, 'email', 'storage failure retains bounded in-memory attribution');
const tagged = first.link('pilot.html?source=decision_velocity#application');
equal(tagged, '/pilot.html?source=decision_velocity&utm_source=linkedin&utm_campaign=first-dv-202609#application', 'new-tab destination carries only coarse attribution');
equal(run(new URL(tagged, 'https://www.monderman.com').search).api.attribution(), first.api.attribution(), 'new tab recovers tags without shared session storage');
equal(first.link('https://other.example/pilot.html'), 'https://other.example/pilot.html', 'external URL unchanged');
equal(first.link('signin.html?next=pattern-trial.html'), 'signin.html?next=pattern-trial.html', 'auth URLs untouched');
equal(first.link('workspace.html'), 'workspace.html', 'workspace URL untouched');
equal(first.link('workspace-diagnostics.html?report=00000000-0000-4000-8000-000000000001'), 'workspace-diagnostics.html?report=00000000-0000-4000-8000-000000000001', 'completed-run saved-report URL untouched');
equal(first.link('decision-velocity.html?resume=1'), 'decision-velocity.html?resume=1', 'DV recovery URL untouched');
equal(first.link('#application'), '#application', 'in-page anchor untouched');
equal(run().link('pilot.html?source=homepage'), 'pilot.html?source=homepage', 'untagged CTA unchanged');
const invalid = run();
invalid.api.track('PRIVATE_EMAIL', { answer: 'PRIVATE_ANSWER' });
equal(invalid.requests.length, 0, 'arbitrary event text rejected');
invalid.api.trackOnce('score_displayed', { diagnosticDepth: 10 });
invalid.api.trackOnce('score_displayed', { diagnosticDepth: 10 });
equal(invalid.requests.length, 1, 'one-time event remains deduplicated');
const copy = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(copy, /Join the pilot waitlist &middot; Applications open/); checks++;
assert.doesNotMatch(copy, /(?:filling|fulling)\s+(?:up|fast)/i); checks++;
console.log(`ACQUISITION_ATTRIBUTION_PASS ${checks} assertions; zero network requests`);
