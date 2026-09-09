// Test-only rendering of accepted, actual synthetic model outputs. No API,
// authentication, provider, email, or deployment calls. Existing fixture smoke
// remains scripts/report_ai_presentation_smoke.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {evidenceDigest} from '../../monderman-api-first-run/report-evidence-packet.js';
import * as currentContract from '../../monderman-api-first-run/report-ai-interpretation-contract.js';
import {REPORT_AI_RELEASE} from '../../monderman-api-first-run/report-ai-service.js';

const SITE_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ACCEPTED=new Set(['validated_requires_human_review','validated_with_review_flags']);
const safeId=/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const safePrompt=/^report-interpretation-opus5-[0-9]{8}\.[0-9]+$/;
const digest=value=>createHash('sha256').update(value).digest('hex');
const walk=(value,packet,contract=currentContract)=>typeof value==='string'?contract.renderReportAIFacts(value,packet):Array.isArray(value)?value.map(v=>walk(v,packet,contract)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,walk(v,packet,contract)])):value;

export function acceptedPresentationCases(matrix,promptVersion,contract=currentContract){
  assert.equal(matrix?.syntheticOnly,true,'synthetic_only_required');
  assert.equal(matrix?.mode,'live','live_matrix_required');
  assert.equal(matrix?.model,'claude-opus-5','unexpected_matrix_model');
  assert.ok(safePrompt.test(promptVersion||''),'explicit_prompt_version_required');
  assert.ok(Array.isArray(matrix.cases)&&matrix.cases.length>0&&matrix.cases.length<=100,'invalid_matrix_cases');
  assert.ok(typeof matrix.finishedAt==='string'&&Number.isFinite(Date.parse(matrix.finishedAt)),'completed_matrix_timestamp_required');
  const selected=matrix.cases.filter(entry=>ACCEPTED.has(entry.status));
  assert.ok(selected.length>0,'no_accepted_cases');
  const seen=new Set();
  return selected.map(entry=>{
    assert.ok(safeId.test(entry.id||'')&&!seen.has(entry.id),'invalid_or_duplicate_case_id');seen.add(entry.id);
    assert.ok(['diagnostic','synthesis','attack'].includes(entry.kind),'unexpected_case_kind');
    const packet=entry.packet, metadata=entry.metadata;
    assert.equal(metadata?.model,'claude-opus-5','unexpected_case_model');
    assert.equal(metadata?.stopReason,'end_turn','uncompleted_case_response');
    assert.ok(/^req_[A-Za-z0-9_-]{6,120}$/.test(metadata?.requestId||''),'request_metadata_required');
    for(const key of ['inputTokens','outputTokens','cacheCreationInputTokens','cacheReadInputTokens'])assert.ok(Number.isSafeInteger(metadata[key])&&metadata[key]>=0,'invalid_usage_metadata');
    assert.deepEqual(Object.keys(metadata).sort(),['model','requestId','inputTokens','outputTokens','cacheCreationInputTokens','cacheReadInputTokens','stopReason'].sort(),'unexpected_usage_metadata_fields');
    assert.ok(entry.contractInterpretation&&entry.interpretation,'accepted_saved_interpretation_required');
    const normalized=contract.normalizeReportAICitations(entry.contractInterpretation,packet);
    contract.validateReportAIInterpretation(normalized,packet);
    // Use the saved rendered result, not newly invented display copy. A later
    // contract change that alters rendering must be reviewed, not hidden here.
    assert.deepEqual(walk(normalized,packet,contract),entry.interpretation,'saved_rendering_mismatch');
    for(const source of packet.research.sources)assert.ok(typeof source.url==='string'&&/^https:\/\//.test(source.url),'source_url_required');
    const report={version:REPORT_AI_RELEASE,snapshot_id:packet.snapshot_id,model:metadata.model,
      prompt_version:promptVersion,evidence_version:packet.version,questionnaire_version:packet.questionnaire_version,
      research_version:packet.research.version,generated_at:matrix.finishedAt,
      interpretation:structuredClone(entry.interpretation),limitations:structuredClone(packet.limitations),
      sources:structuredClone(packet.research.sources),benchmark:structuredClone(packet.research.benchmark),
      evidence:structuredClone(packet.facts.filter(f=>f.provenance!=='one_participant_untrusted_observation')),usage:structuredClone(metadata)};
    return {id:entry.id,kind:entry.kind,diagnostic:packet.diagnostic,reviewFlags:entry.semanticReviewFlags||[],
      envelope:{version:REPORT_AI_RELEASE,status:'complete',message:'AI-assisted interpretation, based on this saved result.',report}};
  });
}

export function assertPDFMetadataAccompanied(pageTexts,metadata){
  const compact=text=>String(text).replace(/\s+/g,' ').trim();
  assert.ok(Array.isArray(pageTexts)&&pageTexts.length>0,'pdf_text_pages_required');
  const last=compact(pageTexts.at(-1)),expected=compact(metadata),marker=last.indexOf('Interpretation version:');
  assert.ok(last.length>0,'pdf_empty_final_page');
  assert.ok(!expected.endsWith(last),'pdf_orphaned_metadata');
  if(marker>=0)assert.ok(last.slice(0,marker).trim().length>=40,'pdf_orphaned_metadata');
}

function selfTest(){
  const content={version:'synthetic-self-test',diagnostic:'Decision Velocity',tool:'decision_velocity',role:'managerial',depth:10,sector:'other',questionnaire_version:'1.1.0',facts:[
    {id:'F1',label:'Diagnostic score',value:70,provenance:'deterministic_result',interpretation:'A supplied value.'},
    {id:'F2',label:'Participant observation',value:'PRIVATE_SYNTHETIC_SENTINEL',provenance:'one_participant_untrusted_observation',interpretation:'Unverified account.'}
  ],research:{version:'self-test',sources:[],benchmark:{status:'not_available',explanation:'No comparison is supplied.'}},limitations:['Synthetic test only.']};
  const packet={...content,snapshot_id:evidenceDigest(content)};
  const interpretation={summary:'This is an offline fixture.',observations:[{text:'The supplied score is {{F1}}.',evidence_ids:['F1']}],hypotheses:[],recommendations:[],limitations:[]};
  const entry={id:'DV-self-test',kind:'diagnostic',status:'validated_requires_human_review',packet,contractInterpretation:interpretation,
    interpretation:walk(interpretation,packet),metadata:{model:'claude-opus-5',requestId:'req_synthetic123',inputTokens:100,outputTokens:100,cacheCreationInputTokens:0,cacheReadInputTokens:0,stopReason:'end_turn'}};
  const fixture={syntheticOnly:true,mode:'live',model:'claude-opus-5',finishedAt:'2026-09-08T00:00:00Z',cases:[entry,{id:'never-render',status:'rejected',syntheticRejectedInterpretation:{summary:'MUST_NOT_RENDER'}}]};
  const version='report-interpretation-opus5-20260908.4';
  const cases=acceptedPresentationCases(fixture,version);
  assert.equal(cases.length,1);assert.equal(cases[0].envelope.report.interpretation.observations[0].text,'The supplied score is 70.');
  assert.equal(cases[0].envelope.report.evidence.length,1);assert.ok(!JSON.stringify(cases).includes('PRIVATE_SYNTHETIC_SENTINEL'));assert.ok(!JSON.stringify(cases).includes('MUST_NOT_RENDER'));
  for(const change of [m=>m.syntheticOnly=false,m=>m.mode='dry',m=>m.model='other',m=>delete m.finishedAt,m=>m.cases[0].metadata.stopReason='max_tokens',m=>m.cases[0].status='rejected',m=>m.cases[0].interpretation.summary='changed',m=>m.cases[0].packet.facts[0].value=71,m=>m.cases[0].metadata.thinking='secret',m=>m.cases[0].id='../escape']){
    const mutated=structuredClone(fixture);change(mutated);assert.throws(()=>acceptedPresentationCases(mutated,version));
  }
  assert.throws(()=>acceptedPresentationCases(fixture,''));
  const metadata='Interpretation version: example. Prepared: today. Evidence reference: abc123.';
  for(const last of [metadata,' \n'+metadata+'\n ', 'Evidence reference: abc123.'])assert.throws(()=>assertPDFMetadataAccompanied(['Earlier report content.',last],metadata),/pdf_orphaned_metadata/);
  assertPDFMetadataAccompanied(['Earlier report content.','A reviewed practice source offers guidance rather than a numerical peer benchmark.\n'+metadata],metadata);
  console.log('PASS actual-report presentation input self-test: accepted synthetic live cases only; exact saved text, immutable evidence, safe metadata, no rejected/private-text rendering. No browser, PDF or network calls.');
}

function tool(name,args){
  const result=spawnSync(name,args,{encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(result.status,0,`presentation_${name}_failed`);return result.stdout;
}

async function main(){
  const args=process.argv.slice(2),arg=name=>{const at=args.indexOf(name);return at<0?null:args[at+1];};
  if(args.includes('--self-test'))return selfTest();
  const inputPath=arg('--input'),promptVersion=arg('--prompt-version');
  assert.ok(inputPath,'input_file_required');
  const stat=fs.statSync(inputPath);assert.ok(stat.isFile()&&stat.size<=16*1024*1024,'invalid_input_file');
  const raw=fs.readFileSync(inputPath,'utf8'),matrix=JSON.parse(raw);
  let contract=currentContract;
  const historicalModule=arg('--validation-module');
  const validatorPath=historicalModule?fs.realpathSync(historicalModule):fileURLToPath(new URL('../../monderman-api-first-run/report-ai-interpretation-contract.js',import.meta.url));
  const validatorSha256=digest(fs.readFileSync(validatorPath));
  if(historicalModule){
    assert.ok(/^[a-f0-9]{64}$/.test(arg('--validation-sha256')||''),'pinned_validation_sha256_required');
    assert.equal(validatorSha256,arg('--validation-sha256'),'historical_validation_hash_mismatch');
    contract=await import(pathToFileURL(validatorPath).href);
    assert.equal(contract.REPORT_AI_PROMPT_VERSION,promptVersion,'historical_validation_version_mismatch');
  }
  const validation={path:validatorPath,sha256:validatorSha256,promptVersion:contract.REPORT_AI_PROMPT_VERSION,
    historical:Boolean(historicalModule),scope:historicalModule?'Historical contract for rendering unchanged actual text only; not current quality approval.':'Current contract.'};
  const cases=acceptedPresentationCases(matrix,promptVersion,contract);
  if(args.includes('--dry-run')){console.log(JSON.stringify({acceptedCases:cases.map(c=>c.id),excludedCases:matrix.cases.length-cases.length,pdfCount:cases.length,renderCount:cases.length*3,inputSha256:digest(raw)}));return;}
  for(const name of ['pdfinfo','pdftoppm'])tool(name,['-v']);
  // PDF extraction uses pypdf from the configured Python runtime. This avoids
  // requiring pdftotext, which is not part of every bundled Poppler install.
  const python=process.env.PDF_PYTHON||'python3';
  tool(python,['-c','from pypdf import PdfReader']);
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const outRoot=path.resolve(arg('--out')||path.join(SITE_ROOT,'output/report-ai-actual-presentation'));fs.mkdirSync(outRoot,{recursive:true});
  const out=fs.mkdtempSync(path.join(outRoot,'render-'));
  const source=fs.readFileSync(path.join(SITE_ROOT,'monderman-report.js'),'utf8');
  const evidence={syntheticOnly:true,inputSha256:digest(raw),rendererSha256:digest(source),promptVersion,acceptedCases:cases.length,excludedCases:matrix.cases.length-cases.length,
    timestampBasis:'generated_at uses the completed matrix timestamp; individual response timestamps were not recorded.',
    scope:'Actual accepted AI interpretation only, using production report CSS, interpretation renderer and print/close buttons. Not the full measured report, authentication, model quality, or a physical-device test.',
    validation,widths:[390,768,1440],checks:[],pdfs:[],pageErrors:0,blockedRequests:0,passed:false};
  const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();
  page.on('pageerror',()=>evidence.pageErrors++);
  await context.route('**/*',route=>{const url=new URL(route.request().url());
    if(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(path.join(SITE_ROOT,url.pathname.slice(1)))});
    evidence.blockedRequests++;return route.abort();
  });
  try{
    for(const entry of cases){
      const caseDir=path.join(out,entry.id);fs.mkdirSync(caseDir);
      fs.writeFileSync(path.join(caseDir,'presentation-envelope.json'),JSON.stringify(entry.envelope,null,2));
      await page.setContent('<!doctype html><html><head></head><body></body></html>');await page.addScriptTag({content:source});
      const html=await page.evaluate(({envelope,diagnostic})=>{
        const documentHtml=MondermanReport.buildReportHtml({});
        const doc=new DOMParser().parseFromString(documentHtml,'text/html'),host=doc.querySelector('.mr-page'),actions=doc.querySelector('.actions').outerHTML;
        host.innerHTML=MondermanReport.buildAIInterpretation(envelope)+actions;
        const title=doc.createElement('h1');title.textContent=diagnostic+' · Synthetic presentation test';host.prepend(title);
        return '<!doctype html>'+doc.documentElement.outerHTML;
      },entry);
      assert.doesNotMatch(html,/\[object Object\]|\bundefined\b|\bNaN\b|\{\{F\d/,'invalid_rendered_text');
      fs.writeFileSync(path.join(caseDir,'report.html'),html);
      for(const width of evidence.widths){
        await page.setViewportSize({width,height:1000});await page.setContent(html);
        const fonts=await page.evaluate(async()=>{await Promise.all([400,500,700].map(weight=>document.fonts.load(`${weight} 16px "Neue Haas Grotesk"`)));await document.fonts.ready;return [...document.fonts].map(font=>({family:font.family,weight:font.weight,status:font.status}));});
        assert.equal(fonts.filter(font=>font.family==='Neue Haas Grotesk'&&font.status==='loaded').length,3,'brand_fonts_not_loaded');
        assert.equal(await page.locator('.mr-ai-interpretation').count(),1,'duplicate_ai_section');
        assert.equal(await page.locator('.mr-ai-action').count(),entry.envelope.report.interpretation.recommendations.length,'missing_recommendation');
        const layout=await page.evaluate(()=>{
          const issues=[];for(const el of document.querySelectorAll('.mr-ai-interpretation,.mr-ai-interpretation *,.actions,.actions button')){
            const r=el.getBoundingClientRect();if(r.width>0&&(r.left<-.5||r.right>innerWidth+1))issues.push({tag:el.tagName,reason:'viewport_overflow'});
            if(el.clientWidth>0&&el.scrollWidth>el.clientWidth+2)issues.push({tag:el.tagName,reason:'internal_overflow'});
          }
          const buttons=[...document.querySelectorAll('.actions button')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,disabled:el.disabled};});
          return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,issues,buttons,links:[...document.querySelectorAll('.mr-ai-interpretation a')].map(el=>({href:el.getAttribute('href'),rel:el.rel,target:el.target}))};
        });
        assert.ok(layout.scrollWidth<=width+1,'document_overflow');assert.deepEqual(layout.issues,[],'element_overflow');assert.equal(layout.buttons.length,2,'report_buttons_missing');
        for(const button of layout.buttons)assert.ok(button.width>=44&&button.height>=44&&!button.disabled,'button_target_too_small');
        const [a,b]=layout.buttons;assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'report_buttons_overlap');
        const allowed=new Set(entry.envelope.report.sources.map(source=>source.url));
        for(const link of layout.links)assert.ok(allowed.has(link.href)&&link.target==='_blank'&&link.rel.includes('noopener')&&link.rel.includes('noreferrer'),'unexpected_source_link');
        await page.evaluate(()=>{window.printCalls=0;window.closeCalls=0;window.print=()=>printCalls++;window.close=()=>closeCalls++;});
        await page.getByRole('button',{name:'Save / Print PDF',exact:true}).focus();await page.keyboard.press('Enter');
        await page.getByRole('button',{name:'Close report',exact:true}).click();
        assert.deepEqual(await page.evaluate(()=>({print:printCalls,close:closeCalls})),{print:1,close:1},'report_button_handlers_failed');
        const screenshot=`${width}.png`;await page.screenshot({path:path.join(caseDir,screenshot),fullPage:true});
        evidence.checks.push({case:entry.id,...layout,fonts,screenshot:`${entry.id}/${screenshot}`,semanticReviewFlags:entry.reviewFlags});
      }
      await page.emulateMedia({media:'print'});assert.equal(await page.locator('.actions').isVisible(),false,'print_buttons_not_hidden');
      const pdf=path.join(caseDir,'report.pdf');await page.pdf({path:pdf,format:'Letter',printBackground:true,preferCSSPageSize:true});
      const info=tool('pdfinfo',[pdf]),pages=Number(info.match(/^Pages:\s+(\d+)$/m)?.[1]);assert.ok(pages>0&&pages<=40,'invalid_pdf_page_count');
      const pageTexts=JSON.parse(tool(python,['-c','import sys,json; from pypdf import PdfReader; print(json.dumps([page.extract_text() or "" for page in PdfReader(sys.argv[1]).pages]))',pdf]));
      assert.equal(pageTexts.length,pages,'pdf_extraction_page_mismatch');
      const text=pageTexts.join('\n');assert.match(text,/AI-assisted interpretation/,'pdf_interpretation_missing');assert.doesNotMatch(text,/Save \/ Print PDF|Close report|\{\{F\d/,'pdf_controls_or_placeholders_visible');
      const metadata=await page.locator('.mr-ai-interpretation>.mr-method-copy:last-child').innerText();
      assertPDFMetadataAccompanied(pageTexts,metadata);
      tool('pdftoppm',['-r','90','-png',pdf,path.join(caseDir,'pdf-page')]);
      const images=fs.readdirSync(caseDir).filter(name=>/^pdf-page-\d+\.png$/.test(name));assert.equal(images.length,pages,'pdf_page_images_missing');
      evidence.pdfs.push({case:entry.id,path:`${entry.id}/report.pdf`,pages,textExtraction:'pypdf',metadataAccompanied:true,pageImages:images.map(name=>`${entry.id}/${name}`),visualInspection:'Pending human/agent inspection of every page image.'});
      await page.emulateMedia({media:'screen'});
      console.log(JSON.stringify({case:entry.id,responsiveWidths:evidence.widths,pdfPages:pages,status:'rendered_requires_visual_review'}));
    }
    assert.equal(evidence.pageErrors,0,'browser_page_error');assert.equal(evidence.blockedRequests,0,'unexpected_network_attempt');evidence.passed=true;
  }catch(error){evidence.failureCode=/^[a-z_]{3,100}$/.test(String(error?.message||''))?error.message:'presentation_check_failed';throw error;
  }finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(evidence,null,2));await browser.close();console.log(JSON.stringify({passed:evidence.passed,out,checks:evidence.checks.length,pdfs:evidence.pdfs.length,visualReviewRequired:true}));}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('ACTUAL_REPORT_PRESENTATION_FAILED: inspect local checks.json; no provider or customer requests were made.');process.exitCode=1;});
