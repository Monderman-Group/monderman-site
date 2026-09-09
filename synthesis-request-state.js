// Retry identity only. No tokens, answers, report text or selected IDs are
// stored here. A completed request is renewed only by the explicit New action.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const fail=()=>{throw new Error('Retry protection could not be saved in this browser. Enable session storage or try another browser before building a Synthesis.');};
export function createSynthesisRequestStore({storage,crypto=globalThis.crypto}={}){
  // Some privacy modes throw on the getter itself. Keep Analysis usable and
  // fail only the attempted save, before a request can consume an allowance.
  const sessionStorage=()=>{try{return storage??globalThis.sessionStorage;}catch{fail();}};
  const keyFor=(organizationId,userId)=>{
    if(typeof organizationId!=='string'||typeof userId!=='string'||!organizationId||!userId)fail();
    return `mondermanSynthesisRequests:v1:${organizationId}:${userId}`;
  };
  function read(key){
    try{
      const raw=sessionStorage().getItem(key);if(raw===null)return {};
      if(raw.length>16384)fail();const value=JSON.parse(raw);
      if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length>50)fail();
      for(const [hash,entry] of Object.entries(value))if(!HASH.test(hash)||!entry||!UUID.test(entry.id)||typeof entry.complete!=='boolean')fail();
      return value;
    }catch{fail();}
  }
  function write(key,value){try{const raw=JSON.stringify(value),target=sessionStorage();target.setItem(key,raw);if(target.getItem(key)!==raw)fail();}catch{fail();}}
  return {
    async prepare(organizationId,userId,payload){
      const key=keyFor(organizationId,userId);
      if(!crypto?.subtle||typeof crypto.randomUUID!=='function')fail();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(payload)))))].map(b=>b.toString(16).padStart(2,'0')).join('');
      // Read after hashing so concurrent prepare calls do not overwrite each
      // other's keys. The caller also disables in-flight UI submissions.
      const records=read(key);
      if(!records[hash]){if(Object.keys(records).length>=50)fail();records[hash]={id:crypto.randomUUID(),complete:false};if(!UUID.test(records[hash].id))fail();write(key,records);}
      return {storageKey:key,payloadSha256:hash,requestId:records[hash].id};
    },
    complete(ticket){const records=read(ticket.storageKey),entry=records[ticket.payloadSha256];if(!entry||entry.id!==ticket.requestId)fail();entry.complete=true;write(ticket.storageKey,records);},
    beginNew(ticket){
      if(!ticket)return;
      const records=read(ticket.storageKey),entry=records[ticket.payloadSha256];
      // Never discard an unresolved request to turn an uncertain retry into a
      // new charge. Only a response-confirmed, explicitly renewed run changes.
      if(!entry||entry.id!==ticket.requestId||entry.complete!==true)fail();
      delete records[ticket.payloadSha256];write(ticket.storageKey,records);
    },
  };
}
