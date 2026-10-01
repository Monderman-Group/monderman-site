// Exact Part 5 publication compatibility; historical approvals retain their pins.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceAtResearchPrintPaginationBaseline} from './research_print_pagination_20261001_inverse.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
export const HOLD_COLLIDE_PUBLICATION_BASELINE = 'b9f95c67b3f526a229439058d16916c114a21e27';
export const HOLD_COLLIDE_PUBLICATION_FILES = Object.freeze(['index.html', 'research.html']);
export const holdCollidePublicationDelta = Object.freeze({
  "index.html": {
    "before_sha256": "e23e158ed804f280b41a8d78ec84f8cf6c6e32f05aed5036e0454e85e2f55a97",
    "after_sha256": "4e51edbec970f26cad6bd6776e32704cae19c53a119ed3d39ee1150c399191a7",
    "replacements": [
      [
        111498,
        112775,
        "<article class=\"latest-card category-insight\" data-category=\"insight\" data-publication=\"hold-collide-come-apart\">\n<div class=\"latest-card-image latest-card-image--placeholder\">\n<div class=\"placeholder-cover\">\n<div class=\"placeholder-cover-stack\">\n<h3 class=\"placeholder-cover-title\">Hold, Collide, Come Apart</h3>\n<p class=\"placeholder-cover-subline\">The three forms the trenches take.</p>\n</div>\n<span class=\"placeholder-cover-chip\">Series, Part 5</span>\n<span class=\"placeholder-cover-type\">Insight</span>\n</div>\n</div>\n<div class=\"latest-card-body\">\n<p class=\"latest-card-kicker\">Governance and Performance · Part 5</p>\n<h3 class=\"latest-card-title latest-card-title--print\">Hold, Collide, Come Apart</h3>\n<p class=\"latest-card-text\">How divisions hold in parallel, collide over shared ground, or grow apart, and why each pattern calls for a different response.</p>\n<div class=\"latest-card-actions\"><a class=\"latest-card-link\" href=\"hold-collide-come-apart.html\" aria-label=\"Read article: Hold, Collide, Come Apart\">Read article →</a><a class=\"latest-card-secondary-link\" href=\"Monderman_Insight_Hold_Collide_Come_Apart_2026-10-01.pdf\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Download PDF: Hold, Collide, Come Apart\">Download PDF ↗</a></div>\n</div>\n</article>\n",
        ""
      ]
    ]
  },
  "research.html": {
    "before_sha256": "a3fe6f9f179920affe5c688f66e888f4eebc3edfd07b31595a58b07557efd9b1",
    "after_sha256": "fdc7d382ab9b2a365ed64c9af128ea077cfe88d31a800f08e602b6612f976c12",
    "replacements": [
      [
        54104,
        54173,
        "        <p class=\"library-stamp\">21 items · Updated October 2026</p>\n",
        "        <p class=\"library-stamp\">20 items · Updated September 2026</p>\n"
      ],
      [
        57123,
        57392,
        "        <p class=\"series-deck\">Five papers on how organizations change over time: what their reports leave out, how they drift, why they stay fast at cutting but slow at building, what dividing a company costs, and how those divisions hold, collide, or grow apart.</p>\n",
        "        <p class=\"series-deck\">Four papers on how organizations change over time: what their reports leave out, how they drift, why they stay fast at cutting but slow at building, and what dividing a company costs.</p>\n"
      ],
      [
        61571,
        62566,
        "            </div>\n          </div>\n        </article>\n        <article class=\"series-card\">\n          <div class=\"series-card-top\">\n            <span class=\"series-chip\">Part 5</span>\n            <span class=\"series-format\">Insight · HTML + PDF</span>\n          </div>\n          <h3 class=\"series-card-title\">Hold, Collide, Come Apart</h3>\n          <p class=\"series-card-desc\">How divisions hold in parallel, collide over shared ground, or grow apart, and why each pattern calls for a different response.</p>\n          <div class=\"series-card-foot\">\n            <div class=\"series-stats\"><span>October 2026</span><span>16 pages · ~25 min</span></div>\n            <div class=\"series-actions\">\n              <a class=\"series-action publication-primary-link\" href=\"hold-collide-come-apart.html\">Read article →</a>\n              <a class=\"series-action publication-secondary-link\" href=\"Monderman_Insight_Hold_Collide_Come_Apart_2026-10-01.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">PDF →</a>\n",
        ""
      ]
    ]
  }
});

export function sourceBeforeHoldCollidePublication20261001(file, source) {
  if (!HOLD_COLLIDE_PUBLICATION_FILES.includes(file)) return source;
  const entry = holdCollidePublicationDelta[file];
  assert.equal(sha(source), entry.after_sha256, file + ': only the exact fifth-part publication source can be inverted');
  let restored = String(source);
  for (const [start, end, current, prior] of [...entry.replacements].reverse()) {
    assert.equal(restored.slice(start, end), current, file + ': exact finite fifth-part publication hunk');
    restored = restored.slice(0, start) + prior + restored.slice(end);
  }
  assert.equal(sha(restored), entry.before_sha256, file + ': recover every preceding publication byte');
  return Buffer.isBuffer(source) ? Buffer.from(restored) : restored;
}

// Unknown bytes reach the original historical assertions without rewriting.
export function sourceAtHoldCollidePublicationBaseline(file, source) {
  source = sourceAtResearchPrintPaginationBaseline(file, source);
  const entry = Object.hasOwn(holdCollidePublicationDelta, file) ? holdCollidePublicationDelta[file] : null;
  return entry && sha(source) === entry.after_sha256
    ? sourceBeforeHoldCollidePublication20261001(file, source)
    : source;
}
