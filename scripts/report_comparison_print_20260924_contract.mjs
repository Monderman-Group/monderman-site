// Offline coverage of the two defects discovered in final comparison PDFs.
// Actual page fit and glyph containment require the separate raster review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {sourceBeforeComparisonPrint20260924, restoreComparisonPrint20260924Html, COMPARISON_PRINT_SHA256, PRIOR_COMPARISON_PRINT_SHA256} from './report_comparison_print_20260924_inverse.mjs';
const source = fs.readFileSync(new URL('../monderman-report.js', import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const prior = sourceBeforeComparisonPrint20260924(source);
const load = code => {const c = {window:{}, Intl, Date}; vm.runInNewContext(code, c); return c.window.MondermanReport;};
const R = load(source), old = load(prior);
let checks = 0;
const eq = (actual, expected, label) => {assert.deepEqual(actual, expected, label); checks++;};
const ok = (actual, label) => {assert.ok(actual, label); checks++;};
eq(sha(source), COMPARISON_PRINT_SHA256, 'Reviewed current renderer');
eq(sha(prior), PRIOR_COMPARISON_PRINT_SHA256, 'Historical renderer pin is unchanged');
eq(R.rendererVersion, old.rendererVersion, 'Unreleased renderer identity remains unchanged');
for (const mutation of [source + '\nUNREVIEWED', source.replace('X(Math.max(mean,med))+12', 'X(Math.max(mean,med))+3'), source.replace('font-size:28pt!important;line-height:1.04!important;max-width:none', 'font-size:27pt!important;line-height:1.04!important;max-width:none')]) {
  assert.throws(() => sourceBeforeComparisonPrint20260924(mutation), /exact reviewed/); checks++;
}
const printStart = source.indexOf('@page{size:Letter;margin:60pt}');
ok(printStart > 0, 'Print block found');
ok(source.indexOf('.mr-cover-title{font-size:28pt!important;line-height:1.04!important;max-width:none}') > printStart, 'Width override is confined to print');
ok(source.includes('max-width:15ch}'), 'Screen title width remains unchanged');
const pairs = [[50.4,54],[54,50.4],[40,45],[70,75],[75,70],[70,70],[0,0],[100,100],[0,100],[100,0],[null,60],[60,null],[null,0],[0,null],[null,null]];
const segments = pairs.map(([mean_score,median_score],i) => ({participant_mode:'role_'+i, n:5, mean_score, median_score}));
const raw = {
  synthesis_product:'depth_synthesis', score_status:'published', aggregate_score:54, submitted_run_count:15, lens_count:1,
  source_groups:[{tool_type:'institutional_performance',tool_label:'Institutional Performance',submitted_runs:15,mean_score:50.4,median_score:54}],
  sample_reads:[{tool_type:'institutional_performance',tool_label:'Institutional Performance',n:15,
    score:{min:36,max:54,mean:50.4,median:54,iqr:[54,54],sd:7.5}, segments,
    interpretation_limit:'These statistics describe the submitted runs only.'}]
};
const encode = value => JSON.stringify(value);
for (const kind of ['depth_synthesis','response_comparison']) {
  const input = {...raw,report_kind:kind}, before = encode(input), model = R.fromSynthesis(input), modelBefore = encode(model);
  const html = R.buildReportHtml(model), beforeHtml = old.buildReportHtml(old.fromSynthesis(input));
  eq(encode(input), before, kind + ': source input is not mutated');
  eq(encode(model), modelBefore, kind + ': model is not mutated');
  eq(restoreComparisonPrint20260924Html(html), beforeHtml, kind + ': only the two approved presentation deltas change output');
  const groups = [...html.matchAll(/<g class="mr-depth-segment-plot">([\s\S]*?)<\/g>/g)].map(match => match[1]);
  eq(groups.length, pairs.length - 1, kind + ': no invented missing markers');
  let y = 146;
  groups.forEach((group,i) => {
    const [mean,median] = pairs[i], hasMean = mean !== null, hasMedian = median !== null;
    const below = !hasMean || !hasMedian || Math.max(mean,median) > 70;
    const label = group.match(/class="mr-depth-segment-label" x="([^"]+)" y="([^"]+)" text-anchor="([^"]+)"[^>]*>([^<]*)/);
    const markers = [...group.matchAll(/class="mr-depth-segment-(mean|median)" cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)];
    eq(markers.map(m=>m[1]), [...(hasMean?['mean']:[]),...(hasMedian?['median']:[])], kind + ': missing statistics are not substituted');
    markers.forEach(marker => {
      eq(Number(marker[2]), 52 + ((marker[1] === 'mean' ? mean : median) / 100) * 600, kind + ': saved marker x is unchanged');
      eq(Number(marker[3]), y + 14, kind + ': marker row follows available label space');
      if (!below) ok(Number(label[1]) > Number(marker[2]) + Number(marker[4]), kind + ': inline label clears both markers');
    });
    eq(Number(label[1]), below ? 652 : 52 + Math.max(mean,median) / 100 * 600 + 12, kind + ': rightmost-marker anchor');
    eq(Number(label[2]), y + (below ? 36 : 18), kind + ': right-edge or missing value retains below-row fallback');
    eq(label[3], below ? 'end' : 'start', kind + ': fallback alignment');
    eq(label[4], 'mean ' + (hasMean ? mean : 'Not available') + ' · median ' + (hasMedian ? median : 'Not available'), kind + ': values and missing labels remain exact');
    y += below ? 54 : 36;
  });
  ok(!html.includes('NaN') && !html.includes('Infinity'), kind + ': no invalid chart coordinates');
}
for (const value of [null,undefined,'',NaN,Infinity]) {
  const missing = structuredClone(raw); missing.sample_reads[0].score.min = value;
  const html = R.buildReportHtml(R.fromSynthesis(missing));
  ok(!html.includes('class="mr-depth-segment-plot"'), 'Unavailable aggregate suppresses the chart');
  eq(restoreComparisonPrint20260924Html(html), old.buildReportHtml(old.fromSynthesis(missing)), 'Unavailable aggregate retains exact prior output');
}
console.log(JSON.stringify({status:'PASS',checks,rendererSha256:sha(source),priorRendererSha256:sha(prior),providerCalls:0,networkCalls:0,notExecuted:['actual PDF pagination and glyph bounds; see final-PDF visual review']},null,2));
