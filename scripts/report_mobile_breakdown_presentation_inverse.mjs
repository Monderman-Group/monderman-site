// Exact screen-only, keyboard-scrollable breakdown delta. Printed content is unchanged.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceBeforeThreeBenefitPresentation} from './report_three_benefit_presentation_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const MOBILE_BREAKDOWN_RENDERER_SHA256="ca92f06864b1f836cb3b9c92aab67f1fceb1bd6a6815428b8dd921cfca710ec0";
export const PRIOR_MOBILE_BREAKDOWN_RENDERER_SHA256="24bf58391c447b68b9b909402ba6c2e3c133f16b4aa4e2df488c1ef8d63f8bf7";
const CURRENT="    // Keep the print copy unchanged. Screen tables scroll as named, keyboard-\n    // focusable regions rather than splitting a saved amount across lines.\n    let screenTableIndex=0;\n    const screenBreakdownBody=breakdownBody.replace(/<table class=\"mr-sankey-table\">/g,()=>{\n      const first=screenTableIndex++===0;\n      return (first?'<p class=\"mr-planning-scroll-hint\">Swipe or scroll across to compare all three cases.</p>':'')+'<div class=\"mr-planning-table-scroll\" role=\"region\" tabindex=\"0\" aria-label=\"'+(first?'Activity benefits by planning case':'Cost components by planning case')+'\"><table class=\"mr-sankey-table\">';\n    }).replace(/<\\/table>/g,'</table></div>');\n    const breakdown='<details class=\"mr-planning-breakdown\"><summary>View every activity and cost</summary>'+screenBreakdownBody+'</details><div class=\"mr-planning-breakdown mr-planning-print-breakdown\">'+breakdownBody+'</div>';\n";
const PRIOR="    const breakdown='<details class=\"mr-planning-breakdown\"><summary>View every activity and cost</summary>'+breakdownBody+'</details><div class=\"mr-planning-breakdown mr-planning-print-breakdown\">'+breakdownBody+'</div>';\n";
const STYLES="    /* BEGIN SCREEN BREAKDOWN TABLE STYLES 20260919.4 */\n    @media screen{.mr-planning-table-scroll{min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;margin-top:20px}.mr-planning-table-scroll:focus-visible{outline:2px solid #0C6E78;outline-offset:2px}.mr-planning-table-scroll .mr-sankey-table{min-width:560px;table-layout:auto;margin-top:0}.mr-planning-table-scroll .mr-sankey-table td{white-space:nowrap;overflow-wrap:normal;word-break:normal}.mr-planning-scroll-hint{display:none}}\n    @media screen and (max-width:640px){.mr-report .mr-planning-scroll-hint{display:block;font-size:.74rem;line-height:1.45;color:#53676E;margin:12px 0 0}}\n    /* END SCREEN BREAKDOWN TABLE STYLES 20260919.4 */\n";
export function sourceBeforeMobileBreakdownPresentation(source){
  source=sourceBeforeThreeBenefitPresentation(source);
  if(!source.includes('SCREEN BREAKDOWN TABLE STYLES 20260919.4'))return source;
  assert.equal(sha(source),MOBILE_BREAKDOWN_RENDERER_SHA256,'Only the exact reviewed screen-table renderer can be inverted');
  assert.equal(source.split(CURRENT).length,2,'One exact screen-only breakdown wrapper');
  assert.equal(source.split(STYLES).length,2,'One exact screen-only table style block');
  source=source.replace(CURRENT,()=>PRIOR).replace(STYLES,'');
  assert.equal(sha(source),PRIOR_MOBILE_BREAKDOWN_RENDERER_SHA256,'Screen-table inverse restores complete prior renderer');
  return source;
}
export function restoreMobileBreakdownPresentationStyles(html){
  if(!html.includes('    /* BEGIN SCREEN BREAKDOWN TABLE STYLES 20260919.4 */'))return html;
  assert.equal(html.split(STYLES).length,2,'One exact screen-only table CSS block');
  return html.replace(STYLES,'');
}
