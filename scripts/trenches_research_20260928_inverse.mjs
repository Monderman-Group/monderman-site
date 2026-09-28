// Exact fourth-part compatibility. Existing publication/report pins stay fixed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
export const TRENCHES_RESEARCH_BASELINE = '8fb6699835b04e37c3305da08681daa3095c4f24';
const beforeSha256 = 'a7e71ad1a48d215ce31a635cea44a56d8c1386fb70dc9244a6adae8a90fa1f59';
const afterSha256 = 'a3fe6f9f179920affe5c688f66e888f4eebc3edfd07b31595a58b07557efd9b1';
export const trenchesResearchReplacements = Object.freeze([
  [
    37727,
    37884,
    "    body.research-page .series[aria-labelledby=\"governance-performance-title\"] .series-grid {\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n    }\n\n",
    ""
  ],
  [
    44413,
    44554,
    "      body.research-page .series[aria-labelledby=\"governance-performance-title\"] .series-grid {\n        grid-template-columns: 1fr;\n      }\n\n",
    ""
  ],
  [
    54104,
    54175,
    "        <p class=\"library-stamp\">20 items · Updated September 2026</p>\n",
    "        <p class=\"library-stamp\">19 items · Updated September 2026</p>\n"
  ],
  [
    57125,
    57344,
    "        <p class=\"series-deck\">Four papers on how organizations change over time: what their reports leave out, how they drift, why they stay fast at cutting but slow at building, and what dividing a company costs.</p>\n",
    "        <p class=\"series-deck\">Three papers on how organizations change over time: what their reports leave out, how they drift, and why they stay fast at cutting but slow at building.</p>\n"
  ],
  [
    60564,
    61523,
    "            </div>\n          </div>\n        </article>\n        <article class=\"series-card\">\n          <div class=\"series-card-top\">\n            <span class=\"series-chip\">Part 4</span>\n            <span class=\"series-format\">Insight · HTML + PDF</span>\n          </div>\n          <h3 class=\"series-card-title\">Trenches, Not Silos</h3>\n          <p class=\"series-card-desc\">What divisions make easier to manage, what they cost the company, and why those costs need to be counted.</p>\n          <div class=\"series-card-foot\">\n            <div class=\"series-stats\"><span>September 2026</span><span>10 pages · ~20 min</span></div>\n            <div class=\"series-actions\">\n              <a class=\"series-action publication-primary-link\" href=\"trenches-not-silos.html\">Read article →</a>\n              <a class=\"series-action publication-secondary-link\" href=\"Monderman_Insight_Trenches_Not_Silos_2026-09-28.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">PDF →</a>\n",
    ""
  ]
]);

export function sourceBeforeTrenchesResearch20260928(file, source) {
  if (file !== 'research.html') return source;
  assert.equal(sha(source), afterSha256, 'Only the exact fourth-part research source can be inverted');
  let restored = String(source);
  for (const [start, end, current, prior] of [...trenchesResearchReplacements].reverse()) {
    assert.equal(restored.slice(start, end), current, 'Exact fourth-part research hunk');
    restored = restored.slice(0, start) + prior + restored.slice(end);
  }
  assert.equal(sha(restored), beforeSha256, 'The complete preceding research source is recovered');
  return Buffer.isBuffer(source) ? Buffer.from(restored) : restored;
}

// Other identities reach the unchanged historical assertions without rewriting.
export function sourceAtTrenchesResearchBaseline(file, source) {
  return file === 'research.html' && sha(source) === afterSha256
    ? sourceBeforeTrenchesResearch20260928(file, source)
    : source;
}
