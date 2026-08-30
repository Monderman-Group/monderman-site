// Final exact-head release-candidate render gate for the customer-facing sample library.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base=process.env.SAMPLE_BASE || 'http://127.0.0.1:8080';
const out=process.env.SAMPLE_OUT || '/tmp/sample-report-marketing-smoke';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error') errors.push(`console: ${m.text()}`)});

function assert(ok,msg){ if(!ok) throw new Error(msg); }
await page.goto(`${base}/sample-report.html`,{waitUntil:'networkidle',timeout:90000});
// textContent intentionally includes hidden tab panels; each panel is separately made visible and rendered below.
const pageText=await page.locator('body').textContent();
assert(pageText.includes('Representative product outputs, not customer data.'),'representative-sample disclosure missing');
assert(!/\bseat(?:s|-year)?\b/i.test(pageText),'seat vocabulary remains');
assert(!/Insight depth/i.test(pageText),'Insight depth remains');
assert(!/executive-seat/i.test(pageText),'executive-seat remains');
assert(!/unedited output|identical to a real run/i.test(pageText),'misleading provenance claim remains');
assert(!pageText.includes('$84,000'),'stale Structural Clarity burden contradiction remains');
assert(!pageText.includes('$6.9 million'),'stale Institutional Performance burden contradiction remains');
assert(pageText.includes('$74,880'),'Structural Clarity representative burden missing');
assert(pageText.includes('$844,800'),'Institutional Performance representative burden missing');

const cases=[
  ['os','Operational Systems',['Operational Systems: Executive Report','Executive decision brief','Interpretation boundary']],
  ['dv','Decision Velocity',['Decision Velocity: Executive Report','Executive decision brief','Interpretation boundary']],
  ['sc','Structural Clarity',['Structural Clarity: Executive Report','Executive decision brief','Interpretation boundary']],
  ['ip','Institutional Performance',['Institutional Performance: Executive Report','Executive decision brief','Interpretation boundary']],
  ['synthesis','Cross-Lens Synthesis',['Cross-Lens Composite Score','Strong evidence','55.5','Structural Clarity','Decision Velocity']],
  ['depth','Depth Synthesis',['Median Diagnostic Score','Substantial evidence','18 eligible runs','Operational','Managerial','Senior Leader']]
];
for(const [key,label,required] of cases){
  await page.locator(`[data-target="${key}"]`).click();
  await page.waitForTimeout(250);
  const shell=page.locator(`[data-report="${key}"]`);
  assert(await shell.isVisible(),`${label} shell not visible`);
  const box=await shell.boundingBox();
  assert(box && box.width>0 && box.height>0,`${label} has no rendered geometry`);
  const txt=await shell.textContent();
  for(const token of required) assert(txt.includes(token),`${label} missing ${token}`);
  await page.screenshot({path:path.join(out,`${key}.png`),fullPage:true});
}

const depthText=await page.locator('[data-report="depth"]').textContent();
assert(depthText.includes('Range 41–74'),'Depth representative distribution missing');
assert(depthText.includes('median 56'),'Depth median mismatch');

assert(errors.length===0,errors.join('\n'));
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,tabs:cases.length,console_errors:errors},null,2));
console.log('SAMPLE_REPORT_MARKETING_RENDER_PASS_6_OF_6');
await browser.close();
