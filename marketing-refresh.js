/* A presentation-only lens selector. No data collection or scoring. */
(() => {
  const demo = document.querySelector('body.marketing-refresh [data-lens-demo]');
  if (!demo) return;
  const tabs = [...demo.querySelectorAll('[data-lens-choice]')];
  const panels = [...demo.querySelectorAll('[data-lens-panel]')];
  const tablist = demo.querySelector('[data-lens-tabs]');
  if (!tablist || tabs.length !== 4 || panels.length !== 4 ||
      tabs.some((tab, index) => tab.hash !== '#' + panels[index].id ||
        tab.dataset.lensChoice !== panels[index].dataset.lensPanel)) return;

  const select = (index, moveFocus = false) => {
    tabs.forEach((tab, position) => {
      const selected = position === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[position].hidden = !selected;
    });
    if (moveFocus) tabs[index].focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', event => {
      event.preventDefault();
      select(index);
    });
    tab.addEventListener('keydown', event => {
      if (event.key === ' ') {
        event.preventDefault();
        select(index);
        return;
      }
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next, true);
    });
  });
  tablist.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panels[index].id);
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].tabIndex = 0;
  });
  select(0);
  demo.setAttribute('data-enhanced', '');
})();
