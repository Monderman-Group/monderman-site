// Read-only invitations. Readiness is decided by the server; this module never
// generates an analysis or derives eligibility from response counts.
const STORAGE_KEY='monderman.synthesis-ready-dismissals.v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST=/^[a-f0-9]{64}$/;
const LABELS={depth:'Depth Synthesis',cross_lens:'Cross-Lens Synthesis'};
const MAX_PAGES=20,REFRESH_MS=120000,MIN_REFRESH_MS=30000;
const usable=context=>context&&UUID.test(context.organizationId||'')&&UUID.test(context.userId||'')
  &&['admin','analyst'].includes(context.role)&&typeof context.token==='string'&&context.token.length>0&&context.canAnalyze!==false;
const identity=context=>usable(context)?[context.organizationId,context.userId,context.role].join(':'):'';
export function readyInvitations(payload,organizationId){
  if(!payload||payload.ok!==true||payload.organizationId!==organizationId||payload.canAnalyze!==true
    ||!Array.isArray(payload.items)||payload.items.length>10)throw new Error('readiness_unavailable');
  const now=Date.parse(payload.serverNow),expires=payload.evaluationExpiresAt===null?null:Date.parse(payload.evaluationExpiresAt);
  if(!Number.isFinite(now)||Math.abs(Date.now()-now)>300000||(expires!==null&&(!Number.isFinite(expires)||expires<=now)))throw new Error('readiness_stale');
  if(typeof payload.hasMore!=='boolean'||(payload.hasMore?!UUID.test(payload.nextCursor||''):payload.nextCursor!==null))throw new Error('readiness_page_invalid');
  return payload.items.map(item=>{
    const mode=item?.kind;
    if(!UUID.test(item?.scopeId||'')||!LABELS[mode]||item.status!=='satisfied'||item.evaluated!==true
      ||!DIGEST.test(item.evidenceDigest||'')||!DIGEST.test(item.scopeDigest||'')||!DIGEST.test(item.snapshot||'')
      ||typeof item.policyVersion!=='string'||!item.policyVersion||item.policyVersion.length>120
      ||typeof item.label!=='string'||!item.label.trim()||item.label.length>180
      ||!Array.isArray(item.campaignIds)||!item.campaignIds.length||item.campaignIds.length>12||item.campaignIds.some(id=>!UUID.test(id)))throw new Error('readiness_item_invalid');
    return {scopeId:item.scopeId,label:item.label,kind:mode,evidenceDigest:item.evidenceDigest};
  });
}
export function mountSynthesisReadiness({element,getContext,apiBase,onReview,fetchImpl=window.fetch.bind(window),refreshMs=REFRESH_MS}){
  if(!element||typeof getContext!=='function')return null;
  const base=new URL(apiBase);if(!['https:','http:'].includes(base.protocol))throw new Error('readiness_origin_invalid');
  let destroyed=false,sequence=0,controller=null,interval=null,expiryTimer=null,lastAttempt=0,activeIdentity='',current=[],renderKey='',partial=false;
  const dismissed=new Set(),announced=new Set();
  element.classList.add('ws-readiness-invitations');element.hidden=true;
  const status=document.createElement('p');status.className='ws-ready-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  element.after(status);
  function clear(){current=[];renderKey='';element.hidden=true;element.replaceChildren();clearTimeout(expiryTimer);}
  function readDismissals(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
  function remember(key){
    dismissed.add(key);
    if(!DIGEST.test(key))return;
    try{const previous=readDismissals();previous[key]=Date.now();const recent=Object.entries(previous).filter(([k,v])=>DIGEST.test(k)&&Number.isFinite(v)).sort((a,b)=>b[1]-a[1]).slice(0,200);localStorage.setItem(STORAGE_KEY,JSON.stringify(Object.fromEntries(recent)));}catch{/* Storage is optional; memory dismissal still works. */}
  }
  async function dismissalKey(context,item){
    const value=[context.userId,context.organizationId,item.scopeId,item.kind].join('|');
    try{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
    catch{return 'memory:'+value;}
  }
  const node=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
  function render({announce=true}={}){
    const stored=readDismissals(),items=current.filter(item=>!dismissed.has(item.dismissalKey)&&!stored[item.dismissalKey]);
    const key=JSON.stringify([partial,items.map(item=>[item.dismissalKey,item.label])]);
    if(key===renderKey)return;renderKey=key;element.replaceChildren();element.hidden=!items.length;
    if(!items.length){if(announce)status.textContent='';return;}
    const heading=node('h2','Your campaign evidence is ready to review');element.append(heading,node('p','You have enough evidence for the analysis below. Review it when you are ready, or keep collecting responses. Nothing is generated automatically.'));
    const list=node('ul',null,'ws-ready-list');element.append(list);
    for(const item of items){
      const li=node('li');li.dataset.readyKind=item.kind;li.dataset.readyScope=item.scopeId;
      const copy=node('div');copy.append(node('h3',LABELS[item.kind]),node('p',item.label));
      const actions=node('div',null,'ws-ready-actions'),review=node('a','Review ready analysis');
      review.href='workspace-analysis.html?campaign_scope='+encodeURIComponent(item.scopeId)+'#campaignEvidence';
      review.setAttribute('aria-label','Review ready '+LABELS[item.kind]+' for '+item.label);
      review.addEventListener('click',async event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();const context=await Promise.resolve().then(getContext).catch(()=>null);if(destroyed||identity(context)!==activeIdentity||!identity(context)){clear();return;}try{if(onReview)await onReview(item.scopeId);else window.location.assign(review.href);}catch{status.textContent='The analysis could not be opened. Open Analyze to review the current evidence.';}});
      const keep=node('button','Keep collecting');keep.type='button';keep.setAttribute('aria-label','Keep collecting responses for '+item.label+'; dismiss this '+LABELS[item.kind]+' invitation');
      keep.addEventListener('click',()=>{remember(item.dismissalKey);render({announce:false});status.textContent='Invitation dismissed. You can still review this campaign’s readiness in Analyze whenever you choose.';const next=element.querySelector('a');if(next)next.focus();else{status.tabIndex=-1;status.focus();}});
      actions.append(review,keep);li.append(copy,actions);list.append(li);
    }
    if(partial)element.append(node('p','More saved definitions are available in Analyze. This invitation lists the ready analyses checked so far.','ws-ready-detail'));
    const newItems=items.filter(item=>!announced.has(item.dismissalKey));
    if(announce&&newItems.length){status.textContent=newItems.length===1?'A campaign analysis is ready to review. You may also keep collecting responses.':newItems.length+' campaign analyses are ready to review. You may also keep collecting responses.';newItems.forEach(item=>announced.add(item.dismissalKey));}
  }
  async function refresh(force=false){
    if(destroyed||document.hidden)return;
    const context=await Promise.resolve().then(getContext).catch(()=>null),key=identity(context);
    if(destroyed||document.hidden)return;
    if(!key){sequence++;controller?.abort();activeIdentity='';clear();status.textContent='';return;}
    if(key!==activeIdentity){clear();status.textContent='';activeIdentity=key;lastAttempt=0;}
    if(!force&&Date.now()-lastAttempt<MIN_REFRESH_MS)return;
    lastAttempt=Date.now();const ticket=++sequence;controller?.abort();controller=new AbortController();const signal=controller.signal;
    const timeout=setTimeout(()=>controller?.signal===signal&&controller.abort(),20000);
    try{
      let cursor=null,earliestExpiry=Infinity;const seen=new Set(),items=[];partial=false;
      for(let page=0;page<MAX_PAGES;page++){
        const url=new URL('/api/campaign-analysis/'+encodeURIComponent(context.organizationId)+'/readiness-summary',base);
        url.searchParams.set('limit','5');if(cursor)url.searchParams.set('after',cursor);
        const sentAt=performance.now();
        const response=await fetchImpl(url.href,{method:'GET',headers:{Authorization:'Bearer '+context.token,'X-Monderman-Organization-Id':context.organizationId},cache:'no-store',credentials:'omit',redirect:'error',signal});
        if(!response.ok)throw new Error('readiness_unavailable');const payload=await response.json();
        if(payload?.organizationId===context.organizationId&&payload.ok===true&&payload.canAnalyze===false){if(ticket===sequence){clear();status.textContent='';}return;}
        const pageItems=readyInvitations(payload,context.organizationId);
        if(payload.evaluationExpiresAt!==null)earliestExpiry=Math.min(earliestExpiry,sentAt+Date.parse(payload.evaluationExpiresAt)-Date.parse(payload.serverNow));
        for(const item of pageItems){const itemKey=item.scopeId+':'+item.kind;if(seen.has(itemKey))throw new Error('readiness_duplicate');seen.add(itemKey);item.dismissalKey=await dismissalKey(context,item);items.push(item);}
        if(!payload.hasMore)break;
        if(seen.has('cursor:'+payload.nextCursor))throw new Error('readiness_page_repeated');seen.add('cursor:'+payload.nextCursor);cursor=payload.nextCursor;
        if(page===MAX_PAGES-1)partial=true;
      }
      const latest=await Promise.resolve().then(getContext).catch(()=>null);
      if(destroyed||ticket!==sequence||signal.aborted)return;
      if(identity(latest)!==key||document.hidden){clear();return;}
      clearTimeout(expiryTimer);
      if(earliestExpiry<=performance.now()){clear();return;}
      current=items;if(!current.length)status.textContent='';render();
      if(Number.isFinite(earliestExpiry))expiryTimer=setTimeout(()=>{clear();status.textContent='';},Math.min(2147483647,earliestExpiry-performance.now()));
    }catch{if(ticket===sequence){clear();status.textContent='';}}
    finally{clearTimeout(timeout);}
  }
  function visible(){if(document.hidden){sequence++;controller?.abort();clear();}else void refresh(true);}
  function contextChanged(){sequence++;controller?.abort();activeIdentity='';clear();status.textContent='';void refresh(true);}
  function stored(event){if(event.key===STORAGE_KEY)render({announce:false});}
  function focus(){void refresh();}
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',focus);window.addEventListener('storage',stored);
  window.addEventListener('monderman:workspace-context-changed',contextChanged);
  interval=setInterval(()=>void refresh(),Math.max(MIN_REFRESH_MS,refreshMs));
  void refresh(true);
  return {refresh:()=>refresh(true),destroy(){destroyed=true;sequence++;controller?.abort();clearInterval(interval);clear();status.remove();document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',focus);window.removeEventListener('storage',stored);window.removeEventListener('monderman:workspace-context-changed',contextChanged);}};
}
