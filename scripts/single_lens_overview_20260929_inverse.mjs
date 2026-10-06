// Exact finite presentation changes. Historical evidence and publication
// approvals retain their original bytes; unfamiliar changes are not inverted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const SINGLE_LENS_OVERVIEW_BASELINE='61de1fbb0737a5b2af8cb4059bddae81226f95a2';
export const SINGLE_LENS_OVERVIEW_VERSION='diagnostic-renderer-single-lens-overview-20260929.1';
export const SINGLE_LENS_OVERVIEW_FIXTURE_SHA256='a5fa167424c75821a6e022282b31b0e0c23914a41c52d9adcf9955c3a6ccffde';
const bytes=fs.readFileSync(new URL('./fixtures/single-lens-overview-20260929.json',import.meta.url));
assert.equal(sha(bytes),SINGLE_LENS_OVERVIEW_FIXTURE_SHA256,'Exact single-lens presentation fixture');
export const singleLensOverviewDelta=JSON.parse(bytes);
assert.equal(singleLensOverviewDelta.baseline,SINGLE_LENS_OVERVIEW_BASELINE);
assert.equal(singleLensOverviewDelta.version,SINGLE_LENS_OVERVIEW_VERSION);
export const SINGLE_LENS_OVERVIEW_FILES=Object.freeze(Object.keys(singleLensOverviewDelta.files));
export function sourceBeforeSingleLensOverview20260929(file,source){
  const entry=Object.hasOwn(singleLensOverviewDelta.files,file)?singleLensOverviewDelta.files[file]:null;
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': Only the exact reviewed single-lens source can be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite single-lens presentation hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': complete preceding source recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtSingleLensOverviewBaseline(file,source){
  source=sourceAtOutreachResponseBaseline(file,source);
  const entry=Object.hasOwn(singleLensOverviewDelta.files,file)?singleLensOverviewDelta.files[file]:null;
  if(entry&&(sha(source)===entry.after_sha256||file==='monderman-report.js'&&String(source).includes(SINGLE_LENS_OVERVIEW_VERSION)))return sourceBeforeSingleLensOverview20260929(file,source);
  const publication=singleLensOverviewDelta.publication_files?.[file];
  if(publication&&sha(source)===publication.after_sha256){
    const before=execFileSync('git',['show',SINGLE_LENS_OVERVIEW_BASELINE+':'+file],{cwd:fileURLToPath(new URL('../',import.meta.url)),maxBuffer:32e6});
    assert.equal(sha(before),publication.before_sha256,file+': immutable preceding publication bytes');
    return Buffer.isBuffer(source)?before:before.toString();
  }
  return source;
}

// Keep exact outreach identities in the already-copied compatibility module.
// Isolated historical sample tests do not acquire a new runtime dependency.
export const OUTREACH_RESPONSE_BASELINE='2be745c09058756f08e6a1f91cc18dce1f97646e';
export const OUTREACH_RESPONSE_PAGES=Object.freeze({
  'pattern-trial.html':Object.freeze({
    before:'b12786e53ae7b22b13c1e396e2f46bbf899acec45912b51b0c1cc922addef8e2',
    after:'ca09301438e7c1b1ebad1eb9c70d93e51d2a8a80ecfa80ac446574835c02be86'
  }),
  'signin.html':Object.freeze({
    before:'8cf251e2e0534f44bb34fdb4b8b25fd61b82ffead21b5d821e7d076ed9761399',
    after:'a959fefb72f0b03fd6545d54332406d902174d1484e475de79333e47bb003825'
  })
});
export function sourceBeforeOutreachResponse20261005(file,source){
  source=sourceAtEvaluationPoolBaseline(file,source);
  if(!Object.hasOwn(OUTREACH_RESPONSE_PAGES,file))return source;
  const entry=OUTREACH_RESPONSE_PAGES[file];
  assert.equal(sha(source),entry.after,file+': Only the exact reviewed outreach source may be inverted');
  const prior=execFileSync('git',['show',OUTREACH_RESPONSE_BASELINE+':'+file],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),maxBuffer:32e6
  });
  assert.equal(sha(prior),entry.before,file+': Complete preceding page identity retained');
  return Buffer.isBuffer(source)?prior:prior.toString('utf8');
}
export function sourceAtOutreachResponseBaseline(file,source){
  source=sourceAtEvaluationPoolBaseline(file,source);
  const entry=Object.hasOwn(OUTREACH_RESPONSE_PAGES,file)?OUTREACH_RESPONSE_PAGES[file]:null;
  // Unknown changes pass through unchanged to the historical contracts, where
  // the original byte/behavior assertions must still independently reject them.
  return entry&&sha(source)===entry.after?sourceBeforeOutreachResponse20261005(file,source):source;
}

// Finite October 6 admission-flow delta only. The immutable earlier source and
// all historic approvals remain unchanged. Unknown edits cannot be inverted.
export const EVALUATION_POOL_BASELINE='335eb03c9adfe1c4376cfe97921764c181b2052a';
export const EVALUATION_POOL_PAGES=Object.freeze({
  "pattern-trial.html": {
    "before": "ca09301438e7c1b1ebad1eb9c70d93e51d2a8a80ecfa80ac446574835c02be86",
    "after": "6beaa1baafbf5a3ab35416a3fff34b97c6d5dbfcb799a5c324e412f97cec1120",
    "replacements": [
      [
        "\n  <script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0\" integrity=\"sha384-fPWur1rx/DE6YtXP/x0MD6dd90RgnVsz5yX/DIg7CcVAnTBZsENWuIcpvVTM39ti\" crossorigin=\"anonymous\"></script>\n  <script src=\"evaluation-capacity.js?v=20261006.pool1\"></script>\n  <script type=\"module\">\n    // Recipient-bound outreach context; never activates an account or evaluation.\n",
        "\n  <script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0\" integrity=\"sha384-fPWur1rx/DE6YtXP/x0MD6dd90RgnVsz5yX/DIg7CcVAnTBZsENWuIcpvVTM39ti\" crossorigin=\"anonymous\"></script>\n  <script type=\"module\">\n    // Recipient-bound outreach context; never activates an account or evaluation.\n"
      ],
      [
        "    const pilotInvitation = document.getElementById(\"pilotInvitation\"), pilotInvitationTitle = document.getElementById(\"pilotInvitationTitle\"), pilotInvitationHelp = document.getElementById(\"pilotInvitationHelp\");\n    const workspaceBootstrap = document.getElementById(\"workspaceBootstrap\"), workspaceName = document.getElementById(\"workspaceName\");\n    let invitationReady=false, capacityReady=false, sessionReady=false, createWorkspace=false, organizationId=null, currentDocuments=null, activationInProgress=false;\n    function show(text, kind=\"err\"){ msg.textContent=text; msg.className=\"msg \"+kind; }\n    function workspaceIsReady(){ return sessionReady || (createWorkspace && workspaceName.value.trim().length>=2); }\n    function syncStart(){\n      const ready=invitationReady && capacityReady && workspaceIsReady();\n      ack.disabled=!ready || activationInProgress;\n      if(!ready) ack.checked=false;\n",
        "    const pilotInvitation = document.getElementById(\"pilotInvitation\"), pilotInvitationTitle = document.getElementById(\"pilotInvitationTitle\"), pilotInvitationHelp = document.getElementById(\"pilotInvitationHelp\");\n    const workspaceBootstrap = document.getElementById(\"workspaceBootstrap\"), workspaceName = document.getElementById(\"workspaceName\");\n    let invitationReady=false, sessionReady=false, createWorkspace=false, organizationId=null, currentDocuments=null, activationInProgress=false;\n    function show(text, kind=\"err\"){ msg.textContent=text; msg.className=\"msg \"+kind; }\n    function workspaceIsReady(){ return sessionReady || (createWorkspace && workspaceName.value.trim().length>=2); }\n    function syncStart(){\n      const ready=invitationReady && workspaceIsReady();\n      ack.disabled=!ready || activationInProgress;\n      if(!ready) ack.checked=false;\n"
      ],
      [
        "      }\n      denyStart(text,false);\n    }\n    function fullPool(){\n      capacityReady=false;\n      ack.checked=false;\n      syncStart();\n      show(\"The ten-organization evaluation pool is filled. Only Jason Adamson may individually approve an additional organization. Nothing has been activated. \");\n      const requestLink=document.createElement(\"a\");\n      requestLink.href=\"pilot.html?pool=full#apply\";\n      requestLink.textContent=\"Request individual review\";\n      msg.appendChild(requestLink);\n    }\n    async function checkCapacity(token){\n      let capacity;\n      try{ capacity=await window.MondermanEvaluationCapacity.check(token); }\n      catch{ capacityReady=false; throw new Error(\"evaluation_capacity_unavailable\"); }\n      capacityReady=capacity.automaticAdmissionOpen || capacity.existingAdmissionAvailable || capacity.ownerExceptionAvailable;\n      if(!capacityReady){ fullPool(); throw new Error(\"evaluation_pool_full\"); }\n    }\n    function legalDocumentPath(kind, version){\n",
        "      }\n      denyStart(text,false);\n    }\n    function legalDocumentPath(kind, version){\n"
      ],
      [
        "        }\n        if(!invitationReady) throw new Error(\"pattern_pilot_invitation_required\");\n        await checkCapacity(token);\n        // Discover current document versions only. Trial acceptance is checked\n        // for the selected Workspace below, immediately before activation.\n",
        "        }\n        if(!invitationReady) throw new Error(\"pattern_pilot_invitation_required\");\n        // Discover current document versions only. Trial acceptance is checked\n        // for the selected Workspace below, immediately before activation.\n"
      ],
      [
        "        }\n      }catch(e){\n        if(e?.message!==\"pattern_pilot_invitation_required\" && e?.message!==\"evaluation_pool_full\") unavailableStart(e?.message===\"evaluation_capacity_unavailable\"\n          ? \"Evaluation availability is temporarily unavailable. Please refresh and try again. Nothing has been activated.\"\n          : e?.message===\"legal_documents_unavailable\"\n          ? \"We couldn’t load the current terms. Please refresh and try again.\"\n          : \"We couldn’t verify this Workspace’s trial eligibility. Please refresh and try again.\");\n",
        "        }\n      }catch(e){\n        if(e?.message!==\"pattern_pilot_invitation_required\") unavailableStart(e?.message===\"legal_documents_unavailable\"\n          ? \"We couldn’t load the current terms. Please refresh and try again.\"\n          : \"We couldn’t verify this Workspace’s trial eligibility. Please refresh and try again.\");\n"
      ],
      [
        "    btn.addEventListener(\"click\", async()=>{\n      if(activationInProgress || !invitationReady || !workspaceIsReady() || !ack.checked) return;\n      if(!capacityReady) return;\n      activationInProgress=true; syncStart();\n      btn.textContent=\"Starting your evaluation…\"; msg.className=\"msg\";\n",
        "    btn.addEventListener(\"click\", async()=>{\n      if(activationInProgress || !invitationReady || !workspaceIsReady() || !ack.checked) return;\n      activationInProgress=true; syncStart();\n      btn.textContent=\"Starting your evaluation…\"; msg.className=\"msg\";\n"
      ],
      [
        "        if(!outreachEmailMatches(outreachContext,s?.session)) throw new Error(\"outreach_email_mismatch\");\n        const token = s?.session?.access_token || \"\";\n        if(!token) throw new Error(\"outreach_email_mismatch\");\n        // Recheck before creating a Workspace. The subsequent server claim\n        // still decides admission atomically if another organization takes the\n        // final place after this read.\n        await checkCapacity(token);\n        if(createWorkspace && !organizationId){\n          const name=workspaceName.value.trim().replace(/\\s+/g,\" \").slice(0,160);\n",
        "        if(!outreachEmailMatches(outreachContext,s?.session)) throw new Error(\"outreach_email_mismatch\");\n        const token = s?.session?.access_token || \"\";\n        if(createWorkspace && !organizationId){\n          const name=workspaceName.value.trim().replace(/\\s+/g,\" \").slice(0,160);\n"
      ],
      [
        "        const out = await res.json().catch(()=>({}));\n        if(res.ok && out.ok){ clearOutreachInvitation(); show(\"Pattern is active. Opening your Workspace…\",\"ok\"); setTimeout(()=>location.href=\"workspace.html\",700); return; }\n        if(res.status===409 && out.error===\"evaluation_pool_full\"){ fullPool(); throw new Error(\"evaluation_pool_full\"); }\n        const messages={\n          pattern_trial_already_used:\"This account identity has already used its free evaluation.\",\n",
        "        const out = await res.json().catch(()=>({}));\n        if(res.ok && out.ok){ clearOutreachInvitation(); show(\"Pattern is active. Opening your Workspace…\",\"ok\"); setTimeout(()=>location.href=\"workspace.html\",700); return; }\n        const messages={\n          pattern_trial_already_used:\"This account identity has already used its free evaluation.\",\n"
      ],
      [
        "        show(messages[out.error] || \"The free evaluation could not be started. Nothing was charged.\");\n      }catch(e){\n        if(e?.message!==\"evaluation_pool_full\") show(e?.message===\"evaluation_capacity_unavailable\"\n          ? \"Evaluation availability is temporarily unavailable. Please refresh and try again. Nothing has been activated.\"\n          : e?.message===\"outreach_email_mismatch\"\n          ? \"Your sign-in changed. Refresh and sign in with the invited email. Nothing has been activated.\"\n          : e?.message===\"legal_documents_changed\"\n",
        "        show(messages[out.error] || \"The free evaluation could not be started. Nothing was charged.\");\n      }catch(e){\n        show(e?.message===\"outreach_email_mismatch\"\n          ? \"Your sign-in changed. Refresh and sign in with the invited email. Nothing has been activated.\"\n          : e?.message===\"legal_documents_changed\"\n"
      ]
    ]
  },
  "pilot.html": {
    "before": "646d60a00cea3cd10a95e74e0a4c56ba79e601cb4116f3eae7198a5835e60096",
    "after": "abc212f3605a78799ce020fd65d8c3740d16e07277189a843c7b832f80dcd9e9",
    "replacements": [
      [
        "    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />\n    <meta name=\"referrer\" content=\"no-referrer\" />\n    <title>Request an invitation | Monderman</title>\n    <meta name=\"description\" content=\"Request an invitation to evaluate Monderman free for 60 days. All four diagnostics, campaigns and eligible Synthesis. No credit card or automatic renewal.\" />\n",
        "    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />\n    <title>Request an invitation | Monderman</title>\n    <meta name=\"description\" content=\"Request an invitation to evaluate Monderman free for 60 days. All four diagnostics, campaigns and eligible Synthesis. No credit card or automatic renewal.\" />\n"
      ],
      [
        "      <section class=\"hero\">\n        <div class=\"wrap\">\n          <p class=\"pilot-status\" id=\"pilotPoolStatus\" role=\"status\" aria-live=\"polite\">Checking evaluation availability&hellip;</p>\n          <p class=\"eyebrow\">60-day free evaluation</p>\n          <h1 id=\"pilotPoolTitle\">Evaluate how your organization works.</h1>\n          <p class=\"dek\">Evaluate Monderman with your organization for 60 days, starting when you activate your invitation. Use all four diagnostics, gather different perspectives and examine practical opportunities to improve. No credit card. No automatic renewal.</p>\n          <p class=\"dek\" id=\"pilotPoolMessage\">The evaluation pool admits ten organizations. Additional organizations require Jason Adamson's individual approval. Submitting a request does not grant access.</p>\n          <div class=\"actions\">\n            <a class=\"btn primary pilot-primary\" href=\"#apply\">Request an invitation</a>\n            <a class=\"btn secondary\" href=\"pattern-trial.html\">Already reserved or individually approved? Sign in</a>\n          </div>\n        </div>\n",
        "      <section class=\"hero\">\n        <div class=\"wrap\">\n          <p class=\"pilot-status\">Available by invitation &middot; Requests welcome</p>\n          <p class=\"eyebrow\">60-day free evaluation</p>\n          <h1>Evaluate how your organization works.</h1>\n          <p class=\"dek\">Evaluate Monderman with your organization for 60 days, starting when you activate your invitation. Use all four diagnostics, gather different perspectives and examine practical opportunities to improve. No credit card. No automatic renewal.</p>\n          <div class=\"actions\">\n            <a class=\"btn primary pilot-primary\" href=\"#apply\">Request an invitation</a>\n            <a class=\"btn secondary\" href=\"pattern-trial.html\">Activate your invitation</a>\n          </div>\n        </div>\n"
      ],
      [
        "            <h2>Tell us what you want to examine.</h2>\n            <p>Anyone can request an invitation. You can begin with whichever diagnostic fits your organizational question; no prior run is required.</p>\n            <p>Monderman reviews each request and sends invitations directly. Once the ten-organization pool is filled, only Jason Adamson may approve each particular additional organization. An invitation is required to activate access. Sending this form does not grant access, create an account or start your 60 days.</p>\n          </div>\n          <div>\n",
        "            <h2>Tell us what you want to examine.</h2>\n            <p>Anyone can request an invitation. You can begin with whichever diagnostic fits your organizational question; no prior run is required.</p>\n            <p>Monderman reviews each request and sends invitations directly. An invitation is required to activate access. Sending this form does not create an account or start your 60 days.</p>\n          </div>\n          <div>\n"
      ],
      [
        "            <section class=\"pilot-confirmation\" id=\"pilotConfirmation\" hidden tabindex=\"-1\">\n              <h2>Your invitation request has been received.</h2>\n              <p>A receipt is being sent to your work email. Monderman will review your requested scope and follow up about an invitation. This request does not grant access. Any admission beyond the ten-organization pool requires Jason Adamson's individual approval. Your evaluation starts only when you activate access. No Workspace has been created and nothing has been charged.</p>\n            </section>\n          </div>\n",
        "            <section class=\"pilot-confirmation\" id=\"pilotConfirmation\" hidden tabindex=\"-1\">\n              <h2>Your invitation request has been received.</h2>\n              <p>A receipt is being sent to your work email. Monderman will review your requested scope and follow up about an invitation. Your evaluation starts only when you activate access. No Workspace has been created and nothing has been charged.</p>\n            </section>\n          </div>\n"
      ],
      [
        "    </footer>\n    <script src=\"first-run-telemetry.js\" defer></script>\n    <script src=\"evaluation-capacity.js?v=20261006.pool1\" defer></script>\n    <script src=\"pilot-pool.js?v=20261006.pool1\" defer></script>\n    <script src=\"pilot-waitlist.js\" defer></script>\n    <script src=\"assistant.js?v=20260828-footer-dock4\" defer></script>\n",
        "    </footer>\n    <script src=\"first-run-telemetry.js\" defer></script>\n    <script src=\"pilot-waitlist.js\" defer></script>\n    <script src=\"assistant.js?v=20260828-footer-dock4\" defer></script>\n"
      ]
    ]
  },
  "pilot-waitlist.js": {
    "before": "8194b494784df0c0f453ee4b81e6da8b5ad755f24fe235bc1e17a67304226e91",
    "after": "69c5c4ba58016e1333a8d9b89b574ef2e368a2efdc5bebb05a7927d46bd82a8d",
    "replacements": [
      [
        "  var pendingSubmission = null;\n  var submitting = false;\n  var submitted = false;\n\n  function requestId() {\n",
        "  var pendingSubmission = null;\n  var submitting = false;\n\n  function requestId() {\n"
      ],
      [
        "      event.preventDefault();\n      if (submitting) return;\n      if (submitted || !form.reportValidity()) return;\n      submitting = true;\n      status.textContent = \"\";\n",
        "      event.preventDefault();\n      if (submitting) return;\n      submitting = true;\n      status.textContent = \"\";\n"
      ],
      [
        "      try {\n        await submit(form);\n        submitted = true;\n        pendingSubmission = null;\n        form.hidden = true;\n",
        "      try {\n        await submit(form);\n        pendingSubmission = null;\n        form.hidden = true;\n"
      ]
    ]
  },
  "scripts/inject-public-shell.mjs": {
    "before": "2e9b4a3a701a6ee03d49ef126f0ec3d66b930e4c653da10ca44bf2ece042b9e1",
    "after": "2f983e48d497197dd2add45a97cc0d2e8e5dcba979d478dcfe801bf693a2e47a",
    "replacements": [
      [
        "// Refresh changed runtime assets without invalidating unchanged brand assets.\nconst assetReleases = Object.freeze({\n  \"evaluation-capacity.js\": \"20261006.pool1\",\n  \"pilot-pool.js\": \"20261006.pool1\",\n  \"pilot-waitlist.js\": \"20261006.pool1\",\n  \"monderman-report.js\": \"20260929.singlelens1\",\n  \"sample-report-tile.css\": \"20260924.gold1\",\n",
        "// Refresh changed runtime assets without invalidating unchanged brand assets.\nconst assetReleases = Object.freeze({\n  \"monderman-report.js\": \"20260929.singlelens1\",\n  \"sample-report-tile.css\": \"20260924.gold1\",\n"
      ],
      [
        "]);\nconst refreshedAssets = [\n  \"evaluation-capacity.js\", \"pilot-pool.js\",\n  \"monderman-report.js\", \"sample-report-production.js\", \"public-sample-model.js\", \"workspace-theme.js\", \"sample-report-production.css\",\n  \"homepage-hero-system.css\", \"homepage-workspace-demo.css\", \"homepage-workspace-demo.js\", \"workspace-access-gate.js\", \"workspace-evaluation.js\", \"feedback-widget.js\",\n",
        "]);\nconst refreshedAssets = [\n  \"monderman-report.js\", \"sample-report-production.js\", \"public-sample-model.js\", \"workspace-theme.js\", \"sample-report-production.css\",\n  \"homepage-hero-system.css\", \"homepage-workspace-demo.css\", \"homepage-workspace-demo.js\", \"workspace-access-gate.js\", \"workspace-evaluation.js\", \"feedback-widget.js\",\n"
      ]
    ]
  },
  "scripts/runtime_asset_release_build_smoke.mjs": {
    "before": "e903d5a1ad42c4e1b4b16d37de0cef3bf029b593e2aacbeb9e855b5182184dc0",
    "after": "3d132d5493c6e112a2d7418c2d1add54309a323d4c8a1498dc9a4bd83f4fd4b8",
    "replacements": [
      [
        "const consistencyAssets=['canonical-site-shell.js','workspace-assistant.js','public-product-design.css','workspace-product-design.css','report-screen-experience.css','diagnostic-intake.css','visual-polish.css','sample-report-production.css'];\nconst footerSupportAssets=['canonical-site-shell.js','canonical-site-shell.css','connect-widget.js','assistant.js'];\nconst evaluationAssets=['homepage-workspace-demo.css','homepage-workspace-demo.js','workspace-access-gate.js','workspace-evaluation.js','feedback-widget.js','first-run-telemetry.js','pilot-waitlist.js','evaluation-capacity.js','pilot-pool.js'];\nconst salaryAssets=['assignment-mode.js','assignment-draft.js','employer-salary-import.js','employer-salary-settings.js'];\nconst changed=[...new Set([...annualAssets,...consistencyAssets,...footerSupportAssets,...evaluationAssets,...salaryAssets,'sample-report-tile.css','pilot-waitlist.css','monderman-depth-lure-tile.css','campaign-analysis.js','campaign-analysis.css','workspace-synthesis-readiness.js','workspace-synthesis-readiness.css'])];\nconst priorRuntimeRelease=asset=>['campaign-analysis.js','campaign-analysis.css','monderman-report.js','monderman-depth-lure-tile.css'].includes(asset)?'20260919.benefits1':['workspace-synthesis-readiness.js','workspace-synthesis-readiness.css'].includes(asset)?'20260919.ready1':['homepage-workspace-demo.js','homepage-workspace-demo.css'].includes(asset)?'20260919.journey3':['workspace-access-gate.js','workspace-evaluation.js','feedback-widget.js','assistant.js'].includes(asset)?'20260919.invited1':evaluationAssets.includes(asset)?'20260919.invitation1':asset==='connect-widget.js'?'20260917.widget-visible1':asset==='canonical-site-shell.css'?'20260916.widget-anchor1':footerSupportAssets.includes(asset)?'20260916.floating-support1':consistencyAssets.includes(asset)?'20260915.consistency1':annualAssets.includes(asset)?'20260915.annual1':'20260913.34';\nconst runtimeRelease=asset=>({'evaluation-capacity.js':'20261006.pool1','pilot-pool.js':'20261006.pool1','pilot-waitlist.js':'20261006.pool1','sample-report-production.js':'20260924.comparisons1','public-sample-model.js':'20260924.projection8','monderman-report.js':'20260929.singlelens1','report-screen-experience.css':'20260921.gold1','monderman-depth-lure-tile.css':'20260925.deepteal1','homepage-workspace-demo.js':'20260924.compact1','homepage-workspace-demo.css':'20260927-report-first-v1','sample-report-tile.css':'20260924.gold1','pilot-waitlist.css':'20260924.gold1','canonical-site-shell.css':'20260924.gold1','public-product-design.css':'20260924.gold1','campaign-analysis.js':'20260923.salary1','assignment-mode.js':'20260923.salary1','assignment-draft.js':'20260923.salary1','employer-salary-import.js':'20260923.1','employer-salary-settings.js':'20260923.2'}[asset])||priorRuntimeRelease(asset);\neq(read('monderman-report.js').toString().match(/const RENDERER_VERSION = \"([^\"]+)\"/)?.[1],'diagnostic-renderer-single-lens-overview-20260929.1','Current renderer edition has a matching build cache identity');\nfor(const asset of changed){\n",
        "const consistencyAssets=['canonical-site-shell.js','workspace-assistant.js','public-product-design.css','workspace-product-design.css','report-screen-experience.css','diagnostic-intake.css','visual-polish.css','sample-report-production.css'];\nconst footerSupportAssets=['canonical-site-shell.js','canonical-site-shell.css','connect-widget.js','assistant.js'];\nconst evaluationAssets=['homepage-workspace-demo.css','homepage-workspace-demo.js','workspace-access-gate.js','workspace-evaluation.js','feedback-widget.js','first-run-telemetry.js','pilot-waitlist.js'];\nconst salaryAssets=['assignment-mode.js','assignment-draft.js','employer-salary-import.js','employer-salary-settings.js'];\nconst changed=[...new Set([...annualAssets,...consistencyAssets,...footerSupportAssets,...evaluationAssets,...salaryAssets,'sample-report-tile.css','pilot-waitlist.css','monderman-depth-lure-tile.css','campaign-analysis.js','campaign-analysis.css','workspace-synthesis-readiness.js','workspace-synthesis-readiness.css'])];\nconst priorRuntimeRelease=asset=>['campaign-analysis.js','campaign-analysis.css','monderman-report.js','monderman-depth-lure-tile.css'].includes(asset)?'20260919.benefits1':['workspace-synthesis-readiness.js','workspace-synthesis-readiness.css'].includes(asset)?'20260919.ready1':['homepage-workspace-demo.js','homepage-workspace-demo.css'].includes(asset)?'20260919.journey3':['workspace-access-gate.js','workspace-evaluation.js','feedback-widget.js','assistant.js'].includes(asset)?'20260919.invited1':evaluationAssets.includes(asset)?'20260919.invitation1':asset==='connect-widget.js'?'20260917.widget-visible1':asset==='canonical-site-shell.css'?'20260916.widget-anchor1':footerSupportAssets.includes(asset)?'20260916.floating-support1':consistencyAssets.includes(asset)?'20260915.consistency1':annualAssets.includes(asset)?'20260915.annual1':'20260913.34';\nconst runtimeRelease=asset=>({'sample-report-production.js':'20260924.comparisons1','public-sample-model.js':'20260924.projection8','monderman-report.js':'20260929.singlelens1','report-screen-experience.css':'20260921.gold1','monderman-depth-lure-tile.css':'20260925.deepteal1','homepage-workspace-demo.js':'20260924.compact1','homepage-workspace-demo.css':'20260927-report-first-v1','sample-report-tile.css':'20260924.gold1','pilot-waitlist.css':'20260924.gold1','canonical-site-shell.css':'20260924.gold1','public-product-design.css':'20260924.gold1','campaign-analysis.js':'20260923.salary1','assignment-mode.js':'20260923.salary1','assignment-draft.js':'20260923.salary1','employer-salary-import.js':'20260923.1','employer-salary-settings.js':'20260923.2'}[asset])||priorRuntimeRelease(asset);\neq(read('monderman-report.js').toString().match(/const RENDERER_VERSION = \"([^\"]+)\"/)?.[1],'diagnostic-renderer-single-lens-overview-20260929.1','Current renderer edition has a matching build cache identity');\nfor(const asset of changed){\n"
      ]
    ]
  }
});
export function sourceBeforeEvaluationPool20261006(file,source){
  const entry=Object.hasOwn(EVALUATION_POOL_PAGES,file)?EVALUATION_POOL_PAGES[file]:null;
  if(!entry)return source;
  assert.equal(sha(source),entry.after,file+': Only the exact reviewed evaluation-pool source may be inverted');
  let restored=String(source);
  for(const [current,prior]of entry.replacements){
    assert.equal(restored.split(current).length,2,file+': exactly one finite admission-flow hunk');
    restored=restored.replace(current,()=>prior);
  }
  assert.equal(sha(restored),entry.before,file+': complete preceding admission source recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtEvaluationPoolBaseline(file,source){
  const entry=Object.hasOwn(EVALUATION_POOL_PAGES,file)?EVALUATION_POOL_PAGES[file]:null;
  return entry&&sha(source)===entry.after?sourceBeforeEvaluationPool20261006(file,source):source;
}
