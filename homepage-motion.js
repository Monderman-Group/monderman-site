(() => {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const premiumMotionItems = [...document.querySelectorAll([
    ".proof-card",
    ".mxidx-cell",
    ".systems-analysis-card",
    ".approach-card",
    ".first-run-moment",
    ".loop-step",
    ".book-jacket",
    ".connect-choice-card"
  ].join(","))];
  const revealItems = [...document.querySelectorAll(".reveal")];
  const motionItems = [...new Set([...revealItems, ...premiumMotionItems])];

  premiumMotionItems.forEach((item, index) => {
    item.classList.add("home-motion");
    item.style.setProperty("--home-motion-delay", `${(index % 4) * 65}ms`);
  });

  if (motionItems.length && "IntersectionObserver" in window && !reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -7% 0px" });
    document.body.classList.add("home-motion-ready");
    motionItems.forEach((item) => observer.observe(item));
    window.setTimeout(() => {
      motionItems.forEach((item) => item.classList.add("is-visible"));
    }, 2600);
  } else {
    motionItems.forEach((item) => item.classList.add("is-visible"));
  }

  const motionSections = [...document.querySelectorAll([
    "#main-content > .proof-band",
    "#main-content > .mxidx-band",
    "#main-content > .systems-analysis-bridge",
    "#main-content > .approach",
    "#main-content > .first-run-moments",
    "#main-content > .measurement-loop",
    "#main-content > .book-band",
    "#main-content > .latest",
    "#main-content > .connect"
  ].join(","))];

  motionSections.forEach((section) => {
    if (section.querySelector(":scope > .home-section-rule")) return;
    const rule = document.createElement("span");
    rule.className = "home-section-rule";
    rule.setAttribute("aria-hidden", "true");
    section.prepend(rule);
  });

  if (motionSections.length && "IntersectionObserver" in window && !reducedMotion) {
    const ruleObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-rule-visible");
        ruleObserver.unobserve(entry.target);
      });
    }, { threshold: 0.04, rootMargin: "0px 0px -12% 0px" });
    motionSections.forEach((section) => ruleObserver.observe(section));
  } else {
    motionSections.forEach((section) => section.classList.add("is-rule-visible"));
  }

  const heroRouteField = document.querySelector(".hero-route-field");
  if (heroRouteField && !reducedMotion) {
    let frame = 0;
    const updateHeroMotion = () => {
      frame = 0;
      const heroHeight = document.querySelector(".hero")?.offsetHeight || 720;
      const drift = Math.min(window.scrollY, heroHeight) * 0.022;
      heroRouteField.style.setProperty("--hero-drift", `${drift.toFixed(2)}px`);
    };
    window.addEventListener("scroll", () => {
      if (!frame) frame = window.requestAnimationFrame(updateHeroMotion);
    }, { passive: true });
    updateHeroMotion();
  }
})();
