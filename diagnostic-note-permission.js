// An explicit participant choice, not a scoring answer or a server permission.
// Finalization validates the notice and run ownership, then records the actual
// saved-note permission. Browser storage cannot grant rights over another run.
(function(){
  'use strict';
  const VERSION='2026-09-11-ai-evidence-v1',PREFIX='monderman-note-choice-v1:';
  const memory=new Map(),DAY=86400000;
  function key(runId){return typeof runId==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(runId)?PREFIX+runId:null;}
  function get(runId){const k=key(runId);if(!k)return false;let row=memory.get(k);try{if(!row)row=JSON.parse(sessionStorage.getItem(k)||'null');}catch{}return row?.version===VERSION&&row.allowed===true&&Date.now()-row.at<DAY&&row.at<=Date.now();}
  function set(runId,allowed){const k=key(runId);if(!k)return;const row={version:VERSION,allowed:allowed===true,at:Date.now()};memory.set(k,row);try{sessionStorage.setItem(k,JSON.stringify(row));}catch{}}
  function value(runId){return get(runId)?{version:VERSION,allowed:true}:undefined;}
  function mount(parent,runId){
    if(!parent||!key(runId))return;
    const box=document.createElement('aside');box.className='diagnostic-note-permission';
    const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
    input.type='checkbox';input.checked=get(runId);input.addEventListener('change',()=>set(runId,input.checked));
    text.textContent="Allow these optional observations to inform my Diagnostic report and my organization’s Synthesis reports through Anthropic.";
    label.append(input,text);box.append(label);
    const help=document.createElement('p');help.textContent='Optional. Leaving this unchecked keeps the notes out of AI interpretation; the written notes may still be saved in the report. Monderman does not use customer content for model training. Standard API retention is not zero. Do not include personal, confidential, classified or controlled information. ';
    const link=document.createElement('a');link.href='privacy-2026-09-11-ai-evidence-v1.html';link.target='_blank';link.rel='noopener';link.textContent='Read the processing and retention notice';help.append(link);box.append(help);parent.append(box);
  }
  window.MondermanNotePermission=Object.freeze({version:VERSION,mount,value});
})();
