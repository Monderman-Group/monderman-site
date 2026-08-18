from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def one(text,old,new,label):
    n=text.count(old)
    if n!=1: raise SystemExit(f"{label}: expected 1 match, found {n}")
    return text.replace(old,new,1)

# Shared helper injected into the shell-style Workspace pages.
PLAN_HELPER='''    function trialDaysLeft(org){
      if(!org || org.plan!=="pattern" || org.subscription_status!=="trialing" || !org.pattern_trial_ends_at) return null;
      const ms=Date.parse(org.pattern_trial_ends_at)-Date.now();
      if(!Number.isFinite(ms)) return null;
      return Math.max(0,Math.ceil(ms/86400000));
    }
    function renderRailPlan(org){
      setText("ws5Plan", PLAN_LABEL[org?.plan]||org?.plan||"Trial");
      const chip=document.querySelector(".ws5-planchip");
      if(!chip) return;
      chip.querySelector("#ws5TrialTag")?.remove();
      const days=trialDaysLeft(org);
      if(days==null) return;
      const a=document.createElement("a");
      a.id="ws5TrialTag";
      a.href="plan-pattern.html";
      a.textContent=` · trial · ${days}d left`;
      a.style.cssText="color:#A9CFD2;text-decoration:none;font-weight:600";
      a.title="Pattern evaluation — choose a paid plan explicitly to continue after the trial";
      chip.appendChild(a);
    }
'''

# ------------------------------------------------------------------
# Trial start page: deliberate confirmation + precise post-trial copy.
# ------------------------------------------------------------------
p=ROOT/'pattern-trial.html'; s=p.read_text(encoding='utf-8')
s=one(s,
'''    .fine{font-size:12.5px;line-height:1.55;color:#8A8B90;text-align:center;margin:15px 0 0}
''',
'''    .fine{font-size:12.5px;line-height:1.55;color:#8A8B90;text-align:center;margin:15px 0 0}
    .confirm{display:flex;gap:10px;align-items:flex-start;margin:18px 0 4px;padding:13px 14px;border:1px solid var(--line);border-radius:10px;background:#FCFBF8;font-size:13px;line-height:1.5;color:#4E5054}.confirm input{margin-top:3px;flex:0 0 auto}
''','trial confirm css')
s=one(s,
'''    <div class="terms"><strong>What happens on day 30:</strong> the Pattern trial ends automatically. If you have not explicitly chosen a paid subscription, nothing is charged and your Workspace returns to the standard Trial level. Your saved work remains in your Workspace.</div>
    <button id="startBtn" disabled>Start my 30-day Pattern trial</button>
''',
'''    <div class="terms"><strong>What happens on day 30:</strong> the Pattern trial ends automatically. If you have not explicitly chosen a paid subscription, nothing is charged and your Workspace returns to the standard Trial level. Your saved work is retained. Standard Trial access limits apply after day 30; choosing a paid plan restores the applicable Pattern access.</div>
    <label class="confirm"><input type="checkbox" id="ackStart"><span>I understand this one-time 30-day evaluation starts immediately for this Workspace when I continue.</span></label>
    <button id="startBtn" disabled>Start my 30-day Pattern trial</button>
''','trial confirm html')
s=one(s,
'''    const btn = document.getElementById("startBtn"), msg = document.getElementById("msg");
    function show(text, kind="err"){ msg.textContent=text; msg.className="msg "+kind; }
    const { data } = await sb.auth.getSession();
    if(!data?.session){ location.replace("signin.html?next="+encodeURIComponent("pattern-trial.html")); }
    else { btn.disabled=false; }
''',
'''    const btn = document.getElementById("startBtn"), msg = document.getElementById("msg"), ack = document.getElementById("ackStart");
    let sessionReady=false;
    function show(text, kind="err"){ msg.textContent=text; msg.className="msg "+kind; }
    function syncStart(){ btn.disabled=!(sessionReady && ack.checked); }
    const { data } = await sb.auth.getSession();
    if(!data?.session){ location.replace("signin.html?next="+encodeURIComponent("pattern-trial.html")); }
    else { sessionReady=true; syncStart(); }
    ack.addEventListener("change",syncStart);
''','trial confirm script')
s=one(s,
'''      btn.disabled=false; btn.textContent="Start my 30-day Pattern trial";
''',
'''      btn.textContent="Start my 30-day Pattern trial"; syncStart();
''','trial button restore')
p.write_text(s,encoding='utf-8')

# ------------------------------------------------------------------
# Overview: countdown + explicit paid choice instead of billing portal.
# ------------------------------------------------------------------
p=ROOT/'workspace.html'; s=p.read_text(encoding='utf-8')
s=one(s,
'''organizations(id, name, slug, plan, run_limit, runs_used, seat_limit, features, analyst_reviews_included, hands_on_advisory, plan_period, allowed_tool_type, analyst_limit, admin_limit, campaigns_enabled, respondent_pool, respondents_used, aggregation_enabled, aggregation_limit, aggregations_used, anonymous_responses_enabled)''',
'''organizations(id, name, slug, plan, run_limit, runs_used, seat_limit, features, analyst_reviews_included, hands_on_advisory, plan_period, allowed_tool_type, analyst_limit, admin_limit, campaigns_enabled, respondent_pool, respondents_used, aggregation_enabled, aggregation_limit, aggregations_used, anonymous_responses_enabled, subscription_status, pattern_trial_used_at, pattern_trial_ends_at)''','overview org fields')
old='''    function renderEntitlements(){
      const org=state.organization||{},plan=org.plan||"trial";
      const responseAllowance=org.respondent_pool==null?"Unlimited participant responses":`${Number(org.respondents_used)||0} of ${Number(org.respondent_pool)||0} participant responses used`;
      const synthAllowance=org.aggregation_limit==null?"Unlimited Syntheses":`${Number(org.aggregations_used)||0} of ${Number(org.aggregation_limit)||0} Syntheses used`;
      const users=[]; if(org.analyst_limit!=null)users.push(`${org.analyst_limit} analyst${Number(org.analyst_limit)===1?"":"s"}`); if(org.admin_limit!=null)users.push(`${org.admin_limit} admin${Number(org.admin_limit)===1?"":"s"}`);
      $("wsPlanStrip").innerHTML=`<span><b>${escapeHtml(PLAN_LABEL[plan]||plan)}</b> plan</span><span class="sep">·</span><span>No per-participant pricing</span><span class="sep">·</span><span>${escapeHtml(responseAllowance)}</span><span class="sep">·</span><span>${escapeHtml(synthAllowance)}</span>${users.length?`<span class="sep">·</span><span>${escapeHtml(users.join(" + "))}</span>`:""}`;
      const manage=$("wsManageLink"),isTrial=plan==="trial"||plan==="free"; manage.textContent=isTrial?"Upgrade →":"Manage plan →"; manage.href=isTrial?"platform-services.html":"#billing";
      if(!isTrial&&!manage.dataset.billingWired){ manage.dataset.billingWired="1"; manage.addEventListener("click",async(e)=>{e.preventDefault();const prior=manage.textContent;manage.textContent="Opening billing…";try{const{data}=await supabase.auth.getSession();const res=await fetch("https://monderman-api.onrender.com/api/billing/portal-session",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+(data?.session?.access_token||"")}});const out=await res.json().catch(()=>({}));if(res.ok&&out.url){location.href=out.url;return;}manage.textContent=prior;wsNotice(res.status===403?"Only a workspace admin can manage billing.":res.status===404?"No self-serve billing account yet. Invoiced plans are managed via Connect.":"Billing portal is unavailable right now. Try again shortly.");}catch(_e){manage.textContent=prior;wsNotice("Billing portal could not be reached. Try again shortly.");}}); }
    }
'''
new='''    function renderEntitlements(){
      const org=state.organization||{},plan=org.plan||"trial";
      const trialing=plan==="pattern"&&org.subscription_status==="trialing"&&org.pattern_trial_ends_at;
      const trialDays=trialing?Math.max(0,Math.ceil((Date.parse(org.pattern_trial_ends_at)-Date.now())/86400000)):null;
      const responseAllowance=org.respondent_pool==null?"Unlimited participant responses":`${Number(org.respondents_used)||0} of ${Number(org.respondent_pool)||0} participant responses used`;
      const synthAllowance=org.aggregation_limit==null?"Unlimited Syntheses":`${Number(org.aggregations_used)||0} of ${Number(org.aggregation_limit)||0} Syntheses used`;
      const users=[]; if(org.analyst_limit!=null)users.push(`${org.analyst_limit} analyst${Number(org.analyst_limit)===1?"":"s"}`); if(org.admin_limit!=null)users.push(`${org.admin_limit} admin${Number(org.admin_limit)===1?"":"s"}`);
      const planCopy=trialing?`Pattern trial · ${trialDays} day${trialDays===1?"":"s"} left`:`${PLAN_LABEL[plan]||plan} plan`;
      $("wsPlanStrip").innerHTML=`<span><b>${escapeHtml(planCopy)}</b></span><span class="sep">·</span><span>No per-participant pricing</span><span class="sep">·</span><span>${escapeHtml(responseAllowance)}</span><span class="sep">·</span><span>${escapeHtml(synthAllowance)}</span>${users.length?`<span class="sep">·</span><span>${escapeHtml(users.join(" + "))}</span>`:""}`;
      const manage=$("wsManageLink"),isTrial=plan==="trial"||plan==="free";
      if(trialing){ manage.textContent="Choose paid plan →"; manage.href="plan-pattern.html"; return; }
      manage.textContent=isTrial?"Upgrade →":"Manage plan →"; manage.href=isTrial?"platform-services.html":"#billing";
      if(!isTrial&&!manage.dataset.billingWired){ manage.dataset.billingWired="1"; manage.addEventListener("click",async(e)=>{e.preventDefault();const prior=manage.textContent;manage.textContent="Opening billing…";try{const{data}=await supabase.auth.getSession();const res=await fetch("https://monderman-api.onrender.com/api/billing/portal-session",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+(data?.session?.access_token||"")}});const out=await res.json().catch(()=>({}));if(res.ok&&out.url){location.href=out.url;return;}manage.textContent=prior;wsNotice(res.status===403?"Only a workspace admin can manage billing.":res.status===404?"No self-serve billing account yet. Invoiced plans are managed via Connect.":"Billing portal is unavailable right now. Try again shortly.");}catch(_e){manage.textContent=prior;wsNotice("Billing portal could not be reached. Try again shortly.");}}); }
    }
'''
s=one(s,old,new,'overview trial entitlements')
p.write_text(s,encoding='utf-8')

# ------------------------------------------------------------------
# Action Plans and Analysis rail chips.
# ------------------------------------------------------------------
for filename, query_old, query_new in [
 ('workspace-actions.html','organizations(name, plan)','organizations(name, plan, subscription_status, pattern_trial_ends_at)'),
 ('workspace-analysis.html','organizations(name, plan)','organizations(name, plan, subscription_status, pattern_trial_ends_at)'),
]:
 p=ROOT/filename; s=p.read_text(encoding='utf-8')
 s=one(s,query_old,query_new,filename+' org trial fields')
 anchor='''    function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : (s||""); }
'''
 s=one(s,anchor,anchor+PLAN_HELPER,filename+' rail helper')
 s=one(s,'setText("ws5Plan", PLAN_LABEL[m?.organizations?.plan]||m?.organizations?.plan||"Free");','renderRailPlan(m?.organizations||null);',filename+' rail render')
 p.write_text(s,encoding='utf-8')

# Diagnostics: first module owns shell chrome.
p=ROOT/'workspace-diagnostics.html'; s=p.read_text(encoding='utf-8')
q='organizations(name, plan, anonymous_responses_enabled, campaigns_enabled, respondent_pool, respondents_used)'
s=one(s,q,'organizations(name, plan, anonymous_responses_enabled, campaigns_enabled, respondent_pool, respondents_used, subscription_status, pattern_trial_ends_at)','diagnostics trial fields first query')
anchor='''    function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : (s||""); }
'''
s=one(s,anchor,anchor+PLAN_HELPER,'diagnostics rail helper')
s=one(s,'setText("ws5Plan", PLAN_LABEL[m?.organizations?.plan]||m?.organizations?.plan||"Trial");','renderRailPlan(m?.organizations||null);','diagnostics rail render')
p.write_text(s,encoding='utf-8')

# ------------------------------------------------------------------
# Settings: trial state + real Workspace user roster/seat management.
# ------------------------------------------------------------------
p=ROOT/'workspace-settings.html'; s=p.read_text(encoding='utf-8')
s=one(s,
'''        <!-- PEOPLE -->
        <section class="card">
''',
'''        <!-- WORKSPACE USERS -->
        <section class="card">
          <div class="card-h"><h3>Workspace users</h3><span class="note" id="memberCount"></span></div>
          <p class="card-sub">Admins and analysts use the workspace seats included with your plan. If a plan ends, users above the lower plan's capacity are paused rather than deleted and are restored automatically when capacity returns.</p>
          <div id="membersBody"></div>
          <div id="memberMsg"></div>
        </section>

        <!-- PEOPLE -->
        <section class="card">
''','settings member card')
s=one(s,
'''    const state = { user:null, userId:null, orgId:null, role:"viewer", isOwner:false, org:null, invites:[], people:[] };
''',
'''    const state = { user:null, userId:null, orgId:null, role:"viewer", isOwner:false, org:null, invites:[], members:[], people:[] };
''','settings member state')
anchor='''    function daysLeft(iso){ if(!iso) return null; return Math.ceil((new Date(iso).getTime()-Date.now())/86400000); }
'''
s=one(s,anchor,anchor+PLAN_HELPER,'settings trial helper')
fields='id, name, plan, owner_user_id, respondent_pool, respondents_used, aggregation_limit, aggregations_used, analyst_limit, admin_limit'
s=s.replace(fields,fields+', subscription_status, pattern_trial_ends_at',2)
s=one(s,'setText("ws5Plan", PLAN_LABEL[org?.plan] || org?.plan || "Free");','renderRailPlan(org);','settings rail plan')
s=one(s,
'''      setText("orgPlan", PLAN_LABEL[state.org?.plan] || state.org?.plan || "Free");
''',
'''      const d=trialDaysLeft(state.org);
      setText("orgPlan", d==null ? (PLAN_LABEL[state.org?.plan] || state.org?.plan || "Free") : `Pattern trial · ${d} day${d===1?"":"s"} left`);
''','settings org plan countdown')
s=one(s,
'''      const pending = state.invites.filter(i=>!i.accepted_at);
''',
'''      const pending = state.invites.filter(i=>!i.accepted_at && (daysLeft(i.expires_at)==null || daysLeft(i.expires_at)>=0));
''','settings pending invite count')
s=one(s,
'''      }catch(e){ flash("inviteMsg","bad","Couldn’t create the invite. ("+(e.message||"error")+")"); }
''',
'''      }catch(e){
        const m=String(e.message||"error");
        flash("inviteMsg","bad",m.includes("seat limit reached")?"That role is at this plan’s seat limit. Pending invites reserve seats too.":("Couldn’t create the invite. ("+m+")"));
      }
''','settings invite capacity message')
people_anchor='''    // ── PEOPLE ──
'''
member_block='''    // ── WORKSPACE USERS ──
    async function loadMembers(){
      if(!isAdmin()){
        $("membersBody").innerHTML=`<div class="empty">Only an organization admin can manage Workspace users.</div>`;
        return;
      }
      try{
        const { data,error }=await supabase.rpc("workspace_member_directory",{p_organization_id:state.orgId});
        if(error) throw error;
        state.members=data||[];
      }catch(e){ state.members=[]; $("membersBody").innerHTML=`<div class="empty">Couldn’t load Workspace users.</div>`; return; }
      renderMembers();
    }
    function renderMembers(){
      setText("memberCount",state.members.length?`${state.members.length} users`:"");
      if(!state.members.length){ $("membersBody").innerHTML=`<div class="empty">No Workspace users found.</div>`; return; }
      $("membersBody").innerHTML=`<div class="lst">`+state.members.map(memberRow).join("")+`</div>`;
      $("membersBody").querySelectorAll("select[data-member-role]").forEach(el=>el.addEventListener("change",()=>updateMemberRole(el.dataset.memberRole,el.value)));
      $("membersBody").querySelectorAll("button[data-member-remove]").forEach(el=>el.addEventListener("click",()=>removeMember(el.dataset.memberRemove)));
    }
    function memberRow(m){
      const suspended=m.billing_suspended_role;
      const current=suspended?`Paused ${ROLE_LABEL[suspended]||cap(suspended)}`:(ROLE_LABEL[m.role]||cap(m.role));
      const badge=m.is_owner?`<span class="badge active">Owner</span>`:suspended?`<span class="badge pending">Paused by plan</span>`:`<span class="badge active">${esc(current)}</span>`;
      const controls=m.is_owner?"":suspended
        ? `<button class="linkbtn danger" data-member-remove="${esc(m.member_id)}">Remove</button>`
        : `<select data-member-role="${esc(m.member_id)}" aria-label="Role for ${esc(m.email||m.full_name||"user")}"><option value="member"${m.role==="member"?" selected":""}>Member</option><option value="analyst"${m.role==="analyst"?" selected":""}>Analyst</option><option value="admin"${m.role==="admin"?" selected":""}>Admin</option></select><button class="linkbtn danger" data-member-remove="${esc(m.member_id)}">Remove</button>`;
      const pause=suspended?`<span>Previously ${esc(ROLE_LABEL[suspended]||suspended)}; access will restore automatically if that seat is available on a future plan.</span>`:"";
      return `<div class="lrow"><div class="main"><b>${esc(m.full_name||m.email||"Workspace user")}</b><span>${esc(m.email||"")}</span>${pause}</div>${badge}<div class="act">${controls}</div></div>`;
    }
    async function updateMemberRole(id,role){
      try{
        const {error}=await supabase.from("organization_members").update({role,billing_suspended_role:null,billing_suspended_at:null}).eq("id",id);
        if(error) throw error;
        await loadMembers(); flash("memberMsg","ok","Workspace role updated.");
      }catch(e){
        const m=String(e.message||"error");
        flash("memberMsg","bad",m.includes("seat limit")?"That role is already at this plan’s seat limit.":("Couldn’t change that Workspace role. ("+m+")"));
        await loadMembers();
      }
    }
    async function removeMember(id){
      try{
        const {error}=await supabase.from("organization_members").delete().eq("id",id);
        if(error) throw error;
        await loadMembers(); flash("memberMsg","ok","Workspace user removed.");
      }catch(e){ flash("memberMsg","bad","Couldn’t remove that Workspace user. The organization owner cannot be removed."); await loadMembers(); }
    }

    // ── PEOPLE ──
'''
s=one(s,people_anchor,member_block,'settings member functions')
s=one(s,
'''      await Promise.all([ loadInvites(), loadPeople(), loadUsage() ]);
''',
'''      await Promise.all([ loadInvites(), loadMembers(), loadPeople(), loadUsage() ]);
''','settings member boot')
p.write_text(s,encoding='utf-8')

# ------------------------------------------------------------------
# Permanent frontend regression guards.
# ------------------------------------------------------------------
p=ROOT/'scripts'/'validate_frontend_release.py'; s=p.read_text(encoding='utf-8')
old='''for token in ['Use the full Pattern Workspace for 30 days.','No card is required to start','does not renew automatically','/api/billing/start-pattern-trial','pattern_trial_already_used','trial_requires_admin','Nothing was charged','One Pattern trial per Workspace']:
 if token not in trial:e.append('pattern trial contract '+token)
'''
new='''for token in ['Use the full Pattern Workspace for 30 days.','No card is required to start','does not renew automatically','/api/billing/start-pattern-trial','pattern_trial_already_used','trial_requires_admin','Nothing was charged','One Pattern trial per Workspace','ackStart','starts immediately for this Workspace','Your saved work is retained. Standard Trial access limits apply after day 30']:
 if token not in trial:e.append('pattern trial contract '+token)
'''
s=one(s,old,new,'validator trial deliberate start')
insert='''
# Pattern trial 30-day lifecycle UX: countdown, explicit paid conversion, and seat management.
overview=(r/'workspace.html').read_text(errors='ignore')
for token in ['subscription_status, pattern_trial_used_at, pattern_trial_ends_at','Pattern trial · ${trialDays} day','Choose paid plan →','plan-pattern.html']:
 if token not in overview:e.append('pattern lifecycle overview '+token)
settings=(r/'workspace-settings.html').read_text(errors='ignore')
for token in ['Workspace users','workspace_member_directory','billing_suspended_role','Paused by plan','pattern_trial_ends_at','renderRailPlan(org)','seat limit']:
 if token not in settings:e.append('pattern lifecycle settings '+token)
for name in ['workspace-actions.html','workspace-analysis.html','workspace-diagnostics.html']:
 t=(r/name).read_text(errors='ignore')
 for token in ['pattern_trial_ends_at','subscription_status','ws5TrialTag','trial · ${days}d left']:
  if token not in t:e.append(name+': pattern trial rail '+token)
'''
s=one(s,"\nprint('frontend release errors:',len(e))\n",insert+"\nprint('frontend release errors:',len(e))\n",'validator lifecycle block')
p.write_text(s,encoding='utf-8')

print('Pattern trial lifecycle site patch applied.')
