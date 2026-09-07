(() => {
  document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach((link) => link.remove());
  const favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/svg+xml";
  favicon.href = "assets/brand/monderman-mark-v2-small.svg?v=20260906-enterprise1";
  document.head.appendChild(favicon);
  if (!document.querySelector('link[href^="assets/brand/brand-lockup.css"]')) {
    const brandStyles = document.createElement("link");
    brandStyles.rel = "stylesheet";
    brandStyles.href = "assets/brand/brand-lockup.css?v=20260824-wide1";
    document.head.appendChild(brandStyles);
  }
  const brandMark = '<svg class="monderman-lockup__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M6 9.2 11 5.75 16 8.3 21 5.75 26 9.2V26L21 23.2 16 26 11 23.2 6 26Z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 5.75V23.2M16 8.3V26M21 5.75V23.2" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const footerMotif = `<svg class="mf-map-outline" viewBox="5.5 5.25 21 21.25" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M6 9.2 11 5.75 16 8.3 21 5.75 26 9.2V26L21 23.2 16 26 11 23.2 6 26Z" />
    <path d="M11 5.75V23.2M16 8.3V26M21 5.75V23.2" />
  </svg>`;
  const restoreWordmarkPeriod = (name) => {
    if (!name) return;
    const value = name.textContent.trim();
    if (!/^Monderman\.*$/i.test(value)) return;
    if (name.querySelector(".monderman-lockup__period")) return;
    const word = document.createElement("span");
    word.className = "monderman-lockup__word";
    word.textContent = "Monderman";
    const period = document.createElement("span");
    period.className = "monderman-lockup__period";
    period.textContent = ".";
    name.replaceChildren(word, period);
  };
  const enhanceBrand = () => {
    document.querySelectorAll(".header .brand, #siteHeader .brand").forEach((brand) => {
      brand.classList.add("monderman-lockup");
      if (!brand.querySelector(".monderman-lockup__mark")) brand.insertAdjacentHTML("afterbegin", brandMark);
      let name = brand.querySelector(".monderman-lockup__name");
      const textNode = !name && [...brand.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode) {
        name = document.createElement("span");
        name.className = "monderman-lockup__name";
        name.textContent = textNode.textContent.trim();
        textNode.replaceWith(name);
      }
      brand.querySelectorAll(".brand-dot").forEach((dot) => dot.remove());
      restoreWordmarkPeriod(name);
    });
    document.querySelectorAll(".mond-footer .mf-mark-row").forEach((footerBrand) => {
      footerBrand.classList.add("monderman-lockup");
      if (!footerBrand.querySelector(".monderman-lockup__mark")) footerBrand.insertAdjacentHTML("afterbegin", brandMark);
      footerBrand.querySelectorAll(".mf-dot").forEach((dot) => dot.remove());
      restoreWordmarkPeriod(footerBrand.querySelector(".mf-name"));
      const footerPanel = footerBrand.closest(".mf-brand");
      if (footerPanel && !footerPanel.querySelector(".mf-tagline")) {
        const tagline = document.createElement("p");
        tagline.className = "mf-tagline";
        tagline.textContent = "See how work and decisions move.";
        footerBrand.insertAdjacentElement("afterend", tagline);
      }
    });
    document.querySelectorAll(".mond-footer .mf-copy").forEach((copy) => {
      copy.textContent = "Monderman provides repeatable organizational diagnostics for ownership, decisions, handoffs, and administrative work.";
    });
    document.querySelectorAll(".mond-footer .mf-inner").forEach((footerInner) => {
      let motif = footerInner.querySelector(".mf-motif");
      if (!motif) {
        motif = document.createElement("div");
        motif.className = "mf-motif";
        footerInner.appendChild(motif);
      }
      motif.setAttribute("aria-hidden", "true");
      motif.innerHTML = footerMotif;
    });
  };
  enhanceBrand();
  const setupRevealMotion = () => {
    const revealItems = [...document.querySelectorAll(".canonical-green-shell .reveal:not(.is-visible)")];
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!revealItems.length || reducedMotion || !("IntersectionObserver" in window)) return;
    let observer;
    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -7%" });
    } catch (_) {
      return;
    }
    revealItems.forEach((item) => item.classList.add("canonical-reveal"));
    document.documentElement.classList.add("canonical-reveal-ready");
    revealItems.forEach((item) => observer.observe(item));
  };
  setupRevealMotion();
  const header = document.getElementById("siteHeader");
  if (header) {
    const nav = header.querySelector(".nav");
    if (nav) {
      const menuButton = document.createElement("button");
      menuButton.className = "site-menu-button";
      menuButton.type = "button";
      menuButton.setAttribute("aria-label", "Open navigation");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
      nav.before(menuButton);
      const closeMobileNav = ({ restoreFocus = false } = {}) => {
        header.classList.remove("mobile-nav-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation");
        if (restoreFocus) menuButton.focus();
      };
      const widgetActions = document.createElement("div");
      widgetActions.className = "site-widget-actions";
      widgetActions.setAttribute("aria-label", "Contact and support");
      widgetActions.innerHTML = `
        <button class="site-widget-action" type="button" data-site-widget-action="contact" aria-label="Contact Monderman" title="Contact Monderman" aria-controls="mdn-cn-panel">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4 20-7z"></path></svg>
          <span>Contact</span>
        </button>
        <button class="site-widget-action" type="button" data-site-widget-action="assistant" aria-label="Open Monderman assistant" title="Open Monderman assistant" aria-controls="mnd-panel">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"></path></svg>
          <span>Assistant</span>
        </button>`;
      const widgetMount = nav.querySelector(".workspace-link");
      if (widgetMount) widgetMount.before(widgetActions);
      else nav.appendChild(widgetActions);
      const activateWidget = (selector) => {
        closeMobileNav();
        window.requestAnimationFrame(() => {
          const launcher = document.querySelector(selector);
          if (launcher) launcher.click();
        });
      };
      widgetActions.querySelector('[data-site-widget-action="contact"]').addEventListener("click", () => activateWidget(".mdn-cn-launch"));
      widgetActions.querySelector('[data-site-widget-action="assistant"]').addEventListener("click", () => activateWidget("#mnd-launcher"));
      menuButton.addEventListener("click", () => {
        const opening = !header.classList.contains("mobile-nav-open");
        header.classList.toggle("mobile-nav-open", opening);
        menuButton.setAttribute("aria-expanded", String(opening));
        menuButton.setAttribute("aria-label", opening ? "Close navigation" : "Open navigation");
        if (!opening) closeMenus();
      });
      var closeMenus = (except) => nav.querySelectorAll(".nav-menu.is-open").forEach((menu) => {
        if (menu !== except) {
          menu.classList.remove("is-open");
          menu.querySelector(".nav-parent")?.setAttribute("aria-expanded", "false");
        }
      });
      nav.querySelectorAll(".nav-parent").forEach((parent) => {
        parent.addEventListener("click", (event) => {
          if (!window.matchMedia("(max-width: 1180px)").matches) return;
          const menu = parent.closest(".nav-menu");
          if (!menu.classList.contains("is-open")) {
            event.preventDefault();
            closeMenus(menu);
            menu.style.setProperty("--nav-dropdown-top", `${Math.ceil(header.getBoundingClientRect().bottom + 6)}px`);
            menu.classList.add("is-open");
            parent.setAttribute("aria-expanded", "true");
          }
        });
      });
      document.addEventListener("click", (event) => { if (!nav.contains(event.target)) closeMenus(); });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeMenus();
          if (header.classList.contains("mobile-nav-open")) closeMobileNav({ restoreFocus: true });
          else nav.querySelector(".nav-menu:focus-within .nav-parent")?.focus();
        }
      });
      nav.addEventListener("click", (event) => {
        if (!window.matchMedia("(max-width: 1180px)").matches) return;
        const link = event.target.closest("a");
        if (link && !link.classList.contains("nav-parent")) closeMobileNav();
      });
    }
    const applyHeader = () => header.classList.toggle("scrolled", window.scrollY > 24);
    applyHeader();
    window.addEventListener("scroll", applyHeader, { passive: true });
    const current = location.pathname.split("/").pop() || "index.html";
    header.querySelectorAll(".nav a").forEach((link) => {
      const target = new URL(link.href, location.href).pathname.split("/").pop() || "index.html";
      link.classList.toggle("is-active", target === current && current !== "index.html");
    });
    header.querySelectorAll(".nav-menu").forEach((menu) => {
      if (menu.querySelector(".nav-dropdown .is-active")) menu.querySelector(".nav-parent")?.classList.add("is-active");
    });
    const searchButton = header.querySelector(".site-search-button");
    if (searchButton) {
      const overlay = document.createElement("div");
      overlay.className = "site-search-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Search Monderman");
      overlay.innerHTML = `<div class="site-search-panel"><div class="site-search-head"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"></circle><path d="m16 16 4.2 4.2"></path></svg><input class="site-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Search Monderman" aria-label="Search public pages"><button class="site-search-close" type="button" aria-label="Close search">&times;</button></div><p class="site-search-status">Search public Monderman pages.</p><ol class="site-search-results"></ol></div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector(".site-search-input");
      const status = overlay.querySelector(".site-search-status");
      const results = overlay.querySelector(".site-search-results");
      let searchIndex;
      const loadIndex = () => searchIndex || (searchIndex = fetch("public-search-index.json?v=20260906-enterprise1").then((response) => {
        if (!response.ok) throw new Error("Search index unavailable");
        return response.json();
      }));
      const words = (value) => value.toLocaleLowerCase().match(/[a-z0-9]+/g) || [];
      const excerpt = (text, queryWords) => {
        const lower = text.toLocaleLowerCase();
        const positions = queryWords.map((word) => lower.indexOf(word)).filter((position) => position >= 0);
        const center = positions.length ? Math.min(...positions) : 0;
        const start = Math.max(0, center - 85);
        const end = Math.min(text.length, start + 230);
        return `${start ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
      };
      const render = async () => {
        const query = input.value.trim();
        results.replaceChildren();
        if (query.length < 2) {
          status.textContent = "Type at least two characters. Results include public-page copy only.";
          return;
        }
        status.textContent = "Searching public pages…";
        try {
          const index = await loadIndex();
          const queryWords = [...new Set(words(query))];
          const matches = index.map((item) => {
            const title = item.title.toLocaleLowerCase();
            const headings = item.headings.toLocaleLowerCase();
            const text = item.text.toLocaleLowerCase();
            let score = 0;
            queryWords.forEach((word) => {
              if (title.includes(word)) score += 12;
              if (headings.includes(word)) score += 6;
              const occurrences = text.split(word).length - 1;
              score += Math.min(occurrences, 5);
            });
            if (queryWords.every((word) => text.includes(word) || title.includes(word) || headings.includes(word))) score += 8;
            return { item, score };
          }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title)).slice(0, 12);
          status.textContent = `${matches.length} result${matches.length === 1 ? "" : "s"} for “${query}”`;
          if (!matches.length) {
            const empty = document.createElement("li");
            empty.className = "site-search-empty";
            empty.textContent = "No matching public-page copy was found.";
            results.appendChild(empty);
          }
          matches.forEach(({ item }) => {
            const row = document.createElement("li");
            row.className = "site-search-result";
            const link = document.createElement("a");
            link.href = item.url;
            const title = document.createElement("span");
            title.className = "site-search-result-title";
            title.textContent = item.title;
            const meta = document.createElement("span");
            meta.className = "site-search-result-meta";
            meta.textContent = item.category;
            const snippet = document.createElement("span");
            snippet.className = "site-search-result-snippet";
            snippet.textContent = excerpt(item.text, queryWords);
            link.append(title, meta, snippet);
            row.appendChild(link);
            results.appendChild(row);
          });
        } catch (error) {
          status.textContent = "Search is temporarily unavailable.";
        }
      };
      let searchTimer;
      input.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(render, 90);
      });
      const openSearch = () => {
        closeMenus();
        overlay.classList.add("is-open");
        document.body.classList.add("site-search-locked");
        input.focus();
        loadIndex().catch(() => {});
      };
      const closeSearch = () => {
        overlay.classList.remove("is-open");
        document.body.classList.remove("site-search-locked");
        searchButton.focus();
      };
      searchButton.addEventListener("click", openSearch);
      overlay.querySelector(".site-search-close").addEventListener("click", closeSearch);
      overlay.addEventListener("click", (event) => { if (event.target === overlay) closeSearch(); });
      document.addEventListener("keydown", (event) => {
        if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
          event.preventDefault();
          openSearch();
        } else if (event.key === "Escape" && overlay.classList.contains("is-open")) {
          closeSearch();
        } else if (event.key === "ArrowDown" && overlay.classList.contains("is-open")) {
          const first = results.querySelector("a");
          if (first) { event.preventDefault(); first.focus(); }
        }
      });
      results.addEventListener("keydown", (event) => {
        if (!/^Arrow(Down|Up)$/.test(event.key)) return;
        const links = [...results.querySelectorAll("a")];
        const position = links.indexOf(document.activeElement);
        const next = event.key === "ArrowDown" ? links[position + 1] : links[position - 1];
        if (next) { event.preventDefault(); next.focus(); }
        else if (event.key === "ArrowUp") { event.preventDefault(); input.focus(); }
      });
    }
  }
  const ensureWidgetScript = (prefix, source) => {
    if (document.querySelector(`script[src^="${prefix}"]`)) return;
    const script = document.createElement("script");
    script.src = source;
    script.defer = true;
    document.body.appendChild(script);
  };
  const ensurePublicWidgets = () => {
    if (!document.body.classList.contains("canonical-green-shell")) return;
    ensureWidgetScript("assistant.js", "assistant.js?v=20260906-shell1");
    ensureWidgetScript("connect-widget.js", "connect-widget.js?v=20260906-shell1");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensurePublicWidgets, { once: true });
  else ensurePublicWidgets();
})();
