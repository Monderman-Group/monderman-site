// Exact historical compatibility only. Current copy and behavior preservation
// are checked independently by public_copy_clarity_smoke.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceBeforePromotionalGold20260924} from './promotional_gold_20260924_inverse.mjs';
import {sourceBeforeReportLibrary20260924} from './report_library_20260924_inverse.mjs';
import {sourceBeforePublicLanguagePass20260924} from './public_language_pass_20260924_inverse.mjs';
import {sourceBeforeTrustSecurityCenter20260924} from './trust_security_center_20260924_inverse.mjs';
import {sourceBeforeHomepageCompactJourney20260924} from './homepage_compact_journey_20260924_inverse.mjs';
import {sourceBeforePublicSampleProjectionCache20260924} from './public_sample_projection_20260924_inverse.mjs';
import {sourceBeforePublicSamplePreviewBinding20260924} from './public_sample_preview_binding_20260924_inverse.mjs';
import {sourceBeforeHomepagePreviewAnchor20260924} from './homepage_preview_anchor_20260924_inverse.mjs';
import {sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';

export const PUBLIC_COPY_BASELINE='dd80e27f4ee63f9ac0b2385010ab2d4f92a61cb2';
export const PUBLIC_COPY_FIXTURE_SHA256='4d874cc80e9180341deadc0a976e660a87c8fcf34606fc67003605bffe5bfbdb';
const sha=value=>createHash('sha256').update(value).digest('hex');
const bytes=fs.readFileSync(new URL('./fixtures/public-copy-clarity-20260924.json',import.meta.url));
assert.equal(sha(bytes),PUBLIC_COPY_FIXTURE_SHA256,'Reviewed public-copy fixture must match its independent digest');
export const publicCopyDelta=JSON.parse(bytes);
assert.equal(publicCopyDelta.baseline,PUBLIC_COPY_BASELINE);
export const PUBLIC_COPY_FILES=Object.freeze(Object.keys(publicCopyDelta.files));

export function sourceBeforePublicCopyClarity(file,source){
  source=sourceBeforeHomepageReportQuad20260925(file,source);
  source=sourceBeforeHomepagePreviewAnchor20260924(file,source);
  source=sourceBeforePublicSamplePreviewBinding20260924(file,source);
  source=sourceBeforePublicSampleProjectionCache20260924(file,source);
  source=sourceBeforeHomepageCompactJourney20260924(file,source);
  source=sourceBeforeTrustSecurityCenter20260924(file,source);
  source=sourceBeforePublicLanguagePass20260924(file,source);
  // Ordered, non-idempotent presentation layers restore the exact post-copy
  // edition. The original copy fixture, digest and inverse below stay intact.
  source=sourceBeforePromotionalGold20260924(file,source);
  source=sourceBeforeReportLibrary20260924(file,source);
  const entry=publicCopyDelta.files[file];
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed current source can be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite copy delta');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': entire pre-copy source restored byte for byte');
  return restored;
}
