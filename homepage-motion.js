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

})();
