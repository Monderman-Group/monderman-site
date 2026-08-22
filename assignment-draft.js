/*
  assignment-draft.js - tab-scoped recovery for directed participant runs.

  The assignment credential is never stored. A resolved, non-secret assignment
  UUID scopes the draft. sessionStorage keeps the draft inside the current tab,
  survives reload, and disappears when the tab is closed. Invalid, closed,
  revoked, expired, and completed assignment flows clear the active draft.
*/
(function () {
  "use strict";

  var PREFIX = "monderman.assignmentDraft.v1.";
  var ACTIVE_KEY = "monderman.assignmentDraft.activeKey.v1";
  var VERSION = 1;
  var MAX_BYTES = 256 * 1024;
  var STATE_FIELDS = [
    "mode", "depth", "started", "preflight", "runId", "currentItem",
    "currentProgress", "roleForText", "answerCache", "questionHistory",
    "experienceIndex", "experienceComplete", "experiential"
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

  function cleanAssignmentId(value) {
    var id = String(value || "").trim();
    return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) ? id : "";
  }

  function draftKey(assignmentId) {
    var id = cleanAssignmentId(assignmentId);
    return id ? PREFIX + id : "";
  }

  function cloneJson(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_error) { return fallback; }
  }

  function captureControls() {
    var roots = [document.getElementById("introStage"), document.getElementById("questionStage")].filter(Boolean);
    var controls = [];
    roots.forEach(function (root) {
      Array.prototype.forEach.call(root.querySelectorAll("input,select,textarea"), function (el, index) {
        if (el.type === "password" || el.type === "file" || el.disabled) return;
        var nameIndex = -1;
        if (el.name) {
          var escapedName = String(el.name).replace(/"/g, '\\"');
          nameIndex = Array.prototype.indexOf.call(root.querySelectorAll('[name="' + escapedName + '"]'), el);
        }
        controls.push({
          root: root.id,
          id: el.id || "",
          name: el.name || "",
          index: index,
          nameIndex: nameIndex,
          type: el.type || el.tagName.toLowerCase(),
          value: el.value == null ? "" : String(el.value),
          checked: Boolean(el.checked)
        });
      });
    });
    return controls;
  }

  function restoreControls(controls) {
    (Array.isArray(controls) ? controls : []).forEach(function (saved) {
      var root = document.getElementById(saved.root);
      if (!root) return;
      var el = saved.id ? document.getElementById(saved.id) : null;
      if (!el && saved.name) {
        var named = root.querySelectorAll('[name="' + String(saved.name).replace(/"/g, '\\"') + '"]');
        el = named[saved.nameIndex] || named[0] || null;
      }
      if (!el) {
        var all = root.querySelectorAll("input,select,textarea");
        el = all[saved.index] || null;
      }
      if (!el || el.disabled) return;
      if (el.type === "checkbox" || el.type === "radio") el.checked = Boolean(saved.checked);
      else el.value = saved.value == null ? "" : saved.value;
      try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch (_error) {}
    });
  }

  function clearActiveDraft() {
    var key = storageGet(ACTIVE_KEY);
    if (key && key.indexOf(PREFIX) === 0) storageRemove(key);
    storageRemove(ACTIVE_KEY);
  }

  function createController(options) {
    options = options || {};
    var state = options.state;
    if (!state) return null;
    var assignmentId = "";
    var key = "";
    var config = null;
    var timer = null;
    var inputTimer = null;
    var active = false;

    function selectedState() {
      var out = {};
      STATE_FIELDS.forEach(function (field) {
        if (state[field] !== undefined) out[field] = cloneJson(state[field], null);
      });
      return out;
    }

    function save() {
      if (!active || !key || !config) return false;
      if (state.result || document.getElementById("resultsStage")?.classList.contains("active")) return false;
      var activeStage = document.querySelector(".stage.active");
      var payload = {
        version: VERSION,
        assignment_id: assignmentId,
        tool_type: String(options.tool || config.tool_type || ""),
        anonymous: config.is_anonymous_response === true,
        saved_at: new Date().toISOString(),
        active_stage: activeStage ? activeStage.id : "",
        state: selectedState(),
        controls: captureControls()
      };
      var encoded = JSON.stringify(payload);
      if (encoded.length > MAX_BYTES) return false;
      storageSet(ACTIVE_KEY, key);
      return storageSet(key, encoded);
    }

    function clear() {
      if (key) storageRemove(key);
      if (storageGet(ACTIVE_KEY) === key) storageRemove(ACTIVE_KEY);
    }

    function stop() {
      active = false;
      if (timer) window.clearInterval(timer);
      if (inputTimer) window.clearTimeout(inputTimer);
      timer = null;
      inputTimer = null;
    }

    function startAutosave() {
      if (timer) return;
      active = true;
      timer = window.setInterval(save, 700);
      document.addEventListener("input", function () {
        if (!active) return;
        if (inputTimer) window.clearTimeout(inputTimer);
        inputTimer = window.setTimeout(save, 120);
      });
      document.addEventListener("change", save);
      window.addEventListener("pagehide", save);
    }

    function restoreStage(saved) {
      var stages = options.stages || {};
      if (state.runId && state.currentItem && stages.question) {
        options.showStage(stages.question, { scroll: false });
        options.renderQuestion();
      } else if (config.depth_choice && !state.depth && stages.depth) {
        options.showStage(stages.depth, { scroll: false });
      } else if (stages.intro) {
        options.renderPreflight();
        options.showStage(stages.intro, { scroll: false });
      }
      window.setTimeout(function () { restoreControls(saved.controls); }, 0);
      window.setTimeout(function () { restoreControls(saved.controls); }, 160);
      var notice = document.getElementById("persistenceNotice");
      if (notice) {
        notice.textContent = "Your in-progress answers were restored in this browser tab.";
        notice.style.display = "block";
      }
      if (typeof options.onRestore === "function") options.onRestore(saved);
    }

    function activate(cfg) {
      config = cfg || {};
      assignmentId = cleanAssignmentId(config.id || config.assignment_id);
      key = draftKey(assignmentId);
      if (!key) return false;
      storageSet(ACTIVE_KEY, key);
      var saved = null;
      try { saved = JSON.parse(storageGet(key) || "null"); } catch (_error) { saved = null; }
      var expectedTool = String(options.tool || config.tool_type || "");
      var valid = saved && saved.version === VERSION && saved.assignment_id === assignmentId &&
        saved.tool_type === expectedTool && saved.anonymous === (config.is_anonymous_response === true) &&
        saved.state && typeof saved.state === "object";
      if (valid) {
        STATE_FIELDS.forEach(function (field) {
          if (saved.state[field] !== undefined && saved.state[field] !== null) state[field] = saved.state[field];
        });
        state.mode = config.participant_lens || state.mode;
        if (!config.depth_choice && config.depth != null) state.depth = String(config.depth);
        restoreStage(saved);
      } else if (saved) {
        clear();
      }
      startAutosave();
      return Boolean(valid);
    }

    return { activate: activate, save: save, clear: clear, stop: stop };
  }

  window.MondermanAssignmentDraft = {
    createController: createController,
    clearActive: clearActiveDraft,
    _test: { draftKey: draftKey, captureControls: captureControls, restoreControls: restoreControls }
  };
})();
