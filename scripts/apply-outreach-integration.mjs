import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function edit(path, expectedSha, marker, replacements) {
  let content=readFileSync(path,'utf8');
  if(content.includes(marker)) return;
  const sha=createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
  if(sha!==expectedSha) throw new Error(`Unexpected source revision for ${path}: ${sha}`);
  for(const [before,after] of replacements){
    if(content.split(before).length!==2) throw new Error(`Integration anchor must occur exactly once in ${path}: ${before.slice(0,70)}`);
    content=content.replace(before,after);
  }
  writeFileSync(path,content);
}
const imports="    // Recipient-bound outreach context; never activates an account or evaluation.\n    import { loadOutreachInvitation, clearOutreachInvitation, outreachEmailMatches, outreachSignInUrl, outreachErrorMessage } from './outreach-invitation.js';\n";
edit('pattern-trial.html','9f26a2fc5b068ee88ba4a4a041bc4c4e6ad7a2ef','const outreachContext = await loadOutreachInvitation();',[
  ['  <meta charset="UTF-8" />','  <meta charset="UTF-8" />\n  <meta name="referrer" content="no-referrer" />'],
  ['  <script type="module">\n','  <script type="module">\n'+imports+'    const outreachContext = await loadOutreachInvitation();\n'],
  ['    if(!data?.session){ location.replace("signin.html?next="+encodeURIComponent("pattern-trial.html"+(location.search||""))); }',`    if(outreachContext?.error){
      unavailableStart(outreachErrorMessage(outreachContext));
    }
    else if(!data?.session){ location.replace(outreachSignInUrl("pattern-trial.html"+(location.search||""))); }
    else if(!outreachEmailMatches(outreachContext,data.session)){
      denyStart("You are signed in with a different email address. This invitation is for "+outreachContext.invitation.email+". Nothing has been activated.");
      const switchAccount=document.createElement("button");
      switchAccount.type="button";
      switchAccount.textContent="Sign in with the invited email";
      switchAccount.addEventListener("click",async()=>{
        switchAccount.disabled=true;
        const {error}=await sb.auth.signOut({scope:"local"});
        if(error){switchAccount.disabled=false;show("We could not sign you out. Please try again.");return;}
        location.replace(outreachSignInUrl("pattern-trial.html"+(location.search||"")));
      });
      msg.appendChild(switchAccount);
    }`],
  ['            workspaceBootstrap.hidden=false;','            workspaceBootstrap.hidden=false;\n            if(outreachContext?.invitation) workspaceName.value=outreachContext.invitation.organizationName;'],
  ['        const token = s?.session?.access_token || "";','        if(!outreachEmailMatches(outreachContext,s?.session)) throw new Error("outreach_email_mismatch");\n        const token = s?.session?.access_token || "";'],
  ['        if(res.ok && out.ok){ show("Pattern is active. Opening your Workspace…","ok");','        if(res.ok && out.ok){ clearOutreachInvitation(); show("Pattern is active. Opening your Workspace…","ok");'],
  ['        show(e?.message==="legal_documents_changed"','        show(e?.message==="outreach_email_mismatch"\n          ? "Your sign-in changed. Refresh and sign in with the invited email. Nothing has been activated."\n          : e?.message==="legal_documents_changed"']
]);
edit('signin.html','6b3f9c03b961744cd823be99ea66a2ff7d997de2','const outreachContext = await loadOutreachInvitation({forSignIn:true});',[
  ['  <meta charset="UTF-8" />','  <meta charset="UTF-8" />\n  <meta name="referrer" content="no-referrer" />'],
  ['<script type="module">\n','<script type="module">\n'+imports+'    const outreachContext = await loadOutreachInvitation({forSignIn:true});\n'],
  ['      footnote: document.querySelector(".signin-footnote"),\n    };',`      footnote: document.querySelector(".signin-footnote"),
    };
    if(outreachContext?.invitation){
      ui.emailInput.value=outreachContext.invitation.email;
      ui.heading.textContent="Continue to your 60-day evaluation.";
      ui.sub.textContent="Invitation for "+outreachContext.invitation.recipientName+" at "+outreachContext.invitation.organizationName+". Use "+outreachContext.invitation.email+" to sign in or create your invited account. The evaluation starts only after you confirm activation on the next page.";
    }`],
  ['    let pendingEmail = storedOtpContext?.email || "";','    if(outreachContext?.invitation && storedOtpContext?.email?.toLowerCase()!==outreachContext.invitation.email.toLowerCase()){ storedOtpContext=null; try{sessionStorage.removeItem(OTP_STORAGE_KEY);}catch{} }\n    let pendingEmail = storedOtpContext?.email || "";'],
  ['      if (forwarded || acceptanceCheckStarted || !session?.user) return;\n      acceptanceCheckStarted = true;',`      if (forwarded || acceptanceCheckStarted || !session?.user) return;
      if(outreachContext?.error){
        clearPendingOtp(); revealForm(); lockButtons(true);
        setStatus(outreachErrorMessage(outreachContext),"error"); return;
      }
      if(!outreachEmailMatches(outreachContext,session)){
        clearPendingOtp(); revealForm(); lockButtons(true);
        setStatus("This invitation is for "+outreachContext.invitation.email+". Sign out below and continue with that address. Nothing has been activated.","error");
        ui.invitationRecovery.classList.add("show"); return;
      }
      acceptanceCheckStarted = true;`],
  ['      ui.invitationRecovery.disabled = false;\n      setStatus("Signed out.','      ui.invitationRecovery.disabled = false;\n      lockButtons(false);\n      if(outreachContext?.invitation) ui.emailInput.value=outreachContext.invitation.email;\n      setStatus("Signed out.'],
  ['    // ---- Boot ----\n    checkExistingSession();','    // ---- Boot ----\n    if(outreachContext?.error){ clearPendingOtp(); revealForm(); lockButtons(true); setStatus(outreachErrorMessage(outreachContext),"error"); }\n    else checkExistingSession();']
]);
console.log('Outreach integration applied or already present; existing activation and legal gates retained.');
