// Retired marketing measurement: offline proof, including former opt-ins and
// unavailable storage. Functional application records remain separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../first-run-telemetry.js',import.meta.url),'utf8');
let checks=0;
for(const mode of ['none','allow','deny','malformed','unavailable']){
 const local=new Map([['auth','keep'],['ai-permission','keep']]),session=new Map([['saved-run','keep'],['monderman_first_run_journey','prior'],['monderman_first_run_attribution','prior']]);
 if(mode!=='none')local.set('monderman_measurement_choice',mode==='malformed'?'{broken':JSON.stringify({choice:mode,version:'2026-09-10-v1'}));
 const storage=m=>({getItem:k=>m.get(k),setItem:()=>assert.fail('No new marketing storage'),removeItem:k=>{if(mode==='unavailable')throw Error('blocked');m.delete(k)}});
 const no=()=>assert.fail('Retired measurement attempted network, DOM or event work');
 const c={window:{},fetch:no,navigator:{sendBeacon:no},XMLHttpRequest:no,document:{createElement:no,addEventListener:no},localStorage:storage(local),sessionStorage:storage(session)};
 vm.runInNewContext(script,c);
 const x=c.window.MondermanFirstRun;
 for(const event of ['primary_cta_clicked','diagnostic_started','score_displayed','pilot_waitlist_submitted']){x.track(event,{email:'private@example.test'});x.trackOnce(event);}
 x.openMeasurementChoices();
 assert.equal(x.isMeasurementAllowed(),false);assert.equal(x.measurementConsentVersion(),null);assert.equal(x.journeyId(),'');assert.equal(x.attribution().acquisitionSource,'unknown');assert.equal(x.attribution().acquisitionCampaign,null);
 assert.equal(local.get('auth'),'keep');assert.equal(local.get('ai-permission'),'keep');assert.equal(session.get('saved-run'),'keep');
 if(mode!=='unavailable'){assert.equal(local.has('monderman_measurement_choice'),false);assert.equal(session.has('monderman_first_run_journey'),false);assert.equal(session.has('monderman_first_run_attribution'),false);}
 checks+=11;
}
const application=fs.readFileSync(new URL('../pilot-waitlist.js',import.meta.url),'utf8');
assert.doesNotMatch(application,/MondermanFirstRun|measurementConsentVersion|utm_|localStorage|sessionStorage/);
assert.match(application,/acquisitionSource: "unknown"/);assert.match(application,/acquisitionCampaign: null/);
assert.match(application,/pendingSubmission\.fingerprint !== fingerprint/);
assert.match(application,/if \(submitting\) return/);
console.log(JSON.stringify({passed:true,checks:checks+5,retired:true,networkCalls:0,unrelatedStoragePreserved:true}));
