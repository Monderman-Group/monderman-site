// Exact additive v2 dispatch. Historical report comparisons recover the
// complete deployed v1 renderer; unknown changes are not normalized away.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const THREE_BENEFIT_RENDERER_SHA256='171c36bc67d14e83b9db412f550152d58cc695cc6c4e9a5a9afc9d72bac348d2';
export const PRIOR_THREE_BENEFIT_RENDERER_SHA256='ca92f06864b1f836cb3b9c92aab67f1fceb1bd6a6815428b8dd921cfca710ec0';
const replacements=[
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
  for(const [current,prior]of replacements){assert.equal(source.split(current).length,2,'One exact v2 dispatch change');source=source.replace(current,()=>prior);}
  assert.equal(sha(source),PRIOR_THREE_BENEFIT_RENDERER_SHA256,'Full deployed v1 renderer restored byte for byte');
  return source;
}
