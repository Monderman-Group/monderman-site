// Monderman workspace shell — shared chrome for the stub spaces.
// Guards auth (redirects to sign-in if no session), fills the rail/topbar identity,
// and wires sign-out. The Overview page has its own richer script and does not use this.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ptkxrzgmeldalrkfruth.supabase.co",
  "sb_publishable_-4d7OaQvErf0mpdwEJhIoQ_skFiVBhz",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } }
);

const PLAN_LABEL = { free: "Free", baseline: "Baseline", signal: "Signal", advisory: "Advisory" };

function initials(name, email) {
  const base = (name && name.trim()) || (email || "").split("@")[0] || "";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (base.slice(0, 2) || "M").toUpperCase();
}
function set(id, val) { const el = document.getElementById(id); if (el && val != null) el.textContent = val; }

(async () => {
  const page = location.pathname.split("/").pop() || "workspace.html";

  document.getElementById("signOutBtn")?.addEventListener("click", async () => {
    try { await supabase.auth.signOut(); } catch (e) {}
    window.location.href = "index.html";
  });

  let user = null;
  try { const { data } = await supabase.auth.getUser(); user = data?.user || null; } catch (e) {}
  if (!user) { window.location.replace("signin.html?next=" + encodeURIComponent(page)); return; }

  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Monderman User";
  set("ws5UserName", name);
  set("ws5Ava", initials(name, user.email));

  try {
    const { data: m } = await supabase
      .from("organization_members")
      .select("role, organizations(name, plan)")
      .limit(1)
      .maybeSingle();
    const role = m?.role || "viewer";
    set("ws5UserRole", role.charAt(0).toUpperCase() + role.slice(1));
    const org = m?.organizations || null;
    set("ws5Org", (org && org.name) || "Personal workspace");
    set("ws5Plan", (org && (PLAN_LABEL[org.plan] || org.plan)) || "Free");
  } catch (e) {
    set("ws5UserRole", "Viewer");
    set("ws5Org", "Workspace");
    set("ws5Plan", "—");
  }
})();
