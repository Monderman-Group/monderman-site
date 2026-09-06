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
  const footerMotif = `<svg class="mf-route-map" viewBox="0 0 720 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path class="mf-route-map__construction" d="M26 240H694" />
    <path class="mf-route-map__route" d="M26 222H130V190H240V152H350V118H438V98.656H524.08" />
    <circle class="mf-route-map__node" cx="350" cy="118" r="3.25" />
    <g class="mf-route-map__fold" transform="translate(478 28) scale(.24)">
      <path d="M192 294.4 352 184 512 265.6 672 184 832 294.4V832L672 742.4 512 832 352 742.4 192 832Z" />
      <path d="M352 184V742.4M512 265.6V832M672 184V742.4" />
    </g>
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
    document.querySelectorAll(".mond-footer .mf-motif").forEach((motif) => {
      motif.setAttribute("aria-hidden", "true");
      motif.innerHTML = footerMotif;
    });
    document.querySelectorAll(".mond-footer .mf-nav").forEach((footerNav) => {
      footerNav.innerHTML = `
        <div class="mf-col">
          <p class="mf-col-title">Platform</p>
          <a href="Monderman_Platform_Brief.html">Platform overview</a>
          <a href="diagnostics.html">Diagnostics</a>
          <a href="workspace.html">Workspace</a>
          <a href="sample-report.html">Sample reports</a>
          <a href="platform-services.html">Plans and pricing</a>
        </div>
        <div class="mf-col">
          <p class="mf-col-title">Company</p>
          <a href="why-monderman.html">Why Monderman</a>
          <a href="about.html">About</a>
          <a href="research.html">Research</a>
          <a href="connect.html">Contact</a>
        </div>
        <div class="mf-col">
          <p class="mf-col-title">Trust</p>
          <a href="security.html">Security</a>
          <a href="subprocessors.html">Subprocessors</a>
          <a href="privacy.html">Privacy</a>
          <a href="terms.html">Terms</a>
        </div>`;
    });
  };
  enhanceBrand();
  const header = document.getElementById("siteHeader");
  if (header) {
    const nav = header.querySelector(".nav");
    if (nav) {
      const menus = [
        ["Platform", "Monderman_Platform_Brief.html", [
          ["Platform Overview", "Monderman_Platform_Brief.html"],
          ["Diagnostics", "diagnostics.html"],
          ["Workspace", "workspace.html"],
          ["Synthesis", "Monderman_Platform_Brief.html#slide-6"],
          ["Sample Reports", "sample-report.html"],
          ["Method and ROI", "roi.html"],
          ["AI Infrastructure", "deterministic-ai-infrastructure.html"]
        ]],
        ["Solutions", "new-in-the-role.html", [
          ["New in the Role", "new-in-the-role.html"],
          ["After an Acquisition", "after-an-acquisition.html"],
          ["Transformation Behind Schedule", "transformation-behind-schedule.html"],
          ["After a Reorganization", "after-a-reorganization.html"]
        ]],
        ["Research", "research.html", [
          ["Research Library", "research.html"],
          ["The Unmeasured Layer", "the-unmeasured-layer.html"],
          ["The Culture Trap", "the-culture-trap.html"],
          ["Governing Complexity", "governing-complexity.html"],
          ["Designing for Decision Velocity", "designing-for-decision-velocity.html"],
          ["Founder and Book", "about.html"]
        ]],
        ["Pricing", "platform-services.html", [
          ["Plans and Pricing", "platform-services.html"],
          ["Signal", "plan-signal.html"],
          ["Pattern", "plan-pattern.html"],
          ["Enterprise", "plan-enterprise.html"]
        ]],
        ["Company", "why-monderman.html", [
          ["Why Monderman", "why-monderman.html"],
          ["About", "about.html"],
          ["Trust and Security", "security.html"],
          ["Subprocessors", "subprocessors.html"],
          ["Contact", "connect.html"]
        ]]
      ];
      const menuMarkup = menus.map(([label, href, items]) =>
        `<div class="nav-menu"><a class="nav-parent" href="${href}" aria-haspopup="true" aria-expanded="false">${label}<span class="nav-chevron" aria-hidden="true"></span></a><div class="nav-dropdown">${items.map(([itemLabel, itemHref]) => `<a href="${itemHref}">${itemLabel}</a>`).join("")}</div></div>`
      ).join("");
      nav.innerHTML = `${menuMarkup}<a class="site-trust-link" href="security.html">Trust</a><button class="site-search-button" type="button" aria-label="Search Monderman" title="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"></circle><path d="m16 16 4.2 4.2"></path></svg></button><a class="workspace-link" href="workspace.html">Sign In</a><a class="site-entry-link" href="decision-velocity.html?source=header" data-first-run-event="decision_velocity_started">Run Decision Velocity free</a>`;
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
})();
