// Test-only removal of the approved screen orientation additions. This is not
// a source inverse, release pin, certification receipt or publication approval.
// Long-report text, numbers, tables, charts and pre-existing styles are kept.
// The separate overview contract validates the four tiles and their targets.
import assert from 'node:assert/strict';
import {HORIZONTAL_OVERVIEW_VERSION,restoreHorizontalOverviewDetailPresentation} from './report_overview_horizontal_inverse.mjs';

export function withoutReportOverview(html,{preserveVersion=false}={}) {
  const edition=html.includes('<meta name="monderman-renderer-version" content="'+HORIZONTAL_OVERVIEW_VERSION+'" />')?HORIZONTAL_OVERVIEW_VERSION:'diagnostic-renderer-report-overview-20260923.1';
  if(edition===HORIZONTAL_OVERVIEW_VERSION)html=restoreHorizontalOverviewDetailPresentation(html);
  const opening='<div class="mr-screen-only mr-report-overview" aria-label="Report overview">';
  assert.equal(html.split(opening).length,2,'One screen-only overview');
  const start=html.indexOf(opening),tokens=/<\/?div\b[^>]*>/g;
  tokens.lastIndex=start;let depth=0,end=-1;
  for(let token;(token=tokens.exec(html));){
    depth+=token[0].startsWith('</')?-1:1;
    if(depth===0){end=tokens.lastIndex;break;}
  }
  assert.ok(end>start,'Complete overview container');
  assert.equal((html.slice(start,end).match(/class="mr-overview-tile"/g)||[]).length,4,'Exactly four overview tiles');
  html=html.slice(0,start)+html.slice(end);
  const back=/<div class="mr-screen-only mr-section-back"><a data-report-link-role="overview" href="#[^"]+">↑ Back to overview<\/a><\/div>/g;
  assert.ok((html.match(back)||[]).length>0,'Long sections have return links');
  html=html.replace(back,'');
  const shortcut=/<a data-report-link-role="overview" href="(#[^"]+)">Back to overview<\/a>/g;
  assert.equal((html.match(shortcut)||[]).length,1,'One changed overview shortcut');
  html=html.replace(shortcut,'<a href="$1">Overview</a>');
  assert.equal(html.split('class="mr-cover-white mr-has-overview"').length,2,'One overview cover modifier');
  html=html.replace('class="mr-cover-white mr-has-overview"','class="mr-cover-white"');
  const cssStart='      .mr-report .mr-has-overview>',cssEnd='      .mr-report .mr-cover-kicker{';
  const cssFrom=html.indexOf(cssStart),cssTo=html.indexOf(cssEnd,cssFrom);
  assert.ok(cssFrom>=0&&cssTo>cssFrom,'Bounded additive overview CSS');
  html=html.slice(0,cssFrom)+html.slice(cssTo);
  const version='<meta name="monderman-renderer-version" content="'+edition+'" />';
  assert.equal(html.split(version).length,2,'Exact orientation renderer edition');
  const displayVersion='<dt>Current display version</dt><dd>'+edition+'</dd>';
  assert.ok(html.split(displayVersion).length<=2,'At most one visible current-display edition');
  if(preserveVersion)return html;
  html=html.replace(displayVersion,'<dt>Current display version</dt><dd>diagnostic-renderer-evidence-reading-20260914.43</dd>');
  return html.replace(version,'<meta name="monderman-renderer-version" content="diagnostic-renderer-evidence-reading-20260914.43" />');
}
