// Display-only source37 regression and exact inversion of the approved delta.
// No provider, browser, PDF, persistent report or score writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),sha=s=>createHash('sha256').update(s).digest('hex');
export const CURRENT='diagnostic-renderer-evidence-reading-20260913.37',PREVIOUS='diagnostic-renderer-evidence-reading-20260913.36';
const mapper='  function priorityReviewLabel(value) {\n    // Display wording only: keep the saved priority, order and values intact.\n    const label = firstStr(value, "Priority");\n    return label.toLowerCase() === "fix now" ? "First review" : label.toLowerCase() === "fix next" ? "Next review" : label;\n  }\n\n';
const styles=[
 ['color:#53676E;font-size:.75rem;font-variant-numeric:tabular-nums','color:#9A9892;font-size:.65rem;font-variant-numeric:tabular-nums'],
 ['.mr-dimension-detail{grid-column:2;font-size:.8rem;color:#53676E;margin-top:-4px}','.mr-dimension-detail{grid-column:2;font-size:.7rem;color:#9A9892;margin-top:-4px}'],
 ['.mr-dimension-detail b{float:right;color:#0C6E78;text-transform:uppercase;letter-spacing:.1em;font-size:.7rem}','.mr-dimension-detail b{float:right;color:#0C6E78;text-transform:uppercase;letter-spacing:.1em;font-size:.61rem}'],
];
export function renderer36StyleOutput(value){for(const [now,before]of styles)value=value.replaceAll(now,before);return value.replaceAll(CURRENT,PREVIOUS);}
export function sourceBeforeRenderer37(source){
 assert.equal(source.split(mapper).length,2);
 assert.equal(source.split('esc(priorityReviewLabel(row.priority))').length,3);
 for(const [now]of styles)assert.equal(source.split(now).length,2);
 const prior=renderer36StyleOutput(source).replace(mapper,'')
  .replaceAll('esc(priorityReviewLabel(row.priority))','esc(firstStr(row.priority, "Priority"))')
  .replace('// Follow saved categories/order; only the displayed fix labels say review.','// Follow the saved priority labels. Do not rewrite a historical ladder.');
 assert.equal(sha(prior),'4779a735ed89d7507a18353c3c15c6d7ac431b67e5c7626b1f1d882c2e407f59');
 return prior;
}
function run(){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=condition=>{assert.ok(condition);checks++;};
 const source=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8'),prior=sourceBeforeRenderer37(source);
 const load=text=>{const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'participant-evidence-safety.js'),'utf8'),context);vm.runInNewContext(text,context);return context.window.MondermanReport;};
 const report=load(source),old=load(prior);eq(report.rendererVersion,CURRENT);eq(old.rendererVersion,PREVIOUS);
 const luminance=hex=>{const values=hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2];};
 const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const detail=source.match(/\.mr-dimension-detail\{grid-column:2;font-size:([.\d]+)rem;color:(#[A-F\d]+);/);
 const axis=source.match(/\.mr-dimension-axis\{[^}]*color:(#[A-F\d]+);font-size:([.\d]+)rem/);
 ok(detail&&axis);ok(Number(detail[1])>=.8);ok(Number(axis[2])>=.75);
 ok(contrast(detail[2],'#FFFFFF')>=4.5);ok(contrast(axis[1],'#FFFFFF')>=4.5);
 ok(contrast('#0C6E78','#FFFFFF')>=4.5);
 for(const tool_type of ['operational_systems','decision_velocity','structural_clarity','institutional_performance']){
  for(const labels of [['Fix now','Fix next','Monitor'],['FIX NOW','FIX NEXT','Monitor'],['Monitor','Monitor','Monitor'],['Other category','Fix now pending',null]]){
   const raw={tool_type,score:53,band:'Synthetic recorded band',process_name:'Synthetic layout regression only',
    dimensions:{role_clarity:53,duplicate_approvals_inverse:null},dimension_labels:{role_clarity:'Role clarity',duplicate_approvals_inverse:'Avoidance of duplicate approvals'},
    coverage:{dimension_coverage:{role_clarity:{status:'measured',answered:3},duplicate_approvals_inverse:{status:'not_measured',answered:0}}},
    canonical_descriptor:{priority_ladder:labels.map((priority,i)=>({key:'synthetic-'+i,focus:'Synthetic focus '+i,priority,severity:50-i,pct:26-i}))},
    key_findings:['Recorded phrase: Fix now is an original category label.']};
   const before=JSON.stringify(raw),model=report.fromRun(raw),modelBefore=JSON.stringify(model),html=report.buildReportHtml(model);
   eq(JSON.stringify(raw),before);eq(JSON.stringify(model),modelBefore);
   eq(JSON.stringify(model.priorityLadder),JSON.stringify(raw.canonical_descriptor.priority_ladder));
   const plot=html.match(/<div class="mr-priority-matrix">([\s\S]*?)<div class="mr-priority-ladder">/)?.[1];
   const ladder=html.match(/<div class="mr-priority-ladder">([\s\S]*?)<\/section>/)?.[1];
   ok(plot&&ladder);
   for(const [i,label]of labels.entries()){
    const shown=label?.toLowerCase()==='fix now'?'First review':label?.toLowerCase()==='fix next'?'Next review':label||'Priority';
    ok(plot.includes('<small>'+shown+' · '+(50-i)+'</small>'));
    ok(ladder.includes('<div class="mr-lens-label">'+shown+'</div><strong>Synthetic focus '+i+'</strong>'));
    ok(plot.includes('data-rank="'+(i+1)+'"'));ok(ladder.includes('<em>'+(50-i)+'</em>'));
   }
   ok(html.includes('Recorded phrase: Fix now is an original category label.'));
   const oldHtml=old.buildReportHtml(old.fromRun(raw));
   const points=h=>[...h.matchAll(/class="mr-priority-point[^"]*" style="([^"]+)" data-rank="([^"]+)"/g)].map(m=>m.slice(1));
   eq(points(html),points(oldHtml));
   eq((html.match(/<em>(\d+)<\/em>/g)||[]),(oldHtml.match(/<em>(\d+)<\/em>/g)||[]));
   eq(html.includes('Monitoring priorities'),oldHtml.includes('Monitoring priorities'));
   ok(!/mr-priority-(?:urgent|critical|fix|now|next)/i.test(plot+ladder));
  }
 }
 const raw={tool_type:'structural_clarity',score:53,dimensions:{role_clarity:53,duplicate_approvals_inverse:null}};
 const html=report.buildReportHtml(report.fromRun(raw));
 ok(html.includes('Not measured')||html.includes('Score unavailable'));
 ok(html.includes('No score is available'));ok(html.includes('font-size:.8rem;color:#53676E'));
 eq(sha(fs.readFileSync(path.join(root,'monderman-report.js'))),sha(source));
 console.log(JSON.stringify({status:'PASS',checks,rendererVersion:CURRENT,detailContrastOnWhite:contrast(detail[2],'#FFFFFF'),originalInputsUnchanged:true,browser:'not_run',providerCalls:0,pdfs:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run();

