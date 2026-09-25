// Static homepage presentation only. Reuse the saved-report renderer's charts;
// do not introduce a second financial calculator or a browser-side dependency.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let renderer;
export function homepageReportSankeys(source) {
  if (!renderer) {
    const context = {window:{}, console, Intl, Date, Number, String, Array, Object, Math, JSON, WeakSet, Blob, URL, setTimeout, clearTimeout};
    for (const file of ['participant-evidence-safety.js','monderman-report.js']) {
      vm.runInNewContext(fs.readFileSync(new URL('../'+file, import.meta.url),'utf8'), context, {filename:file});
    }
    renderer = context.window.MondermanReport;
  }
  const html = renderer.buildReportHtml(renderer.fromSynthesis(source));
  const start = html.indexOf('<div class="mr-overview-sankeys"');
  if (start < 0) return '';
  let depth = 0;
  for (const match of html.slice(start).matchAll(/<\/?div\b[^>]*>/g)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start,start+match.index+match[0].length);
  }
  throw new Error('Unclosed report chart preview');
}

export function buildHomepageReportQuad({entry,artifactSha,median,featuredAction}) {
  const s=entry.source, counts=s.campaign_evidence.counts;
  const groups=s.campaign_evidence.depth.lenses[0].requiredGroups;
  assert.equal(s.campaign_evidence.depth.lenses.length,1);
  assert.equal(counts.distinctParticipantsAcrossLenses,s.submitted_run_count);
  assert.ok(Number.isSafeInteger(counts.declaredPopulation)&&counts.declaredPopulation>=counts.distinctParticipantsAcrossLenses);
  assert.equal(groups.reduce((sum,g)=>sum+g.participants,0),counts.distinctParticipantsAcrossLenses);
  for (const g of groups) {
    assert.ok(Number.isSafeInteger(g.participants)&&g.participants>0);
    assert.equal(g.privacy?.mayDisplayGroupStatistics,true);
    assert.ok(Number.isSafeInteger(g.privacy.minimumDisplayedGroupSize)&&g.privacy.minimumDisplayedGroupSize>0&&g.participants>=g.privacy.minimumDisplayedGroupSize);
  }
  // This concise editorial summary is tied to the reviewed sample's actual
  // role-specific statement, not generalized to every participant or customer.
  assert.ok(s.ai_report.report.interpretation.summary.includes('recorded answers from people doing the work said that, when they need something from another team, ownership is “Often unclear: I ask two or three people first”'));
  assert.ok(s.campaign_scope_label.startsWith('Supplier onboarding'));
  const charts=homepageReportSankeys(s);
  assert.equal((charts.match(/data-preview-kind=/g)||[]).length,2,'Complete approved preview requires money and time charts');
  const full='sample-report.html#depth';
  const link=label=>'<a href="'+full+'">'+label+' <span aria-hidden="true">&rarr;</span></a>';
  const tile=(id,title,body,label)=>'<section class="hrq-tile" data-quad-section="'+id+'" aria-labelledby="hrq-'+id+'"><h3 id="hrq-'+id+'">'+title+'</h3><div class="hrq-content">'+body+(label?link(label):'')+'</div></section>';
  return '<aside class="hero-report-proof has-sample-depth-tile" data-home-report-quad aria-label="Depth Synthesis sample report" data-sample-id="depth_synthesis" data-artifact-sha256="'+esc(artifactSha)+'">\n'+
    '<header class="hrq-header"><span class="hrq-wordmark">Monderman<span>.</span></span><div><strong>Depth Synthesis</strong><span>Structural Clarity · Supplier onboarding</span></div></header>\n'+
    '<div class="hrq-grid">'+
    tile('findings','Overall findings','<p class="hrq-score"><strong data-promo-score>'+esc(median)+'</strong><span>/ 100</span></p><p class="hrq-band">'+esc(s.condition_band)+'</p><p class="hrq-lead">People doing the work report unclear handoff responsibilities.</p><p>Views differ across the included responses.</p>','Read findings in full report')+
    tile('money','Time and money','<p class="hrq-case">Central planning case · '+esc(s.financial_scenario.inputs.horizonMonths)+' months</p>'+charts+'<p class="hrq-chart-note">Rounded. Before costs. Planning estimates.</p>','')+
    tile('change','Change options','<p class="hrq-lead">'+esc(featuredAction)+'</p><p>Compare limited, moderate and structural options.</p>','Review options in full report')+
    tile('evidence','Evidence','<p class="hrq-lead"><strong>'+esc(counts.distinctParticipantsAcrossLenses)+' of '+esc(counts.declaredPopulation)+' participants</strong></p><ul class="hrq-roles">'+groups.map(g=>'<li><strong>'+g.participants+'</strong> '+esc(g.label.toLowerCase())+'</li>').join('')+'</ul><p>One diagnostic. One shared workflow.</p>','Review evidence in full report')+
    '</div>\n<footer class="hrq-footer"><span>Sample report · Example data</span>'+link('Open full report')+'</footer>\n</aside>';
}
