(() => {
  const mark = '<svg class="monderman-lockup__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M9.5 15L20.75 8L32 14L43.25 8L54.5 15V56L43.25 49L32 55L20.75 49L9.5 56Z" stroke-width="2.8" stroke-linejoin="round"/><path d="M20.75 8V49M32 14V55M43.25 8V49" stroke-width="2.4" stroke-linecap="round"/></svg>';
  function enhance(root = document) {
    root.querySelectorAll('.brand,.ws5-brand').forEach((brand) => {
      if (brand.querySelector('.monderman-lockup__mark')) return;
      const name = brand.querySelector('b') || [...brand.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (!name) return;
      brand.classList.add('monderman-lockup');
      brand.insertAdjacentHTML('afterbegin', mark);
      if (name.nodeType === Node.TEXT_NODE) {
        const span = document.createElement('span');
        span.className = 'monderman-lockup__name';
        span.textContent = name.textContent.trim();
        name.replaceWith(span);
      } else {
        name.classList.add('monderman-lockup__name');
      }
      brand.querySelectorAll('.brand-dot,.ws5-brand-dot').forEach((dot) => dot.remove());
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance());
  else enhance();
  window.mondermanEnhanceBrandLockups = enhance;
})();
