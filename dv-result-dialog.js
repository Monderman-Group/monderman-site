/* Accessible, viewport-safe result dialog for the Decision Velocity first run. */
(function (window, document) {
  "use strict";

  if (window.MondermanDVResultDialog) return;

  var active = null;
  var serial = 0;

  var FOCUSABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    "audio[controls]",
    "video[controls]",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  function isElement(value) {
    return Boolean(value && value.nodeType === 1);
  }

  function isUsableFocusTarget(element, container) {
    if (!isElement(element) || !container.contains(element)) return false;
    if (element.matches(":disabled, [aria-hidden='true']")) return false;
    if (element.closest("[inert]")) return false;
    var style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function focusableElements(container) {
    return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(function (element) {
      return (!element.hasAttribute("tabindex") || element.tabIndex >= 0) && isUsableFocusTarget(element, container);
    });
  }

  function focusWithoutScroll(element) {
    if (!element || typeof element.focus !== "function") return;
    try {
      element.focus({ preventScroll: true });
    } catch (_error) {
      element.focus();
    }
  }

  function resolveTarget(target, state) {
    if (typeof target === "function") {
      try { target = target(state.panel, state.contentHost); } catch (_error) { target = null; }
    }
    if (typeof target === "string") return state.panel.querySelector(target);
    return isElement(target) ? target : null;
  }

  function rememberAndInert(element, state) {
    if (!isElement(element) || element === state.backdrop || state.backdrop.contains(element) || state.background.has(element)) return;

    var supportsInert = "inert" in element;
    state.background.set(element, {
      supportsInert: supportsInert,
      inertProperty: supportsInert ? element.inert : false,
      hadInertAttribute: element.hasAttribute("inert"),
      inertAttribute: element.getAttribute("inert"),
      hadAriaHidden: element.hasAttribute("aria-hidden"),
      ariaHidden: element.getAttribute("aria-hidden")
    });

    if (supportsInert) element.inert = true;
    element.setAttribute("inert", "");
    element.setAttribute("aria-hidden", "true");
  }

  function inertBackground(state) {
    Array.prototype.forEach.call(document.body.children, function (element) {
      rememberAndInert(element, state);
    });

    state.backgroundObserver = new MutationObserver(function (records) {
      records.forEach(function (record) {
        Array.prototype.forEach.call(record.addedNodes, function (node) {
          if (isElement(node)) rememberAndInert(node, state);
        });
      });
    });
    state.backgroundObserver.observe(document.body, { childList: true });
  }

  function restoreBackground(state) {
    if (state.backgroundObserver) state.backgroundObserver.disconnect();
    state.background.forEach(function (saved, element) {
      if (saved.supportsInert) element.inert = saved.inertProperty;
      if (saved.hadInertAttribute) element.setAttribute("inert", saved.inertAttribute || "");
      else element.removeAttribute("inert");

      if (saved.hadAriaHidden) element.setAttribute("aria-hidden", saved.ariaHidden == null ? "" : saved.ariaHidden);
      else element.removeAttribute("aria-hidden");
    });
    state.background.clear();
  }

  function restoreMovedContent(state) {
    if (!state.movedContent) return;
    if (state.contentPlaceholder && state.contentPlaceholder.parentNode) {
      state.contentPlaceholder.parentNode.insertBefore(state.movedContent, state.contentPlaceholder);
      state.contentPlaceholder.parentNode.removeChild(state.contentPlaceholder);
    } else {
      state.detachedHome.appendChild(state.movedContent);
    }
  }

  function restoreOpenAttribute(state) {
    if (state.hadOpenAttribute) {
      document.documentElement.setAttribute("data-dv-result-dialog-open", state.openAttribute == null ? "" : state.openAttribute);
    } else {
      document.documentElement.removeAttribute("data-dv-result-dialog-open");
    }
  }

  function restorePageScroll(state) {
    document.body.style.overflow = state.bodyOverflow;
    document.body.style.paddingRight = state.bodyPaddingRight;
  }

  function close(reason, settings) {
    if (!active) return false;
    var state = active;
    active = null;
    settings = settings || {};

    state.backdrop.removeEventListener("keydown", state.onKeyDown);
    document.removeEventListener("keydown", state.onDocumentKeyDown, true);
    state.backdrop.removeEventListener("click", state.onBackdropClick);
    document.removeEventListener("focusin", state.onFocusIn, true);

    restoreMovedContent(state);
    if (state.backdrop.parentNode) state.backdrop.parentNode.removeChild(state.backdrop);
    restoreBackground(state);
    restorePageScroll(state);
    restoreOpenAttribute(state);

    if (settings.restoreFocus !== false) {
      var returnTarget = resolveTarget(state.options.returnFocus, state) || state.previousFocus;
      if (returnTarget && returnTarget.isConnected && !returnTarget.closest("[inert]")) focusWithoutScroll(returnTarget);
    }

    document.dispatchEvent(new CustomEvent("monderman:dv-result-dialog-closed", {
      detail: { reason: reason || "api" }
    }));

    if (typeof state.options.onClose === "function") {
      try { state.options.onClose(reason || "api", state.controller); }
      catch (error) { window.setTimeout(function () { throw error; }, 0); }
    }
    return true;
  }

  function open(options) {
    options = options || {};
    if (options.content == null) throw new TypeError("MondermanDVResultDialog.open requires content.");

    var previousFocus = document.activeElement;
    if (active) {
      previousFocus = active.previousFocus;
      close("replace", { restoreFocus: false });
    }

    serial += 1;
    var titleId = "dv-result-dialog-title-" + serial;
    var state = {
      options: options,
      previousFocus: previousFocus,
      background: new Map(),
      backgroundObserver: null,
      movedContent: null,
      contentPlaceholder: null,
      detachedHome: document.createDocumentFragment(),
      hadOpenAttribute: document.documentElement.hasAttribute("data-dv-result-dialog-open"),
      openAttribute: document.documentElement.getAttribute("data-dv-result-dialog-open"),
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight
    };

    var backdrop = document.createElement("div");
    backdrop.className = "dv-result-dialog__backdrop";
    backdrop.setAttribute("data-dv-result-dialog", "");

    var panel = document.createElement("section");
    panel.className = "dv-result-dialog__panel" + (options.panelClass ? " " + String(options.panelClass) : "");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("tabindex", "-1");

    var header = document.createElement("header");
    header.className = "dv-result-dialog__header";

    var heading = document.createElement("h2");
    heading.className = "dv-result-dialog__title" + (options.headingHidden ? " dv-result-dialog__title--visually-hidden" : "");
    heading.id = titleId;
    heading.textContent = options.label || "Your Decision Velocity result";
    header.appendChild(heading);
    panel.setAttribute("aria-labelledby", options.labelledBy || titleId);

    var dismissible = options.dismissible !== false;
    if (dismissible) {
      var closeButton = document.createElement("button");
      closeButton.className = "dv-result-dialog__close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", options.closeLabel || "Close result dialog");
      closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
      closeButton.addEventListener("click", function () { close("button"); });
      header.appendChild(closeButton);
      state.closeButton = closeButton;
    }

    var scroll = document.createElement("div");
    scroll.className = "dv-result-dialog__scroll";
    scroll.setAttribute("data-dv-result-dialog-scroll", "");

    var contentHost = document.createElement("div");
    contentHost.className = "dv-result-dialog__content";
    scroll.appendChild(contentHost);
    panel.appendChild(header);
    panel.appendChild(scroll);
    backdrop.appendChild(panel);

    state.backdrop = backdrop;
    state.panel = panel;
    state.contentHost = contentHost;

    if (isElement(options.content)) {
      state.movedContent = options.content;
      if (options.content.parentNode) {
        state.contentPlaceholder = document.createComment("Decision Velocity result returns here");
        options.content.parentNode.insertBefore(state.contentPlaceholder, options.content);
      }
      contentHost.appendChild(options.content);
    } else {
      contentHost.innerHTML = String(options.content);
    }

    if (options.describedBy) panel.setAttribute("aria-describedby", String(options.describedBy));

    state.controller = {
      close: function (reason) { return close(reason || "controller"); },
      focus: function () { focusWithoutScroll(panel); },
      isOpen: function () { return active === state; },
      element: panel,
      content: state.movedContent || contentHost
    };

    state.onKeyDown = function (event) {
      if (active !== state) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (dismissible && options.escapeCloses !== false) close("escape");
        else focusWithoutScroll(resolveTarget(options.initialFocus, state) || panel);
        return;
      }

      if (event.key === "Tab") {
        var focusable = focusableElements(panel);
        event.preventDefault();
        if (!focusable.length) {
          focusWithoutScroll(panel);
        } else {
          // Safari's default Tab traversal can skip links entirely. Own every
          // step, not only endpoint wrapping, using the current usable actions.
          var currentIndex = focusable.indexOf(document.activeElement);
          var nextIndex = currentIndex < 0
            ? (event.shiftKey ? focusable.length - 1 : 0)
            : (currentIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
          // Keyboard navigation must also reveal offscreen actions within the
          // scroll region. Initial/return focus keep their preventScroll policy.
          focusable[nextIndex].focus();
        }
      }

      // Keep the diagnostic's document-level keyboard shortcuts from running
      // while a result action has focus. Native control behavior still occurs.
      event.stopPropagation();
    };

    state.onFocusIn = function (event) {
      if (active !== state || state.backdrop.contains(event.target)) return;
      focusWithoutScroll(resolveTarget(options.initialFocus, state) || panel);
    };

    state.onDocumentKeyDown = function (event) {
      // Removing the focused action can put focus on body without a focusin
      // event. Recover Tab/Escape there while preserving normal target handlers
      // for key events that already originate inside the dialog.
      if (active !== state || state.backdrop.contains(event.target)) return;
      if (event.key === "Tab" || event.key === "Escape") state.onKeyDown(event);
    };

    state.onBackdropClick = function (event) {
      if (event.target === backdrop && options.closeOnBackdrop === true && dismissible) close("backdrop");
    };

    backdrop.addEventListener("keydown", state.onKeyDown);
    document.addEventListener("keydown", state.onDocumentKeyDown, true);
    backdrop.addEventListener("click", state.onBackdropClick);
    document.addEventListener("focusin", state.onFocusIn, true);

    document.body.appendChild(backdrop);
    active = state;

    var scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (scrollbarGap > 0) {
      var existingPadding = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = existingPadding + scrollbarGap + "px";
    }
    document.body.style.overflow = "hidden";
    document.documentElement.setAttribute("data-dv-result-dialog-open", "true");

    var initialFocus = resolveTarget(options.initialFocus, state);
    if (!isUsableFocusTarget(initialFocus, panel)) initialFocus = panel;
    focusWithoutScroll(initialFocus);
    inertBackground(state);

    document.dispatchEvent(new CustomEvent("monderman:dv-result-dialog-opened", {
      detail: { controller: state.controller }
    }));

    if (typeof options.onOpen === "function") options.onOpen(state.controller);
    return state.controller;
  }

  window.MondermanDVResultDialog = {
    open: open,
    close: function (reason) { return close(reason || "api"); },
    isOpen: function () { return Boolean(active); },
    getDialog: function () { return active ? active.panel : null; },
    version: "1.0.0"
  };
})(window, document);
