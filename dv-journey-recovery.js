/* Tab-scoped recovery for a Decision Velocity run begun without an account.
   The run capability is kept only in sessionStorage and sent to the API in a
   header/body by the page adapter. Auth credentials and report output are never
   copied here. The server, not this snapshot, supplies questions and history. */
(function () {
  "use strict";

  var KEY = "monderman.dvJourney.v1";
  var VERSION = 1;
  var MAX_AGE_MS = 4 * 60 * 60 * 1000;
  var MAX_BYTES = 128 * 1024;
  var RETURN_TARGET = "decision-velocity.html?resume=1";
  var SIGNIN_URL = "signin.html?next=decision-velocity.html%3Fresume%3D1";
  var PHASES = ["questions", "experience", "confidence", "teaser", "finalizing"];
  var TEXT_FIELDS = {
    processName: 300, businessUnit: 300, industry: 120,
    regulatoryIntensity: 80, decisionType: 120, description: 8000,
    organizationSize: 80
  };
  var NUMBER_FIELDS = ["employeeCount", "peopleInvolved", "hourlyCost", "annualVolume", "meetingHours"];
  var EXPERIENCE_FIELDS = ["self", "observedOperational", "observedManagerial", "observedSeniorLeader"];

  function object(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function uuid(value) {
    return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      ? value.toLowerCase() : "";
  }

  function text(value, maximum) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  function byteLength(value) {
    return new TextEncoder().encode(value).length;
  }

  function clearPending() {
    try { window.sessionStorage.removeItem(KEY); } catch (_error) {}
  }

  function isReturnTarget(value) {
    return value === RETURN_TARGET;
  }

  function isAssignment() {
    return new URLSearchParams(window.location.search).has("assignment_token")
      || Boolean(window.MondermanAssignment && window.MondermanAssignment.active && window.MondermanAssignment.active());
  }

  function sanitizeState(source) {
    if (!object(source) || !uuid(source.runId)
      || typeof source.sessionCapability !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(source.sessionCapability)
      || !["operational", "managerial", "executive"].includes(source.mode)
      || !["10", "30", "60"].includes(String(source.depth))
      || typeof source.configVersion !== "string" || !/^[A-Za-z0-9._-]{1,120}$/.test(source.configVersion)
      || !object(source.preflight) || !object(source.experiential)) return null;
    var preflight = {};
    for (var field of Object.keys(TEXT_FIELDS)) {
      if (source.preflight[field] == null) continue;
      var selected = text(source.preflight[field], TEXT_FIELDS[field]);
      if (selected === null) return null;
      preflight[field] = selected;
    }
    for (var required of ["processName", "businessUnit", "industry", "regulatoryIntensity", "decisionType"]) {
      if (!preflight[required] || !preflight[required].trim()) return null;
    }
    for (var numberField of NUMBER_FIELDS) {
      var number = source.preflight[numberField];
      if (typeof number !== "number" || !Number.isFinite(number) || number < 0 || number > 1e12) return null;
      preflight[numberField] = number;
    }
    if (source.preflight.confidenceLevel != null) {
      if (!["high", "moderate", "limited"].includes(source.preflight.confidenceLevel)) return null;
      preflight.confidenceLevel = source.preflight.confidenceLevel;
    }
    var experiential = {};
    for (var experienceField of EXPERIENCE_FIELDS) {
      var note = text(source.experiential[experienceField] == null ? "" : source.experiential[experienceField], 12000);
      if (note === null) return null;
      experiential[experienceField] = note;
    }
    var index = source.experienceIndex == null ? 0 : source.experienceIndex;
    if (!Number.isInteger(index) || index < 0 || index > 3) return null;
    if (typeof source.experienceComplete !== "boolean") return null;
    return {
      runId: uuid(source.runId), sessionCapability: source.sessionCapability,
      mode: source.mode, depth: String(source.depth), started: true,
      roleForText: source.mode === "executive" ? "senior_leader" : source.mode,
      configVersion: source.configVersion, preflight: preflight,
      experiential: experiential, experienceIndex: index,
      experienceComplete: source.experienceComplete
    };
  }

  function readPending() {
    var raw;
    try { raw = window.sessionStorage.getItem(KEY); }
    catch (_error) { return { reason: "storage_unavailable" }; }
    if (!raw) return { record: null };
    if (byteLength(raw) > MAX_BYTES) { clearPending(); return { reason: "invalid_recovery" }; }
    var record;
    try { record = JSON.parse(raw); } catch (_error) { clearPending(); return { reason: "invalid_recovery" }; }
    var now = Date.now();
    if (!object(record) || record.version !== VERSION || record.tool !== "decision_velocity"
      || !PHASES.includes(record.phase) || !Number.isFinite(record.created_at)
      || !Number.isFinite(record.saved_at) || record.created_at > now + 60000
      || record.saved_at < record.created_at || record.saved_at > now + 60000
      || (record.owner_user_id !== null && !uuid(record.owner_user_id))
      || (record.owner_organization_id !== null && !uuid(record.owner_organization_id))
      || (record.owner_organization_id && !record.owner_user_id)
      || typeof record.auth_return !== "boolean") {
      clearPending(); return { reason: "invalid_recovery" };
    }
    if (now - record.created_at >= MAX_AGE_MS) { clearPending(); return { reason: "expired_recovery" }; }
    var safeState = sanitizeState(record.state);
    if (!safeState) { clearPending(); return { reason: "invalid_recovery" }; }
    // Rebuild an allowlisted envelope as well as its state; never propagate
    // arbitrary saved keys such as auth tokens, URLs, report HTML or objects.
    return { record: {
      version: VERSION, tool: "decision_velocity", phase: record.phase,
      created_at: record.created_at, saved_at: record.saved_at,
      owner_user_id: record.owner_user_id ? uuid(record.owner_user_id) : null,
      owner_organization_id: record.owner_organization_id ? uuid(record.owner_organization_id) : null,
      auth_return: record.auth_return, state: safeState
    } };
  }

  function writePending(record) {
    try {
      var encoded = JSON.stringify(record);
      if (byteLength(encoded) > MAX_BYTES) return false;
      window.sessionStorage.setItem(KEY, encoded);
      return true;
    } catch (_error) { return false; }
  }

  // Called only by the existing sign-in page. getUser verifies the identity;
  // the auth-event session is used solely to detect a concurrent account swap.
  async function bindAuthenticatedReturn(client, nextTarget, expectedUserId) {
    if (!isReturnTarget(nextTarget) || isAssignment()) return false;
    var pending = readPending();
    if (!pending.record) return false;
    var record = pending.record;
    if (!record.auth_return) return false;
    var result = await client.auth.getUser();
    var userId = uuid(result && result.data && result.data.user && result.data.user.id);
    if (result.error || !userId || (expectedUserId && userId !== uuid(expectedUserId))) {
      throw new Error("dv_recovery_identity_unavailable");
    }
    if (record.owner_user_id && record.owner_user_id !== userId) { clearPending(); return false; }
    record.owner_user_id = userId;
    if (!writePending(record)) throw new Error("dv_recovery_storage_unavailable");
    return true;
  }

  function createController(options) {
    options = options || {};
    if (!options.state || typeof options.validateRemote !== "function" || typeof options.restore !== "function") return null;
    var enabled = false;
    var activeRecord = null;
    var activationPromise = null;
    var subscription = null;
    var verifiedUserId = null;
    var verifiedOrganizationId = null;
    var invalidated = false;
    var generation = 0;
    var notified = "";

    function unavailable(reason, retryable) {
      if (notified === reason) return;
      notified = reason;
      if (typeof options.onUnavailable === "function") options.onUnavailable({ reason: reason, retryable: retryable === true });
    }

    function clear() {
      generation += 1;
      activeRecord = null;
      notified = "";
      clearPending();
    }

    function invalidate(reason) {
      clear();
      enabled = false;
      invalidated = true;
      unavailable(reason, false);
    }

    function subscribe(client) {
      if (subscription || !client.auth.onAuthStateChange) return;
      var result = client.auth.onAuthStateChange(function (event, session) {
        // Event data can invalidate a snapshot; it never authorizes recovery.
        // No asynchronous Supabase calls run inside this auth callback.
        if (event === "SIGNED_OUT") { invalidate("signed_out"); return; }
        var observed = uuid(session && session.user && session.user.id);
        if (observed && verifiedUserId && observed !== verifiedUserId) invalidate("account_changed");
        else if (observed && !verifiedUserId && enabled) invalidate("account_changed");
      });
      subscription = result && result.data && result.data.subscription;
    }

    async function workspaceAccess() {
      for (var attempt = 0; attempt < 80; attempt += 1) {
        if (window.mondermanWorkspaceAccessReady) return window.mondermanWorkspaceAccessReady;
        await new Promise(function (resolve) { setTimeout(resolve, 50); });
      }
      return null;
    }

    async function activateOnce() {
      if (isAssignment() || invalidated) return false;
      var version = generation;
      var access = await workspaceAccess();
      if (!access || !access.allowed || !["public_first_run", "workspace"].includes(access.context)) return false;
      var pending = readPending();
      var record = pending.record;
      var client = await window.mondermanGetSupabaseClient();
      var result = await client.auth.getUser();
      var userId = uuid(result && result.data && result.data.user && result.data.user.id);
      // The verified gate distinguishes a known anonymous session from a
      // network/auth failure; a workspace must still have the same real user.
      if (access.context === "workspace" && (result.error || !userId)) {
        unavailable("identity_unavailable", true); return false;
      }
      if (access.context === "public_first_run" && userId) {
        unavailable("account_changed", false); return false;
      }
      verifiedUserId = userId || null;
      verifiedOrganizationId = userId ? uuid(window.__mondermanActiveOrganizationId) : null;
      enabled = access.context === "public_first_run";
      subscribe(client);
      if (version !== generation || invalidated) return false;
      if (pending.reason) { unavailable(pending.reason, false); return false; }
      if (!record) {
        if (new URLSearchParams(window.location.search).get("resume") === "1") unavailable("missing_recovery", false);
        return false;
      }
      if (record.owner_user_id && record.owner_user_id !== userId) { invalidate("account_changed"); return false; }
      if (userId) {
        if (!verifiedOrganizationId) { unavailable("workspace_unavailable", true); return false; }
        if (!record.owner_user_id && (!record.auth_return || new URLSearchParams(window.location.search).get("resume") !== "1")) {
          invalidate("account_changed"); return false;
        }
        if (record.owner_organization_id && record.owner_organization_id !== verifiedOrganizationId) {
          invalidate("workspace_changed"); return false;
        }
        record.owner_user_id = userId;
        record.owner_organization_id = verifiedOrganizationId;
        record.auth_return = false;
        if (!writePending(record)) { unavailable("storage_unavailable", true); return false; }
      }
      activeRecord = record;
      var remote;
      try {
        remote = await options.validateRemote({ runId: record.state.runId, sessionCapability: record.state.sessionCapability });
      } catch (error) {
        var permanent = [401, 403, 404, 410].includes(Number(error && error.status));
        if (permanent) clear();
        unavailable(permanent ? "run_unavailable" : "verification_unavailable", !permanent);
        return false;
      }
      if (version !== generation || invalidated) return false;
      if (!remote || remote.ok !== true || uuid(remote.runId) !== record.state.runId
        || remote.role !== record.state.roleForText || String(remote.depth) !== record.state.depth) {
        clear(); unavailable("invalid_server_response", false); return false;
      }
      var remoteConfig = remote.configVersion || remote.currentVersion || (remote.routingMeta && remote.routingMeta.configVersion);
      if (remoteConfig && remoteConfig !== record.state.configVersion) {
        clear(); unavailable("configuration_changed", false); return false;
      }
      enabled = true;
      notified = "";
      await options.restore({ state: record.state, phase: record.phase, remote: remote, authenticated: Boolean(userId) });
      return true;
    }

    function activate() {
      if (!activationPromise) {
        activationPromise = activateOnce().catch(function () {
          unavailable("verification_unavailable", true); return false;
        }).finally(function () { activationPromise = null; });
      }
      return activationPromise;
    }

    function save(phase) {
      phase = phase || "questions";
      if (!enabled || invalidated || isAssignment() || !PHASES.includes(phase)) return false;
      if (options.state.result) return false;
      if (verifiedUserId && uuid(window.__mondermanActiveOrganizationId) !== verifiedOrganizationId) {
        invalidate("workspace_changed"); return false;
      }
      var safeState = sanitizeState(options.state);
      if (!safeState) { unavailable("invalid_recovery", false); return false; }
      var now = Date.now();
      var sameRun = activeRecord && activeRecord.state.runId === safeState.runId;
      var createdAt = sameRun ? activeRecord.created_at : now;
      if (now - createdAt >= MAX_AGE_MS) { clear(); unavailable("expired_recovery", false); return false; }
      var record = {
        version: VERSION, tool: "decision_velocity", phase: phase,
        created_at: createdAt, saved_at: now,
        owner_user_id: verifiedUserId, owner_organization_id: verifiedOrganizationId,
        auth_return: Boolean(sameRun && activeRecord.auth_return), state: safeState
      };
      if (!writePending(record)) { unavailable("storage_unavailable", false); return false; }
      activeRecord = record;
      return true;
    }

    function prepareSignIn() {
      if (!save("teaser") || !activeRecord) return null;
      activeRecord.auth_return = true;
      if (!writePending(activeRecord)) { unavailable("storage_unavailable", false); return null; }
      return SIGNIN_URL;
    }

    return {
      activate: activate, save: save, prepareSignIn: prepareSignIn,
      clear: clear, isActive: function () { return enabled && !invalidated; }
    };
  }

  window.MondermanDVJourneyRecovery = {
    createController: createController,
    bindAuthenticatedReturn: bindAuthenticatedReturn,
    clearPending: clearPending,
    signInUrl: function () { return SIGNIN_URL; },
    _test: { key: KEY, maxAgeMs: MAX_AGE_MS, maxBytes: MAX_BYTES, sanitizeState: sanitizeState, readPending: readPending }
  };
})();
