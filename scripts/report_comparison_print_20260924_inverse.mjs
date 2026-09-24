// Finite presentation-only fixes found by actual final-PDF inspection.
// Restore the frozen preceding renderer without changing historical pins.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
export const COMPARISON_PRINT_SHA256 = '00a8b906e10ee3b048a5554fa0d6142ffd2fd85346daf2d56f8c0fdaf47596e1';
export const PRIOR_COMPARISON_PRINT_SHA256 = '420b126a6d6d47be3fb32e78483c649f13f670ced90597fc3058aa7a93040b6a';
const coverNow = '.mr-cover-title{font-size:28pt!important;line-height:1.04!important;max-width:none}';
const coverPrior = '.mr-cover-title{font-size:28pt!important;line-height:1.04!important}';
const replacements = [
  ['const labelBelow = !hasMean || !hasMedian || Math.max(Number(s.mean_score), Number(s.median_score)) > 70;', 'const labelBelow = !hasMean || !hasMedian || Number(s.mean_score) > 70;'],
  ['(labelBelow ? W-R : X(Math.max(mean,med))+12)', '(labelBelow ? W-R : X(mean)+12)'],
  [coverNow, coverPrior]
];
export function sourceBeforeComparisonPrint20260924(source) {
  if (!source.includes(coverNow) && !source.includes('X(Math.max(mean,med))+12')) return source;
  assert.equal(sha(source), COMPARISON_PRINT_SHA256, 'Only the exact reviewed cover/segment-label presentation can be inverted');
  for (const [now, prior] of replacements) {
    assert.equal(source.split(now).length, 2, 'One exact comparison print presentation hunk');
    source = source.replace(now, () => prior);
  }
  assert.equal(sha(source), PRIOR_COMPARISON_PRINT_SHA256, 'Exact pre-PDF-review renderer restored');
  return source;
}

// Undo geometry only for the renderer-owned distribution SVG. Labels, source
// statistics, marker x positions and every non-chart byte remain untouched.
export function restoreComparisonPrint20260924Html(html) {
  html = html.replace(coverNow, coverPrior);
  return html.replace(/<svg class="mr-synth-chart"[^>]*>[\s\S]*?<\/svg>/g, svg => {
    if (!svg.includes('class="mr-depth-segment-plot"')) return svg;
    let priorY = 146, currentHeight = 148, priorHeight = 148;
    const restored = svg.replace(/<g class="mr-depth-segment-plot">[\s\S]*?<\/g>/g, group => {
      const mean = group.match(/class="mr-depth-segment-mean" cx="([^"]+)"/);
      const median = group.match(/class="mr-depth-segment-median" cx="([^"]+)"/);
      const label = group.match(/<text class="mr-depth-segment-label" x="([^"]+)" y="([^"]+)" text-anchor="(start|end)"/);
      assert.ok(label, 'Exact segment label markup');
      const currentBelow = label[3] === 'end';
      const priorBelow = !mean || !median || Number(mean[1]) > 472;
      const currentY = Number(label[2]) - (currentBelow ? 36 : 18);
      const shift = priorY - currentY;
      group = group.replace(/\b(y|y1|y2|cy)="([^"]+)"/g, (_all, attr, value) => attr + '="' + (Number(value) + shift) + '"');
      group = group.replace(/(<text class="mr-depth-segment-label") x="[^"]+" y="[^"]+" text-anchor="[^"]+"/, '$1 x="' + (priorBelow ? 652 : Number(mean[1]) + 12) + '" y="' + (priorY + (priorBelow ? 36 : 18)) + '" text-anchor="' + (priorBelow ? 'end' : 'start') + '"');
      currentHeight += currentBelow ? 54 : 36;
      priorHeight += priorBelow ? 54 : 36;
      priorY += priorBelow ? 54 : 36;
      return group;
    });
    assert.ok(restored.includes('viewBox="0 0 680 ' + currentHeight + '"'), 'Exact distribution SVG height');
    return restored.replace('viewBox="0 0 680 ' + currentHeight + '"', 'viewBox="0 0 680 ' + priorHeight + '"')
      .replace(/(<line x1="[^"]+" y1="46" x2="[^"]+" y2=")[^"]+(" stroke="rgba\(24,25,28,\.07\)"\/?>)/g, (_all, prefix, suffix) => prefix + (priorHeight - 18) + suffix);
  });
}
