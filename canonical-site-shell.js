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
          ["Enterprise", "plan-enterprise.html"],
          ["Advisory Services", "advisory-services.html"]
        ]]
      ];
      const menuMarkup = menus.map(([label, href, items]) =>
        `<div class="nav-menu"><a class="nav-parent" href="${href}" aria-haspopup="true" aria-expanded="false">${label}<span class="nav-chevron" aria-hidden="true"></span></a><div class="nav-dropdown">${items.map(([itemLabel, itemHref]) => `<a href="${itemHref}">${itemLabel}</a>`).join("")}</div></div>`
      ).join("");
      nav.innerHTML = `${menuMarkup}<a href="why-monderman.html">Why Monderman</a><a href="about.html">About</a><a href="connect.html">Connect</a><a class="workspace-link" href="workspace.html">Sign In</a>`;
      const closeMenus = (except) => nav.querySelectorAll(".nav-menu.is-open").forEach((menu) => {
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
  }
})();
