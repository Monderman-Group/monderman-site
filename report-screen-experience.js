/* Existing direct-result sections, made reachable without scrolling the full read. */
(function () {
  "use strict";
  function mount() {
    const stage = document.getElementById("resultsStage");
    const layout = stage && stage.querySelector(".results-layout");
    if (!layout || layout.querySelector(".rsx-nav")) return;
    const destinations = [
      ["Overview", ".score-panel"],
      ["Dimensions", '[data-accordion="detail"]'],
      ["Evidence", '[data-accordion="experience"]'],
      ["Actions", '[data-accordion="remedy"]'],
      ["Export", '[data-accordion="export"]']
    ];
    const nav = document.createElement("nav");
    // Direct HTML exports already remove accordion-toolbar elements. Reuse
    // that boundary so these controls never enter a downloaded report.
    nav.className = "rsx-nav accordion-toolbar";
    nav.setAttribute("aria-label", "Explore this result");
    const label = document.createElement("span");
    label.textContent = "Explore your result";
    nav.appendChild(label);
    destinations.forEach(([name, selector]) => {
      const target = stage.querySelector(selector);
      if (!target) return;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.addEventListener("click", () => {
        const header = target.querySelector(".accordion-header");
        // Use the existing accordion's own expansion handler.
        if (header && header.getAttribute("aria-expanded") !== "true" && !target.classList.contains("open")) header.click();
        target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        const focusTarget = header || target;
        if (!header && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        focusTarget.focus({ preventScroll: true });
      });
      const sync = () => {
        button.hidden = target.hidden || target.classList.contains("hidden") || window.getComputedStyle(target).display === "none";
      };
      new MutationObserver(sync).observe(target, { attributes:true, attributeFilter:["hidden", "class", "style"] });
      sync();
      nav.appendChild(button);
    });
    if (nav.querySelector("button")) layout.prepend(nav);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once:true });
  else mount();
})();
