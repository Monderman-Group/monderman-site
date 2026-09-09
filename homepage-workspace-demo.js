/* A public, local-only tour. Selecting steps never reads or changes a workspace. */
(() => {
  const app = document.querySelector('[data-workspace-demo]');
  if (!app) return;
  const tabs = [...app.querySelectorAll('[role="tab"]')];
  const panels = [...app.querySelectorAll('[role="tabpanel"]')];
  function select(tab, focus = false, reveal = false) {
    if (!tabs.includes(tab)) return;
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.id !== tab.getAttribute('aria-controls'); });
    if (focus) tab.focus({ preventScroll: true });
    if (reveal) {
      const row = app.querySelector('[role="tablist"]');
      const headerBottom = document.querySelector('#siteHeader')?.getBoundingClientRect().bottom || 0;
      if (row.getBoundingClientRect().top < headerBottom + 12) {
        row.style.scrollMarginTop = `${Math.max(0, headerBottom) + 12}px`;
        row.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[next], true);
    });
  });
  app.querySelectorAll('[data-demo-next]').forEach((button) => {
    button.addEventListener('click', () => {
      select(app.querySelector(`#hwd-tab-${button.dataset.demoNext}`), true, true);
    });
  });
})();
