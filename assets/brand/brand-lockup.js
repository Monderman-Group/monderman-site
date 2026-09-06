(() => {
  const mark = '<svg class="monderman-lockup__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M12 18.4L22 11.5L32 16.6L42 11.5L52 18.4V52L42 46.4L32 52L22 46.4L12 52Z" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 11.5V46.4M32 16.6V52M42 11.5V46.4" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const restoreWordmarkPeriod = (name) => {
    if (!name) return;
    const value = name.textContent.trim();
    if (!/^Monderman\.*$/i.test(value) || name.querySelector('.monderman-lockup__period')) return;
    const word = document.createElement('span');
    word.className = 'monderman-lockup__word';
    word.textContent = 'Monderman';
    const period = document.createElement('span');
    period.className = 'monderman-lockup__period';
    period.textContent = '.';
    name.replaceChildren(word, period);
  };
  function enhance(root = document) {
    root.querySelectorAll('.brand,.ws5-brand').forEach((brand) => {
      let name = brand.querySelector('.monderman-lockup__name') || brand.querySelector('b') || [...brand.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (!name) return;
      brand.classList.add('monderman-lockup');
      if (!brand.querySelector('.monderman-lockup__mark')) brand.insertAdjacentHTML('afterbegin', mark);
      if (name.nodeType === Node.TEXT_NODE) {
        const span = document.createElement('span');
        span.className = 'monderman-lockup__name';
        span.textContent = name.textContent.trim();
        name.replaceWith(span);
        name = span;
      } else {
        name.classList.add('monderman-lockup__name');
      }
      brand.querySelectorAll('.brand-dot,.ws5-brand-dot').forEach((dot) => dot.remove());
      restoreWordmarkPeriod(name);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance());
  else enhance();
  window.mondermanEnhanceBrandLockups = enhance;
})();
