// Exact print-only pagination compatibility; all publication pins stay fixed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
export const RESEARCH_PRINT_BASELINE = 'c1ab30b932d51f44652fe215aa1c1b5ad304d6f5';
const beforeSha256 = 'fdc7d382ab9b2a365ed64c9af128ea077cfe88d31a800f08e602b6612f976c12';
const afterSha256 = '95f85e79a8af9cc0e8dceb0dcf044befd30a414b018d7bfc82f56f8d83b66bf1';
const start = 33571;
export const RESEARCH_PRINT_STYLE = `<style id="research-print-flow-20261001" media="print">
  body.research-page .onsite {
    break-inside: avoid;
  }
  body.research-page .divider-quote:has(+ .onsite) {
    break-after: avoid;
  }
</style>
`;

export function sourceBeforeResearchPrintPagination20261001(file, source) {
  if (file !== 'research.html') return source;
  assert.equal(sha(source), afterSha256, 'Only the exact Research print pagination change can be inverted');
  const current = String(source), end = start + RESEARCH_PRINT_STYLE.length;
  assert.equal(current.slice(start, end), RESEARCH_PRINT_STYLE, 'Exact print-only style insertion');
  const restored = current.slice(0, start) + current.slice(end);
  assert.equal(sha(restored), beforeSha256, 'Recover the complete preceding Research source');
  return Buffer.isBuffer(source) ? Buffer.from(restored) : restored;
}

export function sourceAtResearchPrintPaginationBaseline(file, source) {
  return file === 'research.html' && sha(source) === afterSha256
    ? sourceBeforeResearchPrintPagination20261001(file, source)
    : source;
}
