/*
  self-diagnostic-draft.js - privacy-conscious, tab-scoped recovery for
  authenticated self-run Diagnostics.

  Drafts contain only non-secret run reconstruction state. They are bound to
  the verified user, active organization, Diagnostic, routing configuration,
  and adaptive run UUID. They expire after eight hours and are never copied to
  localStorage or the database. Authentication credentials and report output
  are deliberately excluded.
*/
(function () {
  "use strict";

  var PREFIX = "monderman.selfDiagnosticDraft.v1.";
  var VERSION = 1;
  var MAX_AGE_MS = 8 * 60 * 60 * 1000;
  var MAX_BYTES = 256 * 1024;
  var STATE_FIELDS = [
    "mode", "depth", "started", "preflight", "runId", "currentItem",
    "currentProgress", "roleForText", "answerCache", "questionHistory",
    "experienceIndex", "experienceComplete", "experiential", "configVersion"
  ];

  function storageGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (_error) { return null; }
  }

  function storageSet(key, value) {
    try { window.sessionStorage.setItem(key, value); return true; } catch (_error) { return false; }
  }

  function storageRemove(key) {
    try { window.sessionStorage.removeItem(key); } catch (_error) {}
  }

  function storageKeys() {
    var keys = [];
    try {
      for (var i = 0; i < window.sessionStorage.length; i += 1) {
        var key = window.sessionStorage.key(i);
        if (key) keys.push(key);
      }
    } catch (_error) {}
    return keys;
  }

  function cleanUuid(value) {
    var id = String(value || "").trim();
    return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) ? id.toLowerCase() : "";
  }

  function cleanSegment(value) {
    var segment = String(value || "").trim();
    return /^[a-z0-9._-]{1,120}$/i.test(segment) ? segment : "";
  }

  function cloneJson(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_error) { return fallback; }
  }

  function cloneDraftValue(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value, function (key, child) {
        if (/token|password|secret|credential|authorization|session[_-]?id|magic[_-]?link/i.test(String(key || ""))) return undefined;
        return child;
      }));
    } catch (_error) { return fallback; }
  }

  async function waitForWorkspaceAccess() {
    for (var attempt = 0; attempt < 80; attempt += 1) {
      if (window.mondermanWorkspaceAccessReady && typeof window.mondermanWorkspaceAccessReady.then === "function") {
        return window.mondermanWorkspaceAccessReady;
      }
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
    }
    return null;
  }

  function identityPrefix(userId, organizationId, tool) {
    return PREFIX + userId + "." + organizationId + "." + tool + ".";
  }

  function activeKey(userId, organizationId, tool) {
    return identityPrefix(userId, organizationId, tool) + "active";
  }

  function draftKey(userId, organizationId, tool, configVersion, draftId) {
    return identityPrefix(userId, organizationId, tool) + configVersion + "." + draftId;
  }

  function clearAllExceptIdentity(userId, organizationId) {
    var keep = PREFIX + userId + "." + organizationId + ".";
    storageKeys().forEach(function (key) {
      if (key.indexOf(PREFIX) === 0 && key.indexOf(keep) !== 0) storageRemove(key);
    });
  }

  function removeDialog() {
    var existing = document.getElementById("selfDiagnosticDraftDialog");
    if (existing) existing.remove();
  }

  function showDialog(onResume, onStartOver) {
    removeDialog();
    var wrap = document.createElement("div");
    wrap.id = "selfDiagnosticDraftDialog";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "selfDiagnosticDraftTitle");
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:24px;background:rgba(8,56,62,.42);color:#18191C;font:500 15px/1.55 Helvetica,Arial,sans-serif";
    wrap.innerHTML = '<div style="width:min(520px,100%);background:#fff;border:1px solid rgba(24,25,28,.12);border-radius:18px;padding:28px;box-shadow:0 22px 60px rgba(8,56,62,.22)">' +
      '<p style="margin:0 0 8px;color:#0C6E78;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">In-progress Diagnostic</p>' +
      '<h2 id="selfDiagnosticDraftTitle" style="margin:0 0 10px;font-size:24px;line-height:1.15">Resume where you left off?</h2>' +
      '<p style="margin:0;color:#62656A">Accepted answers from this Diagnostic are available in this browser tab. Resume restores the same perspective, depth, adaptive path, and active question.</p>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:22px">' +
      '<button id="selfDiagnosticDraftResume" type="button" style="border:0;border-radius:9px;background:#0C6E78;color:#fff;padding:11px 17px;font:600 15px Helvetica,Arial,sans-serif;cursor:pointer">Resume</button>' +
      '<button id="selfDiagnosticDraftStartOver" type="button" style="border:1px solid #D9D5CB;border-radius:9px;background:#fff;color:#18191C;padding:11px 17px;font:600 15px Helvetica,Arial,sans-serif;cursor:pointer">Start over</button>' +
      '</div><p style="margin:18px 0 0;color:#7A7C80;font-size:12px">Start over permanently removes only this scoped in-progress draft.</p></div>';
    document.body.appendChild(wrap);
    wrap.querySelector("#selfDiagnosticDraftResume").addEventListener("click", onResume);
    wrap.querySelector("#selfDiagnosticDraftStartOver").addEventListener("click", onStartOver);
    wrap.querySelector("#selfDiagnosticDraftResume").focus();
  }

  function createController(options) {
    options = options || {};
    var state = options.state;
    var tool = cleanSegment(options.tool);
    if (!state || !tool) return null;
    var userId = "";
    var organizationId = "";
    var indexKey = "";
    var key = "";
    var pending = null;
    var active = false;
    var activationPromise = null;

    function selectedState() {
      var out = {};
      STATE_FIELDS.forEach(function (field) {
        if (state[field] !== undefined) out[field] = cloneDraftValue(state[field], null);
      });
      return out;
    }

    function clear() {
      if (key) storageRemove(key);
      var indexed = indexKey ? storageGet(indexKey) : null;
      if (indexed && indexed.indexOf(identityPrefix(userId, organizationId, tool)) === 0) storageRemove(indexed);
      if (indexKey) storageRemove(indexKey);
      key = "";
      pending = null;
      removeDialog();
    }

    function validPayload(saved, expectedKey) {
      if (!saved || saved.version !== VERSION || saved.key !== expectedKey) return false;
      if (saved.user_id !== userId || saved.organization_id !== organizationId || saved.tool !== tool) return false;
      if (!cleanSegment(saved.config_version) || !cleanUuid(saved.draft_id)) return false;
      if (!saved.state || typeof saved.state !== "object") return false;
      if (cleanUuid(saved.state.runId) !== saved.draft_id) return false;
      if (!saved.state.currentItem || typeof saved.state.currentItem !== "object") return false;
      if (!saved.state.answerCache || typeof saved.state.answerCache !== "object") return false;
      if (!Array.isArray(saved.state.questionHistory)) return false;
      if (String(saved.state.configVersion || "") !== saved.config_version) return false;
      var savedAt = Date.parse(saved.saved_at || "");
      if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS || savedAt > Date.now() + 60000) return false;
      return true;
    }

    function restore() {
      if (!pending) return false;
      STATE_FIELDS.forEach(function (field) {
        if (pending.state[field] !== undefined && pending.state[field] !== null) state[field] = cloneJson(pending.state[field], pending.state[field]);
      });
      active = true;
      removeDialog();
      options.showStage(options.questionStage, { scroll: false });
      options.renderQuestion();
      var notice = document.getElementById("persistenceNotice");
      if (notice) {
        notice.textContent = "Your accepted answers and active question were restored for this signed-in Workspace.";
        notice.style.display = "block";
      }
      if (typeof options.onRestore === "function") options.onRestore(pending);
      return true;
    }

    function writeAccepted() {
      if (!active || !userId || !organizationId) return false;
      if (state.result || document.getElementById("resultsStage")?.classList.contains("active")) return false;
      var configVersion = cleanSegment(state.configVersion);
      var draftId = cleanUuid(state.runId);
      if (!configVersion || !draftId || !state.currentItem || !state.answerCache || !Array.isArray(state.questionHistory)) return false;
      var nextKey = draftKey(userId, organizationId, tool, configVersion, draftId);
      if (key && key !== nextKey && key.indexOf(identityPrefix(userId, organizationId, tool)) === 0) storageRemove(key);
      key = nextKey;
      var payload = {
        version: VERSION,
        key: key,
        user_id: userId,
        organization_id: organizationId,
        tool: tool,
        config_version: configVersion,
        draft_id: draftId,
        saved_at: new Date().toISOString(),
        state: selectedState()
      };
      var encoded = JSON.stringify(payload);
      if (encoded.length > MAX_BYTES) return false;
      if (!storageSet(key, encoded)) return false;
      storageSet(indexKey, key);
      pending = payload;
      return true;
    }

    function saveAccepted() {
      if (active) return writeAccepted();
      if (activationPromise) {
        activationPromise.then(function () { if (active) writeAccepted(); }).catch(function () {});
      }
      return false;
    }

    async function activateOnce() {
      if (new URLSearchParams(window.location.search).has("assignment_token")) return false;
      var access = await waitForWorkspaceAccess();
      if (!access || !access.allowed || access.context !== "workspace") return false;
      var client = await window.mondermanGetSupabaseClient();
      var result = await client.auth.getUser();
      userId = cleanUuid(result && result.data && result.data.user && result.data.user.id);
      organizationId = cleanUuid(window.__mondermanActiveOrganizationId);
      if (userId && !organizationId) {
        var storedOrganizationId = cleanUuid(storageGet("monderman_active_organization_id"));
        if (storedOrganizationId) {
          var membership = await client.from("organization_members")
            .select("organization_id")
            .eq("user_id", userId)
            .eq("organization_id", storedOrganizationId)
            .maybeSingle();
          if (!membership.error && membership.data && cleanUuid(membership.data.organization_id) === storedOrganizationId) {
            organizationId = storedOrganizationId;
          }
        }
      }
      if (!userId || !organizationId) return false;
      active = true;
      clearAllExceptIdentity(userId, organizationId);
      indexKey = activeKey(userId, organizationId, tool);
      var indexed = storageGet(indexKey);
      if (!indexed || indexed.indexOf(identityPrefix(userId, organizationId, tool)) !== 0) {
        if (indexed) storageRemove(indexKey);
        return false;
      }
      var saved = null;
      try { saved = JSON.parse(storageGet(indexed) || "null"); } catch (_error) { saved = null; }
      if (!validPayload(saved, indexed)) {
        storageRemove(indexed);
        storageRemove(indexKey);
        return false;
      }
      key = indexed;
      pending = saved;
      showDialog(restore, function () {
        clear();
        if (typeof options.startOver === "function") options.startOver();
      });
      return true;
    }

    function activate() {
      if (!activationPromise) activationPromise = activateOnce();
      return activationPromise;
    }

    return { activate: activate, saveAccepted: saveAccepted, clear: clear, restore: restore };
  }

  window.MondermanSelfDiagnosticDraft = {
    createController: createController,
    _test: {
      version: VERSION,
      maxAgeMs: MAX_AGE_MS,
      identityPrefix: identityPrefix,
      activeKey: activeKey,
      draftKey: draftKey,
      clearAllExceptIdentity: clearAllExceptIdentity
    }
  };
})();
