// Exact one-card compatibility. Historical homepage and report pins stay fixed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
export const TRENCHES_HOMEPAGE_BASELINE = 'f581afe6a1c7f970a8f9cd641210bd6f65fe295e';
export const TRENCHES_HOMEPAGE_BEFORE_SHA256 = '5a37088d97f5da133bb9116f830d66f890c12841e8aa0ca7c8be7729dbba98e2';
export const TRENCHES_HOMEPAGE_AFTER_SHA256 = 'e23e158ed804f280b41a8d78ec84f8cf6c6e32f05aed5036e0454e85e2f55a97';
export const TRENCHES_HOMEPAGE_CARD_START = 111498;
export const TRENCHES_HOMEPAGE_CARD = `<article class="latest-card category-insight" data-category="insight" data-publication="trenches-not-silos">
<div class="latest-card-image latest-card-image--placeholder">
<div class="placeholder-cover">
<div class="placeholder-cover-stack">
<h3 class="placeholder-cover-title">Trenches, Not Silos</h3>
<p class="placeholder-cover-subline">The Bill for Dividing a Company</p>
</div>
<span class="placeholder-cover-chip">Series, Part 4</span>
<span class="placeholder-cover-type">Insight</span>
</div>
</div>
<div class="latest-card-body">
<p class="latest-card-kicker">Governance and Performance · Part 4</p>
<h3 class="latest-card-title latest-card-title--print">Trenches, Not Silos</h3>
<p class="latest-card-text">What divisions make easier to manage, what they cost the company, and why those costs need to be counted.</p>
<div class="latest-card-actions"><a class="latest-card-link" href="trenches-not-silos.html" aria-label="Read article: Trenches, Not Silos">Read article →</a><a class="latest-card-secondary-link" href="Monderman_Insight_Trenches_Not_Silos_2026-09-28.pdf" target="_blank" rel="noopener noreferrer" aria-label="Download PDF: Trenches, Not Silos">Download PDF ↗</a></div>
</div>
</article>
`;

export function sourceBeforeTrenchesHomepageCarousel20260929(file, source) {
  if (file !== 'index.html') return source;
  assert.equal(sha(source), TRENCHES_HOMEPAGE_AFTER_SHA256, 'Only the exact homepage carousel addition can be inverted');
  const current = String(source), start = TRENCHES_HOMEPAGE_CARD_START;
  const end = start + TRENCHES_HOMEPAGE_CARD.length;
  assert.equal(current.slice(start, end), TRENCHES_HOMEPAGE_CARD, 'Exact inserted carousel card');
  const restored = current.slice(0, start) + current.slice(end);
  assert.equal(sha(restored), TRENCHES_HOMEPAGE_BEFORE_SHA256, 'The complete preceding homepage is recovered');
  return Buffer.isBuffer(source) ? Buffer.from(restored) : restored;
}

// Unrecognized bytes continue unchanged to the existing historical assertions.
export function sourceAtTrenchesHomepageCarouselBaseline(file, source) {
  return file === 'index.html' && sha(source) === TRENCHES_HOMEPAGE_AFTER_SHA256
    ? sourceBeforeTrenchesHomepageCarousel20260929(file, source)
    : source;
}
