// September 19 release guard, not an assertion that all behavior was unchanged.
// The explicitly approved invitation/access/countdown and public journey
// changes are pinned below.
// Existing scoring, evidence, sample-source and unmodified interface bytes stay
// anchored to the last deployed pre-evaluation commit. Behavioral tests cover
// the new access gate and server-clock countdown separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sourceBeforeSankeyPresentation} from './report_sankey_presentation_inverse.mjs';
import {assertThreeBenefitSourceContract} from './three_benefit_source_contract.mjs';
import {sourceBeforeOverviewSiteCompatibility} from './report_overview_site_compatibility_inverse.mjs';
export const EVALUATION_BASELINE='0fb1980b4f7dca37c6823e3ae47386215b2834d9';
export const APPROVED_INTERFACE_PINS=Object.freeze({
  // DV: close the public-first-run flag and update legacy invitation/result copy.
  // Authenticated refresh uses the unchanged existing self-draft runtime.
  'decision-velocity.html':'aad59fa601a33fb7e5f8871624a1c54f1f68dd0763212af4d247a3298439e344',
  // Invitation activation: exact current/historical legal-edition mapping only.
  'pattern-trial.html':'57503e661a3b67940d594f8bd32426981714e7a7178ec91f42cfed550d3b5cf2',
  // Sign-in: invitation copy/error and exact new legal-version allowlist.
  'signin.html':'f0240d14bb0b707d64fa2d5f422fb6c82f7d82e91ed0a4774b2f30dd9832bd63',
  // Reviewed follow-up: remove beta badges; add read-only, user-directed
  // readiness invitations on Overview and Analyze. No automatic generation.
  'workspace.html':'64628f301fa20d9e16d6ba6ef1bedd0efeafbe3470a1c8a64d6f71e62afae08c',
  'workspace-diagnostics.html':'64ba5ddd08cad7426257c4e84451aae98e7fad4c6e79d61b67031b1bbcb22728',
  'workspace-actions.html':'ff4e542a270d0949333de6f04dc340ab588dcc1c8b18516cd2ae822795b6a43c',
  'workspace-analysis.html':'d0d2d7ccafdda0f11f6b132c3c99f20a2d858b50c0e972dcf60f3acacaf5b1e6',
  'workspace-settings.html':'bb8e61a3cfd1fe7158baacc0f9133c961de5f1b1da86c7c942ed99c16edabe98',
  // Scoped review deep links and same-organization guard; report submission
  // remains the existing separate explicit button. Dedicated browser tests
  // exercise review-only, stale access, dismissal and manual generation.
  'campaign-analysis.js':'ef7854a2c38aa6005c8783356638101ac2b4d346994abf327e219bf2b4aed1ce',
  // Public, local-only four Depth journeys and a separate Cross-Lens journey.
  // Numbers remain generated from reviewed evidence; authored actions are
  // labeled proposals. Dedicated browser tests cover all five journeys.
  'homepage-workspace-demo.js':'d68437e48bcee9e9e20bfd8f6daeb48c61e7b1c6b742aa3d2aef4faa21f920b8',
});
export function assertInvitedEvaluationSourceContract(root=path.resolve(import.meta.dirname,'..')){
  // Historical comparison only: invert the separately reviewed, whole-file-
  // pinned September 23 site changes before applying every original guard.
  const read=f=>sourceBeforeOverviewSiteCompatibility(f,fs.readFileSync(path.join(root,f),'utf8'));
  const prior=f=>execFileSync('git',['show',`${EVALUATION_BASELINE}:${f}`],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
  const sha=value=>createHash('sha256').update(value).digest('hex');
  const teaserCopy=[
    [
      "' + escT((data && data.message) || 'Create a free account to unlock the full report.') + '",
      "Sign in with your invited or existing account to open the full report."
    ],
    [
      ">Create account / sign in</a>",
      ">Sign in</a>"
    ],
    [
      "<a href=\"platform-services.html\" target=\"_blank\" style=\"font-size:13.5px;color:#6E6F73;\">See plans</a>",
      "<a href=\"pilot.html\" target=\"_blank\" style=\"font-size:13.5px;color:#6E6F73;\">Request an invitation</a>"
    ],
    [
      "Your answers are held for this session: unlocking will not repeat the questions, and the run saves to your new workspace.",
      "Your answers are held for this session. Sign in to an active Workspace to save the report without repeating the questions."
    ]
  ];
  for(const file of ['structural-clarity.html','operational-systems.html','institutional-performance.html']){
    let expected=prior(file);
    for(const [before,after]of [...teaserCopy,...[["<h2>You&rsquo;ve used all your free diagnostic runs</h2>","<h2>Check your Workspace access</h2>"],["Your existing results remain available in Workspace. Choose a plan to run another diagnostic, or reach out and we&rsquo;ll help you get set up.","Your existing results remain available in Workspace. An active evaluation or subscription is required to start new work. Contact Monderman for help."]]]){
      assert.equal(expected.split(before).length,2,file+': exact single legacy teaser copy substitution');
      expected=expected.replace(before,()=>after);
    }

    if(file==='structural-clarity.html'){
      const oldMeta="Run the Structural Clarity diagnostic: whether ownership, authority, and roles are clear enough to support execution; deterministic scoring, with three Diagnostic runs and one Synthesis in the standard Trial.",newMeta="Examine whether responsibilities, authority and roles are clear enough to get work done. Available in an invited Monderman Workspace.";
      assert.equal(expected.split(oldMeta).length,3,'SC has exactly two approved metadata substitutions');
      expected=expected.replaceAll(oldMeta,newMeta);
    }
    assert.equal(read(file),expected,file+': approved access copy alone changed; full prior instrument otherwise exact');
  }

  const greetingBefore="Hi. I’m Monderman’s AI site guide. Ask what the diagnostics cover, how to start the free Decision Velocity run, or how the pilot works. I explain the product, not its private implementation. I can make mistakes; check important details with the team.",greetingAfter="Hi. I’m Monderman’s AI site guide. Ask what the diagnostics cover, how to request an invitation, or how the 60-day free evaluation works. I explain the product, not its private implementation. I can make mistakes; check important details with Monderman.";
  assert.equal(prior('assistant.js').split(greetingBefore).length,2,'Exactly one public assistant greeting changed');
  assert.equal(read('assistant.js'),prior('assistant.js').replace(greetingBefore,()=>greetingAfter),'Public assistant only changes the invitation greeting, not behavior or private-IP boundaries');
  const immutable=['accept-invite.html',
    'workspace-theme.js','workspace-assistant.js','public-sample-model.js','sample-report-production.js',
    'run-inclusion-review.js','participant-evidence-safety.js'];
  for(const file of immutable)assert.equal(read(file),prior(file),file+': existing engine/evidence/interface bytes remain exact');
  for(const [file,digest]of Object.entries(APPROVED_INTERFACE_PINS))if(file!=='campaign-analysis.js')assert.equal(sha(read(file)),digest,file+': only the explicitly reviewed interface delta is allowed');
  assertThreeBenefitSourceContract(root);
  // The five-journey selector is one reviewed addition. Removing that exact
  // whole-file-pinned block must recover all prior four-step tab navigation.
  const journeyRuntime=read('homepage-workspace-demo.js');
  const journeyAddition=journeyRuntime.match(/^  const preview = app\.closest\('\.home-workspace-preview'\);\n[\s\S]*?(?=^  function select\(tab, focus = false, reveal = false\) \{)/m);
  assert.ok(journeyAddition,'Reviewed public journey addition must be present');
  const gatherDefault="  select(app.querySelector('#hwd-tab-measure'));\n";
  assert.equal(journeyRuntime.split(gatherDefault).length,2,'Exactly one explicit Gather initialization');
  assert.equal(journeyRuntime.replace(journeyAddition[0],'').replace(gatherDefault,''),prior('homepage-workspace-demo.js'),'All previous tab, keyboard and next-step behavior remains byte-identical outside Gather initialization');
  assert.equal(sha(read('enterprise-site.css')),'c17d87ec75a4247b0cd8608637bbd9e2ad033bdc8f7db73b7f27feb50179c4f1','Only the reviewed primary/secondary CTA and promotional gold accents change shared CSS');
  assert.equal(sha(read('report-screen-experience.css')),'9fdb372c14ed274ca284757207a1ab69a1c1e42dcf45a2d1a95377146d047d6c','Reviewed category-only print color correction; score bands and instrument code are unchanged');
  const executable=html=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!(/\bsrc\s*=/.test(m[1]))&&!(/type=["']application\/ld\+json/.test(m[1]))).map(m=>m[2]);
  for(const file of ['diagnostics.html','connect.html','plan-enterprise.html'])assert.deepEqual(executable(read(file)),executable(prior(file)),file+': marketing changes do not change embedded behavior');
  assert.equal(sourceBeforeSankeyPresentation(read('monderman-report.js')),prior('monderman-report.js'),'Exact Sankey inverse preserves the previous complete report renderer');
  // No unrelated production presentation/runtime files may move with this
  // release. This explicit scope list is never inferred from the current diff.
  // Critical allowed interfaces are separately exact-pinned or inversed above.
  const changedPublicFiles=new Set([
    "Monderman_Platform_Brief.html",
    "about.html",
    "after-a-reorganization.html",
    "after-an-acquisition.html",
    "assistant.js",
    "campaign-analysis.js",
    "campaign-analysis.css",
    "connect.html",
    "decision-velocity-article.html",
    "decision-velocity.html",
    "designing-for-decision-velocity.html",
    "deterministic-ai-infrastructure.html",
    "diagnostics.html",
    "enterprise-site.css",
    "feedback-widget.js",
    "first-run-telemetry.js",
    "homepage-workspace-demo.css",
    "homepage-workspace-demo.js",
    "index.html",
    "institutional-performance-article.html",
    "institutional-performance.html",
    "legal-document-manifest.json",
    "monderman-report.js",
    "monderman-depth-lure-tile.css",
    "new-in-the-role.html",
    "operational-systems-article.html",
    "operational-systems.html",
    "pattern-trial.html",
    "pilot-feedback.html",
    "pilot-waitlist.js",
    "pilot.html",
    "plan-pattern.html",
    "plan-enterprise.html",
    "plan-signal.html",
    "platform-services.html",
    "privacy.html",
    "public-search-index.json",
    "roi.html",
    "report-screen-experience.css",
    "sample-report.html",
    "security.html",
    "signin.html",
    "structural-clarity-article.html",
    "structural-clarity.html",
    "subprocessors.html",
    "terms.html",
    "transformation-behind-schedule.html",
    "why-monderman.html",
    "workspace-access-gate.js",
    "workspace-actions.html",
    "workspace-analysis.html",
    "workspace-diagnostics.html",
    "workspace-settings.html",
    "workspace-shell.js",
    "workspace.html"
  ]);
  const baselineFiles=execFileSync('git',['ls-tree','-r','--name-only',EVALUATION_BASELINE],{cwd:root,encoding:'utf8'}).trim().split('\n');
  const protectedPublicFiles=baselineFiles.filter(file=>!file.includes('/')&&/\.(?:html|css|js|json|woff2?)$/.test(file)&&!changedPublicFiles.has(file));
  for(const file of protectedPublicFiles)assert.equal(sha(sourceBeforeOverviewSiteCompatibility(file,fs.readFileSync(path.join(root,file)))),sha(execFileSync('git',['show',EVALUATION_BASELINE+':'+file],{cwd:root,maxBuffer:16*1024*1024})),file+': unrelated public source bytes unchanged');
  return {protectedPublicFiles:protectedPublicFiles.length,baseline:EVALUATION_BASELINE,unchangedFiles:immutable.length,approvedInterfaceFiles:Object.keys(APPROVED_INTERFACE_PINS).length,copyOnlyInstruments:3,unchangedMarketingScripts:3};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))console.log(JSON.stringify({status:'PASS',...assertInvitedEvaluationSourceContract()}));
