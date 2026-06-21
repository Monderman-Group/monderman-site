// Workspace notes — a floating admin notepad shared across every workspace page.
// Self-contained: creates its own Supabase client (reads the existing session), is admin-only,
// and persists notes in public.workspace_notes (org-scoped, admin RLS). Loaded as a module on each page.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

(async () => {
  const SUPABASE_URL = "https://ptkxrzgmeldalrkfruth.supabase.co";
  const SUPABASE_KEY = "sb_publishable_-4d7OaQvErf0mpdwEJhIoQ_skFiVBhz";

  let supabase;
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  } catch (e) { return; }

  // identify the signed-in user, their org, and whether they are an admin
  let user = null, orgId = null;
  try { const { data } = await supabase.auth.getUser(); user = data?.user || null; } catch (e) {}
  if (!user) return;
  try {
    const { data: m } = await supabase.from("organization_members")
      .select("organization_id, role").limit(1).maybeSingle();
    orgId = m?.organization_id || null;
    if (String(m?.role || "").toLowerCase() !== "admin" || !orgId) return; // admin-only widget
  } catch (e) { return; }

  // ---------- state ----------
  let notes = [], loaded = false, open = false, saving = false;

  // ---------- styles (theme-aware; falls back gracefully) ----------
  const style = document.createElement("style");
  style.textContent = `
  .wsn-btn{position:fixed;right:30px;bottom:150px;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2147482998;background:var(--ws-surface,var(--card,#fff));color:var(--ws-text,var(--text,#15202B));border:1px solid var(--ws-line,var(--line,rgba(21,32,43,.12)));box-shadow:0 8px 24px rgba(15,23,32,.18);transition:transform .15s,box-shadow .15s;padding:0}
  .wsn-btn:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(15,23,32,.26)}
  .wsn-btn svg{width:20px;height:20px;opacity:.92}
  .wsn-badge{position:absolute;top:-3px;right:-3px;min-width:18px;height:18px;border-radius:999px;background:var(--accent,#3F6EA1);color:#fff;font-size:10.5px;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 5px;box-sizing:border-box;border:2px solid var(--ws-surface,var(--card,#fff))}
  .wsn-badge.on{display:flex}
  .wsn-panel{position:fixed;right:30px;bottom:204px;width:330px;max-width:calc(100vw - 40px);max-height:62vh;display:flex;flex-direction:column;background:var(--ws-surface,var(--card,#fff));color:var(--ws-text,var(--text,#15202B));border:1px solid var(--ws-line,var(--line,rgba(21,32,43,.12)));border-radius:16px;box-shadow:0 22px 60px rgba(15,23,32,.30);z-index:2147482998;overflow:hidden}
  .wsn-panel[hidden]{display:none}
  .wsn-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--line,rgba(21,32,43,.08))}
  .wsn-head b{font-size:14px;font-weight:600}
  .wsn-x{background:transparent;border:0;color:var(--muted,#6B7785);font-size:21px;line-height:1;cursor:pointer;padding:0 3px}
  .wsn-x:hover{color:var(--text,#15202B)}
  .wsn-list{flex:1 1 auto;overflow-y:auto;padding:11px 14px;display:flex;flex-direction:column;gap:9px;min-height:46px}
  .wsn-note{position:relative;background:rgba(128,128,128,.08);border:1px solid var(--line,rgba(21,32,43,.07));border-radius:10px;padding:10px 32px 9px 12px}
  .wsn-note p{margin:0;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text,#15202B)}
  .wsn-note time{display:block;margin-top:5px;font-size:10.5px;color:var(--muted-2,#8A95A1)}
  .wsn-del{position:absolute;top:6px;right:6px;background:transparent;border:0;color:var(--muted-2,#8A95A1);cursor:pointer;font-size:15px;line-height:1;padding:3px;border-radius:6px}
  .wsn-del:hover{color:#B8505E;background:rgba(184,80,94,.10)}
  .wsn-empty{color:var(--muted,#6B7785);font-size:12.5px;text-align:center;padding:20px 10px;line-height:1.5}
  .wsn-foot{border-top:1px solid var(--line,rgba(21,32,43,.08));padding:11px 13px}
  .wsn-ta{width:100%;box-sizing:border-box;min-height:54px;max-height:130px;resize:vertical;border:1px solid var(--line,rgba(21,32,43,.14));border-radius:9px;padding:8px 10px;font-size:13px;font-family:inherit;background:var(--card,#fff);color:var(--text,#15202B);line-height:1.45}
  .wsn-ta:focus{outline:2px solid var(--accent-bg,rgba(63,110,161,.18));outline-offset:1px;border-color:var(--accent,#3F6EA1)}
  .wsn-hint{margin:6px 2px 0;font-size:10.5px;color:var(--muted-2,#8A95A1)}
  .wsn-save{margin-top:8px;width:100%;height:36px;border:0;border-radius:9px;background:var(--accent,#3F6EA1);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .wsn-save:hover{background:var(--accent-d,#2F5886)}
  .wsn-save:disabled{opacity:.55;cursor:default}
  @media (max-width:480px){ .wsn-btn{right:24px;bottom:134px;width:42px;height:42px} .wsn-panel{right:16px;left:16px;width:auto;bottom:186px} }
  `;
  document.head.appendChild(style);

  // ---------- build UI ----------
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "wsn-btn"; btn.id = "wsNotesBtn";
  btn.setAttribute("aria-label", "Workspace notes");
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><span class="wsn-badge" id="wsNotesBadge"></span>`;
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "wsn-panel"; panel.id = "wsNotesPanel"; panel.hidden = true;
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Workspace notes");
  panel.innerHTML = `
    <div class="wsn-head"><b>Workspace notes</b><button type="button" class="wsn-x" id="wsNotesClose" aria-label="Close">\u00d7</button></div>
    <div class="wsn-list" id="wsNotesList"></div>
    <div class="wsn-foot">
      <textarea class="wsn-ta" id="wsNotesInput" placeholder="Jot a note for the workspace\u2026"></textarea>
      <div class="wsn-hint">Visible to admins on every page \u00b7 \u2318/Ctrl + Enter to save</div>
      <button type="button" class="wsn-save" id="wsNotesSave">Save note</button>
    </div>`;
  document.body.appendChild(panel);

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  function timeAgo(iso) {
    const t = Date.parse(iso); if (isNaN(t)) return "";
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 90) return "just now";
    const m = s / 60; if (m < 60) return Math.round(m) + "m ago";
    const h = m / 60; if (h < 24) return Math.round(h) + "h ago";
    const d = h / 24; if (d < 30) return Math.round(d) + "d ago";
    const mo = d / 30; if (mo < 12) return Math.round(mo) + "mo ago";
    return Math.round(mo / 12) + "y ago";
  }
  function updateBadge() {
    const b = $("wsNotesBadge"); if (!b) return;
    if (notes.length) { b.textContent = notes.length > 99 ? "99+" : String(notes.length); b.classList.add("on"); }
    else b.classList.remove("on");
  }
  function renderList() {
    const list = $("wsNotesList"); if (!list) return;
    if (!loaded) { list.innerHTML = `<div class="wsn-empty">Loading\u2026</div>`; return; }
    if (!notes.length) { list.innerHTML = `<div class="wsn-empty">No notes yet. Anything you save here stays with the workspace and shows on every page.</div>`; updateBadge(); return; }
    list.innerHTML = notes.map((n) =>
      `<div class="wsn-note" data-id="${esc(n.id)}"><button class="wsn-del" data-del="${esc(n.id)}" type="button" aria-label="Delete note" title="Delete">\u00d7</button><p>${esc(n.body)}</p><time>${timeAgo(n.created_at)}</time></div>`
    ).join("");
    updateBadge();
  }

  // ---------- data ----------
  async function loadNotes() {
    try {
      const { data, error } = await supabase.from("workspace_notes")
        .select("id, body, author_user_id, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      notes = data || []; loaded = true;
    } catch (e) {
      notes = []; loaded = true;
      const list = $("wsNotesList");
      if (list) list.innerHTML = `<div class="wsn-empty">Couldn\u2019t load notes \u2014 make sure the workspace_notes table exists.</div>`;
      updateBadge(); return;
    }
    renderList();
  }
  async function addNote() {
    const ta = $("wsNotesInput"); const body = (ta?.value || "").trim();
    if (!body || saving) return;
    saving = true; const sb = $("wsNotesSave"); if (sb) { sb.disabled = true; sb.textContent = "Saving\u2026"; }
    try {
      const { error } = await supabase.from("workspace_notes").insert({ organization_id: orgId, body, author_user_id: user.id });
      if (error) throw error;
      if (ta) ta.value = "";
      await loadNotes();
    } catch (e) {
      if (sb) { sb.textContent = "Couldn\u2019t save"; setTimeout(() => { if (sb) sb.textContent = "Save note"; }, 2200); }
    } finally {
      saving = false;
      if (sb) { sb.disabled = false; if (sb.textContent === "Saving\u2026") sb.textContent = "Save note"; }
    }
  }
  async function delNote(id) {
    try { const { error } = await supabase.from("workspace_notes").delete().eq("id", id); if (error) throw error; await loadNotes(); }
    catch (e) {}
  }

  // ---------- interactions ----------
  function toggle(force) {
    open = (force === undefined) ? !open : force;
    panel.hidden = !open;
    if (open && !loaded) loadNotes();
    if (open) setTimeout(() => $("wsNotesInput")?.focus(), 30);
  }
  btn.addEventListener("click", () => toggle());
  $("wsNotesClose").addEventListener("click", () => toggle(false));
  $("wsNotesSave").addEventListener("click", addNote);
  $("wsNotesInput").addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addNote(); });
  $("wsNotesList").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) delNote(b.dataset.del); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) toggle(false); });

  // preload quietly so the count badge appears without opening the panel
  loadNotes();
})();
