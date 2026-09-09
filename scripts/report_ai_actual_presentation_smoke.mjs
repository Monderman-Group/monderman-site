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
import {buildReportAIReviewPrompt,REPORT_AI_REVIEW_PROMPT_VERSION,REPORT_AI_REVIEW_CONTRACT_VERSION} from '../../monderman-api-first-run/report-ai-review.js';
import {buildReportQuantityCatalog,REPORT_QUANTITY_STATEMENT_VERSION} from '../../monderman-api-first-run/report-ai-quantity-statements.js';
import {buildReportAIComposition,assertReportAIComposition,REPORT_AI_COMPOSITION_VERSION,REPORT_AI_QUANTITY_PROSE_POLICY_VERSION} from '../../monderman-api-first-run/report-ai-composition.js';

const SITE_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ACCEPTED=new Set(['validated_requires_human_review','validated_with_review_flags']);
const safeId=/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const safePrompt=/^report-interpretation-opus5-[0-9]{8}\.[0-9]+$/;
const digest=value=>createHash('sha256').update(value).digest('hex');
const currentSourcePins=()=>{
  const registry=fs.readFileSync(new URL('../../monderman-api-first-run/questionnaire-version-registry.js',import.meta.url),'utf8');
  const banks=[...registry.matchAll(/^import (\w+) from "\.\/([^"]+)" with \{ type: "json" \};$/gm)].map(match=>match[2]);
  assert.equal(banks.length,8,'complete_questionnaire_registry_required');
  return Object.fromEntries(['report-ai-provider.js','report-ai-interpretation-contract.js','report-ai-review.js','report-ai-evidence-encoding.js','report-ai-quantity-statements.js','report-ai-composition.js','report-evidence-packet.js','report-research-library.js','questionnaire-version-registry.js',...banks,'harness-report-ai-live.mjs'].map(name=>[name,digest(fs.readFileSync(new URL(`../../monderman-api-first-run/${name}`,import.meta.url)))]));
};
const walk=(value,packet,contract=currentContract)=>typeof value==='string'?contract.renderReportAIFacts(value,packet):Array.isArray(value)?value.map(v=>walk(v,packet,contract)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,walk(v,packet,contract)])):value;

export function acceptedPresentationCases(matrix,promptVersion,contract=currentContract,{allowHistoricalDrafts=false}={}){
  assert.equal(matrix?.syntheticOnly,true,'synthetic_only_required');
  assert.equal(matrix?.mode,'live','live_matrix_required');
  assert.equal(matrix?.model,'claude-opus-5','unexpected_matrix_model');
  assert.ok(safePrompt.test(promptVersion||''),'explicit_prompt_version_required');
  assert.ok(Array.isArray(matrix.cases)&&matrix.cases.length>0&&matrix.cases.length<=200,'invalid_matrix_cases');
  assert.ok(typeof matrix.finishedAt==='string'&&Number.isFinite(Date.parse(matrix.finishedAt)),'completed_matrix_timestamp_required');
  let manifestCases;
  if(!allowHistoricalDrafts){
    assert.equal(promptVersion,contract.REPORT_AI_PROMPT_VERSION,'current_prompt_version_required');
    assert.equal(matrix.semanticReview,true,'mandatory_semantic_review_missing');
    assert.equal(matrix.releaseCertificationEligible,true,'draft_only_cannot_certify_current_release');
    assert.equal(matrix.manifest?.schemaVersion,'synthetic-report-ai-evaluation-4','reviewed_manifest_required');
    assert.equal(matrix.manifest.compositionVersion,REPORT_AI_COMPOSITION_VERSION,'composition_version_mismatch');
    assert.equal(matrix.manifest.quantityVersion,REPORT_QUANTITY_STATEMENT_VERSION,'quantity_version_mismatch');
    assert.equal(matrix.manifest.quantityProsePolicyVersion,REPORT_AI_QUANTITY_PROSE_POLICY_VERSION,'quantity_prose_policy_mismatch');
    assert.equal(matrix.manifest.draftHashMeaning,'compiled-customer-interpretation','compiled_hash_meaning_required');
    assert.equal(matrix.manifest.semanticReview,true,'reviewed_manifest_required');
    assert.equal(matrix.manifest.model,'claude-opus-5','reviewed_manifest_model_mismatch');
    assert.equal(matrix.manifest.promptVersion,promptVersion,'reviewed_manifest_prompt_mismatch');
    assert.equal(matrix.manifest.contractVersion,contract.REPORT_AI_CONTRACT_VERSION,'reviewed_manifest_contract_mismatch');
    assert.equal(matrix.manifest.review?.promptVersion,REPORT_AI_REVIEW_PROMPT_VERSION,'review_prompt_mismatch');
    assert.equal(matrix.manifest.review?.contractVersion,REPORT_AI_REVIEW_CONTRACT_VERSION,'review_contract_mismatch');
    assert.equal(matrix.manifestSha256,evidenceDigest(matrix.manifest),'manifest_digest_mismatch');
    assert.deepEqual(matrix.manifest.sourceDigests,currentSourcePins(),'current_source_pins_mismatch');
    assert.ok(['initial','presentation-correction','quantity-correction'].includes(matrix.manifest.promptMode),'manifest_prompt_mode_invalid');
    assert.equal(matrix.promptMode,matrix.manifest.promptMode,'manifest_prompt_mode_mismatch');
    assert.equal(matrix.presentationRetry,matrix.promptMode==='presentation-correction','presentation_retry_flag_mismatch');
    assert.equal(matrix.quantityRetry,matrix.promptMode==='quantity-correction','quantity_retry_flag_mismatch');
    assert.ok(Array.isArray(matrix.manifest.cases)&&matrix.manifest.cases.length>0&&matrix.manifest.cases.length<=200,'manifest_cases_required');
    if(matrix.promptMode!=='initial'){
      assert.equal(matrix.manifest.cases.length,1,'correction_requires_single_manifest_case');
      assert.equal(matrix.cases.length,1,'correction_requires_single_receipt_case');
    }
    manifestCases=new Map();
    for(const fixture of matrix.manifest.cases){
      assert.ok(safeId.test(fixture.id||'')&&!manifestCases.has(fixture.id),'manifest_case_identity_invalid');
      assert.ok(['diagnostic','synthesis','attack'].includes(fixture.kind),'manifest_case_kind_invalid');
      manifestCases.set(fixture.id,fixture);
    }
  }
  const selected=matrix.cases.filter(entry=>ACCEPTED.has(entry.status));
  assert.ok(selected.length>0,'no_accepted_cases');
  const seen=new Set();
  return selected.map(entry=>{
    assert.ok(safeId.test(entry.id||'')&&!seen.has(entry.id),'invalid_or_duplicate_case_id');seen.add(entry.id);
    assert.ok(['diagnostic','synthesis','attack'].includes(entry.kind),'unexpected_case_kind');
    const packet=entry.packet, metadata=entry.metadata;
    if(!allowHistoricalDrafts){
      const fixture=manifestCases.get(entry.id);
      assert.ok(fixture,'case_absent_from_manifest');
      assert.equal(entry.promptMode,matrix.promptMode,'case_prompt_mode_mismatch');
      assert.equal(entry.kind,fixture.kind,'case_manifest_kind_mismatch');
      assert.equal(evidenceDigest(packet),fixture.packetSha256,'case_manifest_packet_mismatch');
      const quantityCatalog=buildReportQuantityCatalog(packet);
      assert.equal(fixture.catalogSha256,quantityCatalog.catalog_sha256,'case_catalog_mismatch');
      const promptHash=evidenceDigest(contract.buildReportAIPrompt(packet,{presentationRetry:matrix.manifest.promptMode==='presentation-correction',quantityRetry:matrix.manifest.promptMode==='quantity-correction',quantityCatalog}));
      assert.equal(fixture.promptSha256,promptHash,'case_manifest_prompt_mismatch');
      assert.equal(entry.promptSha256,promptHash,'case_saved_prompt_mismatch');
    }
    assert.equal(metadata?.model,'claude-opus-5','unexpected_case_model');
    assert.equal(metadata?.stopReason,'end_turn','uncompleted_case_response');
    assert.ok(/^req_[A-Za-z0-9_-]{6,120}$/.test(metadata?.requestId||''),'request_metadata_required');
    for(const key of ['inputTokens','outputTokens','cacheCreationInputTokens','cacheReadInputTokens'])assert.ok(Number.isSafeInteger(metadata[key])&&metadata[key]>=0,'invalid_usage_metadata');
    assert.deepEqual(Object.keys(metadata).sort(),['model','requestId','inputTokens','outputTokens','cacheCreationInputTokens','cacheReadInputTokens','stopReason'].sort(),'unexpected_usage_metadata_fields');
    assert.ok(entry.contractInterpretation&&entry.interpretation,'accepted_saved_interpretation_required');
    const composition=allowHistoricalDrafts?null:buildReportAIComposition(entry.contractInterpretation,packet);
    const normalized=composition?composition.wire:contract.normalizeReportAICitations(entry.contractInterpretation,packet);
    if(!composition)contract.validateReportAIInterpretation(normalized,packet);
    if(!allowHistoricalDrafts){
      const original=buildReportAIComposition(entry.syntheticOriginalInterpretation,packet);
      assert.deepEqual(entry.composition,assertReportAIComposition(composition,{packet}),'composition_binding_mismatch');
      assert.equal(entry.wireHash,composition.wireHash,'wire_hash_mismatch');
      assert.equal(evidenceDigest(entry.contractInterpretation),composition.wireHash,'normalized_wire_mismatch');
      assert.equal(original.wireHash,composition.wireHash,'original_wire_mismatch');
      assert.equal(entry.draftHash,composition.compiledHash,'compiled_draft_mismatch');
      assert.deepEqual(entry.syntheticDraftInterpretation,composition.interpretation,'saved_compiled_draft_mismatch');
      assert.equal(entry.draftStatus,'validated','validated_draft_required');
      const review=entry.review;
      assert.equal(review?.status,'approved','approved_review_required');
      assert.equal(review.verdict,'approve','approved_review_required');
      assert.deepEqual(review.findings,[],'review_findings_must_be_empty');
      assert.equal(review.model,'claude-opus-5','review_model_mismatch');
      assert.equal(review.snapshotId,packet.snapshot_id,'review_snapshot_mismatch');
      assert.equal(review.draftHash,composition.compiledHash,'review_draft_mismatch');
      assert.equal(review.promptSha256,evidenceDigest(buildReportAIReviewPrompt(packet,composition.interpretation,{composition})),'review_prompt_hash_mismatch');
      assert.equal(review.promptVersion,REPORT_AI_REVIEW_PROMPT_VERSION,'case_review_prompt_mismatch');
      assert.equal(review.contractVersion,REPORT_AI_REVIEW_CONTRACT_VERSION,'case_review_contract_mismatch');
      assert.equal(review.metadata?.model,'claude-opus-5','review_metadata_required');
      assert.equal(review.metadata.stopReason,'end_turn','review_not_completed');
      assert.match(review.metadata.requestId||'',/^req_[A-Za-z0-9_-]{6,120}$/,'review_request_metadata_required');
      for(const key of ['inputTokens','outputTokens','cacheCreationInputTokens','cacheReadInputTokens'])assert.ok(Number.isSafeInteger(review.metadata[key])&&review.metadata[key]>=0,'review_usage_invalid');
      assert.deepEqual(Object.keys(review.metadata).sort(),['model','requestId','inputTokens','outputTokens','cacheCreationInputTokens','cacheReadInputTokens','stopReason'].sort(),'unexpected_review_metadata_fields');
    }
    // Use the saved rendered result, not newly invented display copy. A later
    // contract change that alters rendering must be reviewed, not hidden here.
    assert.deepEqual(composition?composition.interpretation:walk(normalized,packet,contract),entry.interpretation,'saved_rendering_mismatch');
    for(const source of packet.research.sources)assert.ok(typeof source.url==='string'&&/^https:\/\//.test(source.url),'source_url_required');
    const report={version:REPORT_AI_RELEASE,snapshot_id:packet.snapshot_id,model:metadata.model,
      prompt_version:promptVersion,evidence_version:packet.version,questionnaire_version:packet.questionnaire_version,
      research_version:packet.research.version,generated_at:matrix.finishedAt,
      interpretation:structuredClone(entry.interpretation),limitations:structuredClone(packet.limitations),
      sources:structuredClone(packet.research.sources),benchmark:structuredClone(packet.research.benchmark),
      evidence:structuredClone(packet.facts.filter(f=>f.provenance!=='one_participant_untrusted_observation')),usage:structuredClone(metadata)};
    if(!allowHistoricalDrafts)report.composition={version:composition.version,quantity_version:composition.quantityVersion,
      quantity_prose_policy_version:composition.quantityProsePolicyVersion,snapshot_id:composition.snapshotId,catalog_sha256:composition.catalogHash,
      wire_sha256:composition.wireHash,compiled_sha256:composition.compiledHash,quantity_paragraphs:composition.quantityParagraphs};
    if(!allowHistoricalDrafts)report.automated_review={verdict:'approve',prompt_version:entry.review.promptVersion,
      contract_version:entry.review.contractVersion,draft_sha256:entry.review.draftHash,snapshot_id:entry.review.snapshotId,
      model:entry.review.model,usage:structuredClone(entry.review.metadata)};
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
  const content={version:'report-evidence-20260909.1',diagnostic:'Decision Velocity',tool:'decision_velocity',role:'managerial',depth:10,sector:'other',questionnaire_version:'1.1.0',facts:[
    {id:'F1',label:'Diagnostic score',value:70,provenance:'deterministic_result',interpretation:'A supplied value.'},
    {id:'F2',label:'Participant observation',value:'PRIVATE_SYNTHETIC_SENTINEL',provenance:'one_participant_untrusted_observation',interpretation:'Unverified account.'},
    {id:'F3',label:'Contradictions flagged',value:2,provenance:'deterministic_result',interpretation:'Count of flagged contradictions, not conflicting answers or people.'},
    {id:'F4',label:'Result band',value:'Compounding',provenance:'deterministic_result',interpretation:'The exact saved band label.'}
  ],research:{version:'self-test',sources:[],benchmark:{status:'not_available',explanation:'No comparison is supplied.'}},limitations:['Synthetic test only.']};
  const packet={...content,snapshot_id:evidenceDigest(content)};
  const interpretation={summary:'This is an offline fixture.',observations:[{text:'The result band is {{F4}}.',evidence_ids:['F4']},{text:'{{Q1}}',evidence_ids:[]}],hypotheses:[],recommendations:[],limitations:[]};
  const composition=buildReportAIComposition(interpretation,packet),quantityCatalog=buildReportQuantityCatalog(packet);
  const entry={id:'DV-self-test',kind:'diagnostic',promptMode:'initial',status:'validated_requires_human_review',packet,contractInterpretation:composition.wire,
    interpretation:composition.interpretation,syntheticOriginalInterpretation:interpretation,syntheticDraftInterpretation:composition.interpretation,
    wireHash:composition.wireHash,draftHash:composition.compiledHash,composition:assertReportAIComposition(composition,{packet}),
    metadata:{model:'claude-opus-5',requestId:'req_synthetic123',inputTokens:100,outputTokens:100,cacheCreationInputTokens:0,cacheReadInputTokens:0,stopReason:'end_turn'}};
  entry.draftStatus='validated';entry.review={status:'approved',verdict:'approve',findings:[],model:'claude-opus-5',
    snapshotId:packet.snapshot_id,draftHash:composition.compiledHash,promptVersion:REPORT_AI_REVIEW_PROMPT_VERSION,
    promptSha256:evidenceDigest(buildReportAIReviewPrompt(packet,composition.interpretation,{composition})),
    contractVersion:REPORT_AI_REVIEW_CONTRACT_VERSION,metadata:structuredClone(entry.metadata)};
  const version=currentContract.REPORT_AI_PROMPT_VERSION;
  entry.promptSha256=evidenceDigest(currentContract.buildReportAIPrompt(packet,{quantityCatalog}));
  const fixture={syntheticOnly:true,mode:'live',promptMode:'initial',presentationRetry:false,quantityRetry:false,semanticReview:true,releaseCertificationEligible:true,
    manifest:{schemaVersion:'synthetic-report-ai-evaluation-4',semanticReview:true,model:'claude-opus-5',promptVersion:version,
      compositionVersion:REPORT_AI_COMPOSITION_VERSION,quantityVersion:REPORT_QUANTITY_STATEMENT_VERSION,quantityProsePolicyVersion:REPORT_AI_QUANTITY_PROSE_POLICY_VERSION,draftHashMeaning:'compiled-customer-interpretation',
      contractVersion:currentContract.REPORT_AI_CONTRACT_VERSION,review:{promptVersion:REPORT_AI_REVIEW_PROMPT_VERSION,contractVersion:REPORT_AI_REVIEW_CONTRACT_VERSION},
      promptMode:'initial',sourceDigests:currentSourcePins(),cases:[{id:entry.id,kind:entry.kind,packetSha256:evidenceDigest(packet),catalogSha256:quantityCatalog.catalog_sha256,promptSha256:entry.promptSha256}]},
    model:'claude-opus-5',finishedAt:'2026-09-08T00:00:00Z',cases:[entry,{id:'never-render',status:'rejected',syntheticRejectedInterpretation:{summary:'MUST_NOT_RENDER'}}]};
  fixture.manifestSha256=evidenceDigest(fixture.manifest);
  const cases=acceptedPresentationCases(fixture,version);
  assert.equal(cases.length,1);assert.equal(cases[0].envelope.report.interpretation.observations[0].text,'The result band is Compounding.');
  assert.equal(cases[0].envelope.report.evidence.length,3);assert.ok(!JSON.stringify(cases).includes('PRIVATE_SYNTHETIC_SENTINEL'));assert.ok(!JSON.stringify(cases).includes('MUST_NOT_RENDER'));
  assert.equal(cases[0].envelope.report.interpretation.observations[1].text,quantityCatalog.statements[0].text);
  assert.notEqual(entry.wireHash,entry.draftHash);assert.equal(cases[0].envelope.report.automated_review.draft_sha256,entry.draftHash);
  assert.equal(cases[0].envelope.report.composition.quantity_prose_policy_version,REPORT_AI_QUANTITY_PROSE_POLICY_VERSION);
  // Correction receipts are display evidence only for that distinct request.
  // Never relabel an initial draft or accept an unbound mode/flag combination.
  for(const mode of ['presentation-correction','quantity-correction']){
    const corrected=structuredClone(fixture);corrected.cases=corrected.cases.slice(0,1);
    corrected.promptMode=corrected.manifest.promptMode=corrected.cases[0].promptMode=mode;
    corrected.presentationRetry=mode==='presentation-correction';corrected.quantityRetry=mode==='quantity-correction';
    const hash=evidenceDigest(currentContract.buildReportAIPrompt(packet,{presentationRetry:corrected.presentationRetry,quantityRetry:corrected.quantityRetry,quantityCatalog}));
    assert.notEqual(hash,fixture.cases[0].promptSha256);
    corrected.cases[0].promptSha256=corrected.manifest.cases[0].promptSha256=hash;
    corrected.manifestSha256=evidenceDigest(corrected.manifest);
    assert.equal(acceptedPresentationCases(corrected,version).length,1);
    for(const change of [m=>m.presentationRetry=!m.presentationRetry,m=>m.quantityRetry=!m.quantityRetry,m=>m.cases[0].promptMode='initial',m=>m.cases[0].promptSha256=fixture.cases[0].promptSha256,m=>m.manifest.cases[0].promptSha256=fixture.cases[0].promptSha256,m=>m.cases.push({id:'extra-rejected',status:'rejected'}),m=>m.manifest.cases.push({...m.manifest.cases[0],id:'extra'})]){
      const invalid=structuredClone(corrected);change(invalid);invalid.manifestSha256=evidenceDigest(invalid.manifest);
      assert.throws(()=>acceptedPresentationCases(invalid,version));
    }
  }
  for(const change of [m=>m.syntheticOnly=false,m=>m.mode='dry',m=>m.model='other',m=>delete m.finishedAt,m=>m.cases[0].metadata.stopReason='max_tokens',m=>m.cases[0].status='rejected',m=>m.cases[0].interpretation.summary='changed',m=>m.cases[0].packet.facts[0].value=71,m=>m.cases[0].metadata.thinking='secret',m=>m.cases[0].id='../escape']){
    const mutated=structuredClone(fixture);change(mutated);assert.throws(()=>acceptedPresentationCases(mutated,version));
  }
  assert.throws(()=>acceptedPresentationCases(fixture,''));
  assert.throws(()=>acceptedPresentationCases(fixture,'report-interpretation-opus5-20260908.7'),/current_prompt_version_required/);
  const unsafeReview=structuredClone(fixture);unsafeReview.cases[0].review.metadata.thinking='MUST_NOT_RENDER';
  assert.throws(()=>acceptedPresentationCases(unsafeReview,version),/unexpected_review_metadata_fields/);
  const badManifest=structuredClone(fixture);badManifest.manifestSha256='f'.repeat(64);
  assert.throws(()=>acceptedPresentationCases(badManifest,version),/manifest_digest_mismatch/);
  for(const change of [m=>m.manifest.sourceDigests['report-ai-interpretation-contract.js']='stale',m=>m.manifest.cases[0].packetSha256='a'.repeat(64),m=>m.cases[0].id='not-in-manifest',m=>m.manifest.cases.push(structuredClone(m.manifest.cases[0])),m=>m.manifest.cases[0].kind='synthesis',m=>m.manifest.cases[0].promptSha256='b'.repeat(64),m=>m.cases[0].promptSha256='c'.repeat(64)]){
    const mutated=structuredClone(fixture);change(mutated);mutated.manifestSha256=evidenceDigest(mutated.manifest);
    assert.throws(()=>acceptedPresentationCases(mutated,version));
  }
  for(const change of [m=>m.semanticReview=false,m=>m.manifest.semanticReview=false,m=>m.releaseCertificationEligible=false,m=>m.manifest.sourceDigests['report-ai-review.js']='changed',m=>m.cases[0].review.status='rejected',m=>m.cases[0].review.verdict='reject',m=>m.cases[0].review.findings=[{code:'uncertain',paths:['/summary']}],m=>m.cases[0].review.draftHash='a'.repeat(64),m=>m.cases[0].review.snapshotId='b'.repeat(64),m=>m.cases[0].review.metadata.stopReason='max_tokens']){
    const mutated=structuredClone(fixture);change(mutated);assert.throws(()=>acceptedPresentationCases(mutated,version));
  }
  const historical=structuredClone(fixture);delete historical.manifest;delete historical.semanticReview;delete historical.cases[0].review;
  for(const change of [m=>m.manifest.schemaVersion='synthetic-report-ai-evaluation-3',m=>m.manifest.compositionVersion='old',m=>m.manifest.quantityVersion='old',m=>m.manifest.quantityProsePolicyVersion='old',m=>m.manifest.draftHashMeaning='wire',m=>m.manifest.cases[0].catalogSha256='a'.repeat(64),m=>m.manifest.sourceDigests['report-ai-composition.js']='a'.repeat(64),m=>m.manifest.sourceDigests['report-ai-evidence-encoding.js']='a'.repeat(64),m=>m.cases[0].wireHash='a'.repeat(64),m=>m.cases[0].draftHash=m.cases[0].wireHash,m=>m.cases[0].review.draftHash=m.cases[0].wireHash,m=>m.cases[0].composition.catalogHash='a'.repeat(64),m=>m.cases[0].syntheticOriginalInterpretation.observations[1].text='{{Q1}} conflicting answers',m=>m.cases[0].syntheticDraftInterpretation.summary='changed',m=>m.cases[0].review.promptSha256='a'.repeat(64)]){
    const mutated=structuredClone(fixture);change(mutated);mutated.manifestSha256=evidenceDigest(mutated.manifest);
    assert.throws(()=>acceptedPresentationCases(mutated,version));
  }
  historical.cases[0].contractInterpretation={...structuredClone(interpretation),observations:[structuredClone(interpretation.observations[0])]};
  historical.cases[0].interpretation=walk(historical.cases[0].contractInterpretation,packet);
  assert.throws(()=>acceptedPresentationCases(historical,version));
  assert.equal(acceptedPresentationCases(historical,version,currentContract,{allowHistoricalDrafts:true}).length,1,'explicitly selected historical artifacts remain available for display-only review');
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
  const stat=fs.statSync(inputPath);assert.ok(stat.isFile()&&stat.size<=64*1024*1024,'invalid_input_file');
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
  const cases=acceptedPresentationCases(matrix,promptVersion,contract,{allowHistoricalDrafts:Boolean(historicalModule)});
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
