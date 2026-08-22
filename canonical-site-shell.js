(() => {
  const header = document.getElementById("siteHeader");
  if (header) {
    const applyHeader = () => header.classList.toggle("scrolled", window.scrollY > 24);
    applyHeader();
    window.addEventListener("scroll", applyHeader, { passive: true });
    const current = location.pathname.split("/").pop() || "index.html";
    header.querySelectorAll(".nav a").forEach((link) => {
      const target = new URL(link.href, location.href).pathname.split("/").pop() || "index.html";
      link.classList.toggle("is-active", target === current && current !== "index.html");
    });
  }
})();
