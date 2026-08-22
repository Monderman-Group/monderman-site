(() => {
  const header = document.getElementById("siteHeader");
  if (header) {
    const nav = header.querySelector(".nav");
    if (nav) {
      const menus = [
        ["Platform", "Monderman_Platform_Brief.html", [
          ["Platform Brief", "Monderman_Platform_Brief.html"],
          ["How It Works", "index.html#approach"],
          ["Sample Reports", "sample-report.html"],
          ["ROI & Method", "roi.html"],
          ["AI Infrastructure", "deterministic-ai-infrastructure.html"]
        ]],
        ["Diagnostics", "diagnostics.html", [
          ["Diagnostics Overview", "diagnostics.html"],
          ["Operational Systems", "operational-systems-article.html"],
          ["Decision Velocity", "decision-velocity-article.html"],
          ["Structural Clarity", "structural-clarity-article.html"],
          ["Institutional Performance", "institutional-performance-article.html"]
        ]],
        ["Research", "research.html", [
          ["Research Library", "research.html"],
          ["The Culture Trap", "the-culture-trap.html"],
          ["Governing Complexity", "governing-complexity.html"],
          ["Designing for Decision Velocity", "designing-for-decision-velocity.html"],
          ["The Drift Problem", "the-drift-problem.html"],
          ["After the First Lap", "after-the-first-lap.html"]
        ]],
        ["Plans & Services", "platform-services.html", [
          ["Plans & Pricing", "platform-services.html"],
          ["Signal", "plan-signal.html"],
          ["Pattern", "plan-pattern.html"],
          ["Enterprise", "plan-enterprise.html"]
        ]],
        ["Company", "why-monderman.html", [
          ["Why Monderman", "why-monderman.html"],
          ["About", "about.html"],
          ["Security & Data Handling", "security.html"]
        ]]
      ];
      const menuMarkup = menus.map(([label, href, items]) =>
        `<div class="nav-menu"><a class="nav-parent" href="${href}" aria-haspopup="true" aria-expanded="false">${label}<span class="nav-chevron" aria-hidden="true"></span></a><div class="nav-dropdown">${items.map(([itemLabel, itemHref]) => `<a href="${itemHref}">${itemLabel}</a>`).join("")}</div></div>`
      ).join("");
      nav.innerHTML = `${menuMarkup}<a href="connect.html">Connect</a><button class="site-search-button" type="button" aria-label="Search Monderman" title="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"></circle><path d="m16 16 4.2 4.2"></path></svg></button><a class="workspace-link" href="workspace.html">Sign In</a>`;
      var closeMenus = (except) => nav.querySelectorAll(".nav-menu.is-open").forEach((menu) => {
        if (menu !== except) {
          menu.classList.remove("is-open");
          menu.querySelector(".nav-parent")?.setAttribute("aria-expanded", "false");
        }
      });
      nav.querySelectorAll(".nav-parent").forEach((parent) => {
        parent.addEventListener("click", (event) => {
          if (!window.matchMedia("(max-width: 760px)").matches) return;
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
          nav.querySelector(".nav-menu:focus-within .nav-parent")?.focus();
        }
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
      const loadIndex = () => searchIndex || (searchIndex = fetch("public-search-index.json?v=20260822-search1").then((response) => {
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
