import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Import from source as an explicit module; this static-site repo need not
// change its package module mode just to run the browser helper tests.
const source=await readFile(new URL('../synthesis-request-state.js',import.meta.url),'utf8');
const {createSynthesisRequestStore}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
class Storage{constructor(){this.values=new Map();}getItem(key){return this.values.get(key)??null;}setItem(key,value){this.values.set(key,String(value));}}
let checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rejects=async fn=>{await assert.rejects(fn,/Retry protection/);checks++;};
const storage=new Storage(),store=createSynthesisRequestStore({storage,crypto:webcrypto});
const body={run_ids:['run-a','run-b'],options:{mode:'depth',scopePolicy:'warn'}};
const first=await store.prepare('org-a','user-a',body);
equal(await store.prepare('org-a','user-a',{options:{scopePolicy:'warn',mode:'depth'},run_ids:body.run_ids}),first,'stable key for same payload despite property order');
equal(await createSynthesisRequestStore({storage,crypto:webcrypto}).prepare('org-a','user-a',body),first,'refresh recovers pending key from session storage');
equal(await Promise.all(Array.from({length:8},()=>store.prepare('org-a','user-a',body))),Array(8).fill(first),'concurrent prepares retain one key');
assert.throws(()=>store.beginNew(first),/Retry protection/);checks++;
for(const [org,user,payload] of [['org-b','user-a',body],['org-a','user-b',body],['org-a','user-a',{...body,run_ids:['run-b','run-a']}],['org-a','user-a',{...body,options:{mode:'cross_lens'}}]]){assert.notEqual((await store.prepare(org,user,payload)).requestId,first.requestId);checks++;}
store.complete(first);equal(await store.prepare('org-a','user-a',body),first,'completed result is still recovered until explicit new action');
store.beginNew(first);assert.notEqual((await store.prepare('org-a','user-a',body)).requestId,first.requestId);checks++;
for(const raw of ['not json','[]','null','{"bad":{"id":"not-a-uuid","complete":false}}']){
  const bad=new Storage();bad.setItem('mondermanSynthesisRequests:v1:org-a:user-a',raw);
  await rejects(()=>createSynthesisRequestStore({storage:bad,crypto:webcrypto}).prepare('org-a','user-a',body));
}
await rejects(()=>createSynthesisRequestStore({storage:{getItem(){throw Error('blocked');}},crypto:webcrypto}).prepare('org-a','user-a',body));
await rejects(()=>createSynthesisRequestStore({storage:{getItem(){return null;},setItem(){throw Error('quota');}},crypto:webcrypto}).prepare('org-a','user-a',body));
await rejects(()=>createSynthesisRequestStore({storage:{getItem(){return null;},setItem(){}},crypto:webcrypto}).prepare('org-a','user-a',body));
await rejects(()=>createSynthesisRequestStore({storage:new Storage(),crypto:{}}).prepare('org-a','user-a',body));
await rejects(()=>store.prepare('', 'user-a',body));
const descriptor=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw new Error('privacy-mode getter');}});
try{const privateStore=createSynthesisRequestStore({crypto:webcrypto});checks++;await rejects(()=>privateStore.prepare('org-a','user-a',body));}finally{if(descriptor)Object.defineProperty(globalThis,'sessionStorage',descriptor);else delete globalThis.sessionStorage;}
for(const raw of storage.values.values()){assert.doesNotMatch(raw,/run-a|run-b|includeNarrative|Bearer|score|report text/);checks++;}

// Execute the actual inline runSynthesis function, not a rewritten simulator.
const html=await readFile(new URL('../workspace-analysis.html',import.meta.url),'utf8');
const start=html.indexOf('    async function runSynthesis(){'),end=html.indexOf('\n    function renderSynthResult(',start);
assert.ok(start>=0&&end>start);checks++;
const actualFunction=html.slice(start,end);
function browser(storage=new Storage()){
  const nodes={synthRun:{disabled:false,textContent:''},synthResult:{innerHTML:'',children:[],appendChild(child){this.children.push(child);}},synthScopePolicy:{value:'warn'}},requests=[],rendered=[];
  const state={requests,rendered,fail:false,deleted:false,deferSession:null};
  const context=vm.createContext({
    console,JSON,Set,Error,synthesisInFlight:false,lastSynthesisRequest:null,synthSel:new Set(['run-a','run-b']),ws5OrgId:'org-a',
    synthesisRequestStore:createSynthesisRequestStore({storage,crypto:webcrypto}),sessionStorage:storage,SYNTH_MAX_SELECTED:5000,SYNTH_STORAGE_KEY:'result',API_BASE:'https://synthetic.invalid',
    $:id=>nodes[id],synthesisPreflight:()=>({mode:'depth'}),readSamplingFrame:()=>({target_population:10}),sEsc:String,
    document:{createElement:()=>({addEventListener(event,fn){this[event]=fn;}})},
    supabase:{auth:{getSession:async()=>{if(state.deferSession)await state.deferSession;return {data:{session:{access_token:'synthetic-token',user:{id:'user-a'}}}};}}},
    fetch:async(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});if(state.fail)throw new Error('synthetic lost response');if(state.deleted)return {ok:false,status:410,json:async()=>({ok:false,error:'synthesis_request_deleted',message:'Saved Synthesis was deleted.'})};return {ok:true,json:async()=>({ok:true,result:{synthesis_id:'saved-original'},synthesis:{id:'saved-original'}})};},
    renderSynthResult:(result,id)=>rendered.push({result,id}),
  });
  vm.runInContext(`${actualFunction}\n globalThis.invoke=runSynthesis;`,context);
  return {...state,context,nodes,storage,state};
}
const b=browser();let release;b.state.deferSession=new Promise(resolve=>release=resolve);
const pending=b.context.invoke();await b.context.invoke();equal(b.requests.length,0,'double tap ignored while session awaits');release();await pending;
equal(b.requests.length,1,'actual browser function sends one POST for two taps');
equal(b.requests[0].body.analysis_mode,'self_run_synthesis','own-run comparison uses the distinct server-enforced mode');
equal(b.requests[0].body.options.scopePolicy,'portfolio','self-run request cannot select a population scope');
equal(Object.hasOwn(b.requests[0].body.options,'samplingFrame'),false,'self-run request carries no invented population');
assert.match(b.requests[0].body.request_id,/^[0-9a-f-]{36}$/);checks++;
equal(b.requests[0].options.headers['X-Monderman-Organization-Id'],'org-a','selected organization accompanies key');
equal(b.rendered.length,1,'saved result rendered once');
const retry=browser();retry.state.fail=true;await retry.context.invoke();const failedId=retry.requests[0].body.request_id;
equal([retry.nodes.synthRun.disabled,retry.context.synthesisInFlight],[false,false],'failed transport re-enables retry');
equal(retry.nodes.synthResult.children.length,0,'unknown transport failure never offers automatic request replacement');
retry.state.fail=false;await retry.context.invoke();equal(retry.requests[1].body.request_id,failedId,'actual retry preserves key after lost response');
const refreshed=browser(retry.storage);await refreshed.context.invoke();equal(refreshed.requests[0].body.request_id,failedId,'fresh page preserves same request identity');
const reversed=browser(retry.storage);reversed.context.synthSel=new Set(['run-b','run-a']);await reversed.context.invoke();
equal(reversed.requests[0].body.request_id,failedId,'reselecting the same runs in reverse order after refresh preserves request identity');
equal(reversed.requests[0].body.run_ids,retry.requests[0].body.run_ids,'the normalized set is both hashed and transmitted unchanged');
const blocked=browser({getItem(){throw Error('blocked');},setItem(){}});await blocked.context.invoke();equal(blocked.requests.length,0,'storage refusal stops before any network mutation');
const changing=browser();let continueSession;changing.state.deferSession=new Promise(resolve=>continueSession=resolve);const switchPending=changing.context.invoke();changing.context.ws5OrgId='org-b';continueSession();await switchPending;
equal(changing.requests[0].options.headers['X-Monderman-Organization-Id'],'org-a','in-flight request retains its original organization');
equal(changing.rendered.length,0,'old organization result never rendered into newly selected workspace');
const deleted=browser();deleted.state.deleted=true;await deleted.context.invoke();const deletedKey=deleted.requests[0].body.request_id;
equal(deleted.nodes.synthResult.children.length,1,'confirmed tombstone offers explicit New action');
await deleted.context.invoke();equal(deleted.requests[1].body.request_id,deletedKey,'tombstone cannot silently renew before explicit action');
deleted.nodes.synthResult.children[0].click();deleted.state.deleted=false;await deleted.context.invoke();
assert.notEqual(deleted.requests[2].body.request_id,deletedKey);checks++;
assert.match(html,/synthesisRequestStore\.beginNew\(lastSynthesisRequest\)/);checks++;
console.log(`PASS Synthesis browser retry protection: ${checks} checks. Actual inline submit function executed in VM with synthetic auth/fetch/storage, plus helper refresh/privacy tests. No browser layout or live network claims.`);
