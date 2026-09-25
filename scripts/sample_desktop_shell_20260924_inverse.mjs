// Exact test-only compatibility for the reviewed sample desktop shell fix.
// This does not approve reports, rewrite source files or alter historical pins.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const sampleDesktopShellPatch = `  /* The shared Synthesis overview needs the full report width. Keep the
     complete contents list below it and its native menu available above. */
  @media(min-width:1081px){
    :is(#report-synthesis,#report-depth) .psr-doc-shell { grid-template-columns:minmax(0,1fr); }
    :is(#report-synthesis,#report-depth) .psr-toc { position:static; }
    :is(#report-synthesis,#report-depth) .mr-screen-contents { display:block; }
  }
`;
assert.equal(Buffer.byteLength(sampleDesktopShellPatch),430,'Exact desktop shell addition is 430 bytes');
assert.equal(sampleDesktopShellPatch.split('\n').length-1,7,'Exact desktop shell addition is seven lines');
export function sourceBeforeSampleDesktopShell(file,source) {
  if(file!=='sample-report-production.css')return source;
  assert.equal(sha(source),'c2c8433771fe9ad5c34478df0a71d93ed0406bd24f83d515ae9f832c995615ab','Only the exact reviewed sample desktop CSS can be inverted');
  const text=String(source);
  assert.equal(Buffer.byteLength(text),9485,'Complete current sample CSS length');
  assert.equal(text.split(sampleDesktopShellPatch).length,2,'One exact desktop-only sample shell addition');
  const restored=text.replace(sampleDesktopShellPatch,'');
  assert.equal(Buffer.byteLength(restored),9055,'Complete historical sample CSS length');
  assert.equal(sha(restored),'089c16804b04865fc06c0bbc83c65933f7a14ea08653399c0bcecf3eae641f4d','Complete original sample CSS recovered');
  return restored;
}
