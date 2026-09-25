// Exact approved Synthesis quad, gold, comparison-label and instant-navigation delta.
// Historical checks retain every earlier pin after this finite inversion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceBeforeExecutiveOverview} from './executive_overview_renderer_inverse.mjs';
import {restoreComparisonPrint20260924Html} from './report_comparison_print_20260924_inverse.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
export const HORIZONTAL_OVERVIEW_VERSION = 'diagnostic-renderer-report-overview-20260924.1';
export const HORIZONTAL_OVERVIEW_SHA256 = '9c3563c5ff811133da185cbedb0c53bcdea4307b60b1e395d6cd207e11e44180';
export const PRIOR_HORIZONTAL_OVERVIEW_SHA256 = '977cf5497c16b1e4427e5efa5113ff06e718e1331f18cde8c0069c0d10ba5791';
const bytes = fs.readFileSync(new URL('./fixtures/report-overview-horizontal-reviewed-delta.json', import.meta.url));
assert.equal(sha(bytes), 'c7031809477471259325e57b73183e9c03a3990c8ddf63f80c9de73c541fa20d', 'Exact horizontal overview delta fixture');
const delta = JSON.parse(bytes);
export function sourceBeforeHorizontalOverviewPresentation(source) {
  source = sourceBeforeExecutiveOverview(source);
  if (!source.includes(HORIZONTAL_OVERVIEW_VERSION)) return source;
  assert.equal(sha(source), HORIZONTAL_OVERVIEW_SHA256, 'Only the exact approved horizontal renderer can be inverted');
  assert.equal(delta.renderer_sha256, HORIZONTAL_OVERVIEW_SHA256);
  assert.equal(delta.prior_renderer_sha256, PRIOR_HORIZONTAL_OVERVIEW_SHA256);
  for (const [current, prior] of delta.replacements) {
    assert.equal(source.split(current).length, 2, 'One exact horizontal presentation hunk');
    source = source.replace(current, () => prior);
  }
  assert.equal(sha(source), PRIOR_HORIZONTAL_OVERVIEW_SHA256, 'Restore the complete preceding overview renderer byte for byte');
  return source;
}

// HTML compatibility removes only the finite approved detail colors and
// comparison labels. The overview itself is removed by its existing normalizer.
// Numbers, chart geometry, financial wording and all report text remain exact.
export function restoreHorizontalOverviewDetailPresentation(html) {
  html = restoreComparisonPrint20260924Html(html);
  html = html.replace(/(<section\b[^>]*class="mr-cover") data-overview-first="true">/g, '$1>');
  html = html.replace(`      /* A Letter cover must not inherit the phone metadata grid. Keep the
         full boundary on its cover without shrinking the report prose. */
      .mr-report .mr-cover-dark{padding:20px 30px 18px}
      .mr-report .mr-cover-mark{margin-bottom:12px!important}
      .mr-report .mr-cover-rule{margin-bottom:16px}
      .mr-report .mr-cover-sub{margin-top:12px!important}
      .mr-report .mr-cover-white{padding:18px 30px 20px}
      .mr-report .mr-cover-pills{margin-top:12px}
      .mr-report .mr-cover-meta{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:12px;padding-top:10px;gap:6px 12px}
      .mr-report .mr-cover-meta>span:last-child:nth-child(5){grid-column:2 / -1}
      .mr-report .mr-cover-body{margin-top:12px!important;padding-top:10px}
      .mr-report .mr-cover-boundary{margin-top:12px}
      .mr-report .mr-benefit-chart .mr-benefit-chart-note{font-size:9pt;line-height:1.4;margin:8px 0;break-inside:avoid;page-break-inside:avoid}
      .mr-report .mr-benefit-chart>figcaption{break-before:avoid;page-break-before:avoid}
`, '');
  html = html.replace(/<div id="mr-[^"]+-section-0-overview" class="mr-screen-only mr-report-overview" aria-label="Report overview">/g, '<div class="mr-screen-only mr-report-overview" aria-label="Report overview">');
  html = html.replace(/(<a data-report-link-role="overview" href="#mr-[^"]+-section-0)-overview("[^>]*>)/g, '$1$2');
  const goldRules = [
    '.mr-benefit-coverage{padding:16px;border-left:4px solid #E6C765',
    '.mr-benefit-flow-node.is-right{right:0;border-color:#E6C765}',
    '.mr-decision-metric:nth-child(2){border-top-color:#E6C765}',
    '.mr-action-step[data-tier="behavioral"]{border-top-color:#E6C765}',
    '.mr-action[data-tier="behavioral"] { border-left-color:#E6C765; }',
    '.mr-indicator-tile[data-lens="sc"] { border-left:3px solid #E6C765; }',
    '.mr-run-metric[data-tone="amber"]{border-top-color:#E6C765}',
    '.mr-report .mr-run-metric[data-tone="amber"],.mr-report .mr-decision-metric:nth-child(2),.mr-report .mr-action-step[data-tier="behavioral"]{border-top-color:#E6C765}',
    '.mr-report .mr-action[data-tier="behavioral"],.mr-report .mr-indicator-tile[data-lens="sc"]{border-left-color:#E6C765}'
  ];
  for (const current of goldRules) html = html.split(current).join(current.replace('#E6C765', '#C9A227'));
  html = html.replace('.mr-benefit-radio:focus-visible+label{outline:3px solid #0C6E78', '.mr-benefit-radio:focus-visible+label{outline:3px solid #C9A227');
  html = html.replace(/<circle\b[^>]*\br="5" fill="#E6C765" stroke="#7A6015"[^>]*>/g, tag => tag.replace('fill="#E6C765"', 'fill="#C9A227"'));
  html = html.replace(/<(?:path|rect)\b[^>]*>/g, tag => /\b(?:data-burden-role|data-node-id)="spendingReduction"/.test(tag) ? tag.replace('fill="#E6C765"', 'fill="#C9A227"') : tag);
  html = html.replace(/<h1 class="mr-cover-title">(?:Operational Systems|Decision Velocity|Structural Clarity|Institutional Performance) response comparison<\/h1>/g, '<h1 class="mr-cover-title">Campaign response comparison</h1>');
  html = html.replace(/<section\b[^>]*class="mr-section mr-executive-synthesis"[^>]*>[\s\S]*?<\/section>/g, section => section
    .replace(/(<h2>[0-9]+\. )Response comparison(<\/h2>)/, '$1Executive synthesis$2')
    .replace('<p>This is a same-Diagnostic response comparison.', '<p>This is a same-Diagnostic Depth Synthesis.')
    .replace('<p>Use this response comparison to review ', '<p>Use this Depth Synthesis to review '));
  html = html.replace(/<section\b[^>]*class="mr-section mr-evidence-status"[^>]*>[\s\S]*?<\/section>/g, section => section.replace('Not applicable to a one-Diagnostic response comparison.', 'Not applicable to one-Diagnostic Depth Synthesis.'));
  html = html.replace(/(<div class="mr-section-index">0[0-9]+ · )Comparison read(<\/div>)/g, '$1Depth read$2');
  html = html.replace(/aria-label="(?:Operational Systems|Decision Velocity|Structural Clarity|Institutional Performance|Diagnostic) response comparison score distribution"/g, 'aria-label="Depth Synthesis score distribution"');
  html = html.replace(/\b(id|href|for|name|aria-labelledby)="(#?)mr-(?:self-run-)?response-comparison-((?:operational-systems|decision-velocity|structural-clarity|institutional-performance)-n[0-9]+)([^"]*)"/g, '$1="$2mr-depth-synthesis-$3$4"');
  return html.replace(/\b(id|href|for|name|aria-labelledby)="(#?)mr-(?:self-run-)?response-comparison-cross-lens-n([0-9]+)([^"]*)"/g, '$1="$2mr-cross-lens-synthesis-n$3$4"');
}
