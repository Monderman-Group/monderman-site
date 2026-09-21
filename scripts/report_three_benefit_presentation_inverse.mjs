// Exact v2 dispatch and legacy-chart retirement. Historical comparisons recover
// the complete deployed v1 renderer; unknown changes are not normalized away.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const THREE_BENEFIT_RENDERER_SHA256='274df14316781793cc42dd9f8a2b89348591e16f61e73a9b7fe489ae68970420';
export const PRIOR_THREE_BENEFIT_RENDERER_SHA256='ca92f06864b1f836cb3b9c92aab67f1fceb1bd6a6815428b8dd921cfca710ec0';
export const LEGACY_PLANNING_NOTE_HTML='<p class="mr-legacy-planning-note">This saved report uses an earlier planning format. Its figures and assumptions remain below. Update the operational inputs to use the current burden-and-savings charts.</p>';
const LEGACY_BREAKDOWN_PRIOR='Every activity is listed in full. Large charts name the three largest activities by central value in each benefit type and group the rest as Other activities. The grouping stays the same across cases. Staff hours are separate from dollar-valued ribbons.';
const LEGACY_BREAKDOWN_CURRENT='Every activity is listed in full. Staff hours and dollar values are shown separately.';
const LEGACY_RETURN_CURRENT=String.raw`      '<p class="mr-legacy-planning-note">This saved report uses an earlier planning format. Its figures and assumptions remain below. Update the operational inputs to use the current burden-and-savings charts.</p>'+breakdown+'<figcaption>'+caption+'</figcaption></figure>';`;
const LEGACY_RETURN_PRIOR=String.raw`      '<div class="mr-sankey-figure-head"><h3>How each planning case adds up</h3><p>Follow the recorded activity benefits and individual costs over '+fmtWhole(input.horizonMonths)+' months. Ribbon widths represent dollar values on one shared scale, not hours. This is a planning-value comparison, not cash flow. The joined ribbons do not allocate a particular activity to a particular cost.</p></div>'+
      '<fieldset class="mr-planning-controls"><legend>Choose a planning case</legend>'+levels.map(level=>'<input class="mr-planning-choice mr-planning-choice-'+level+'" type="radio" name="mr-planning-case" id="mr-planning-choice-'+level+'" value="'+level+'"'+(level==='central'?' checked':'')+'/><label for="mr-planning-choice-'+level+'">'+labels[level]+'</label>').join('')+
      '<div class="mr-planning-panels">'+cases.map(panel).join('')+'</div></fieldset>'+breakdown+'<figcaption>'+caption+'</figcaption></figure>';`;
const replacements=[
  [LEGACY_RETURN_CURRENT,LEGACY_RETURN_PRIOR],
  [LEGACY_BREAKDOWN_CURRENT,LEGACY_BREAKDOWN_PRIOR],
  ["      ...(r.financial_benefit_assessment ? { financialBenefitAssessment: obj(r.financial_benefit_assessment) } : {}),\n",''],
  ["    if (obj(m.financialScenario).version === 'operational-planning-scenario-20260919.2' || (!obj(m.financialScenario).version && obj(m.financialBenefitAssessment).version === 'three-benefit-assessment-20260919.1')) return renderThreeBenefitBrief(m);\n",''],
  ["    if (obj(m.financialScenario).version === 'operational-planning-scenario-20260919.2') return renderThreeBenefitAssumptions(m, n);\n",''],
  ["    const financial=financialScenarioPresentation(m) || threeBenefitPresentation(m);", "    const financial=financialScenarioPresentation(m);"],
  ["      (threeBenefitPresentation(obj(model))?'<meta name=\"monderman-three-benefit-presentation-version\" content=\"three-benefit-presentation-20260919.1\" />':'') +\n",'']
];
export function sourceBeforeThreeBenefitPresentation(source){
  if(!source.includes('THREE BENEFIT PRESENTATION 20260919.1'))return source;
  assert.equal(sha(source),THREE_BENEFIT_RENDERER_SHA256,'Only the exact reviewed three-benefit renderer may be inverted');
  const blocks=source.match(/  \/\/ BEGIN THREE BENEFIT PRESENTATION 20260919\.1\n[\s\S]*?  \/\/ END THREE BENEFIT PRESENTATION 20260919\.1\n\n/g)||[];
  assert.equal(blocks.length,1,'One exact additive v2 block');
  source=source.replace(blocks[0],'');
  for(const [current,prior]of replacements){assert.equal(source.split(current).length,2,'One exact reviewed presentation change');source=source.replace(current,()=>prior);}
  assert.equal(sha(source),PRIOR_THREE_BENEFIT_RENDERER_SHA256,'Full deployed v1 renderer restored byte for byte');
  return source;
}

// Only the known obsolete v1 figure's heading/controls/graphic and its chart-
// layout sentence may differ. Tables, saved values, captions and other prose
// remain byte-identical. Used against the exact recovered historical renderer.
export function legacyPlanningHtmlAfterCorrection(html){
  const figures=html.match(/<figure class="mr-operational-sankey" data-sankey-version="planning-case-sankey-20260919\.3">[\s\S]*?<\/figure>/g)||[];
  assert.ok(figures.length<=1,'At most one legacy planning figure per report');
  if(!figures.length)return html;
  const prior=figures[0],open='<figure class="mr-operational-sankey" data-sankey-version="planning-case-sankey-20260919.3">';
  const heading=prior.match(/^<figure[^>]+>(<div class="mr-sankey-figure-head"><h3>How each planning case adds up<\/h3><p>Follow the recorded activity benefits and individual costs over [0-9,]+ months\. Ribbon widths represent dollar values on one shared scale, not hours\. This is a planning-value comparison, not cash flow\. The joined ribbons do not allocate a particular activity to a particular cost\.<\/p><\/div>)/)?.[1];
  assert.ok(heading,'Exact obsolete legacy heading');
  const body=prior.slice(open.length+heading.length),end=body.indexOf('</fieldset>');
  assert.ok(body.startsWith('<fieldset class="mr-planning-controls"><legend>Choose a planning case</legend>')&&end>=0,'Exact legacy controls boundary');
  const rest=body.slice(end+'</fieldset>'.length);
  assert.ok(rest.startsWith('<details class="mr-planning-breakdown">'),'Only the chart is removed, not the breakdown');
  assert.equal(rest.split(LEGACY_BREAKDOWN_PRIOR).length,3,'Both screen and print breakdown descriptions');
  const revised=open+LEGACY_PLANNING_NOTE_HTML+rest.split(LEGACY_BREAKDOWN_PRIOR).join(LEGACY_BREAKDOWN_CURRENT);
  return html.replace(prior,()=>revised);
}
