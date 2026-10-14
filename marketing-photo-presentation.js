(() => {
  'use strict';
  const page = document.querySelector('body.photo-presentation');
  if (!page) return;
  const photos = [...page.querySelectorAll('[data-site-photo]')];
  if (!photos.length) return; // Homepage photographs retain their existing enhancement.
  const stylesReady = getComputedStyle(page).getPropertyValue('--mp-presentation-ready').trim() === '1';
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const preparePrint = () => photos.forEach(photo => { const image = photo.querySelector('img'); if (image) image.loading = 'eager'; });
  window.addEventListener('beforeprint', preparePrint);
  const printMedia = window.matchMedia?.('print');
  printMedia?.addEventListener?.('change', event => { if (event.matches) preparePrint(); });
  if (printMedia?.matches) preparePrint();
  for (const photo of photos) {
    const image = photo.querySelector('img'), picture = photo.querySelector('picture');
    if (!image || !picture) continue;
    const unavailable = () => {
      if (photo.hasAttribute('data-photo-unavailable')) return;
      photo.setAttribute('data-photo-unavailable', '');
      const message = document.createElement('span');
      message.className = 'mp-photo-fallback';
      message.textContent = 'Photograph unavailable';
      message.setAttribute('aria-hidden', 'true');
      picture.append(message);
    };
    image.addEventListener('error', unavailable, {once: true});
    if (image.complete && !image.naturalWidth) unavailable();
  }
  if (!stylesReady || reduced() || !('IntersectionObserver' in window) || typeof Element.prototype.animate !== 'function') return;
  try {
    const seen = new WeakSet();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        seen.add(entry.target);
        observer.unobserve(entry.target);
        if (reduced()) continue;
        try { entry.target.animate([{transform: 'translate3d(0,12px,0) scale(.985)'}, {transform: 'translate3d(0,0,0) scale(1)'}], {duration: 450, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'none'}); }
        catch { /* The complete photograph is already visible. */ }
      }
    }, {threshold: .12, rootMargin: '0px 0px -4% 0px'});
    photos.forEach(photo => observer.observe(photo));
  } catch { /* Missing observer support retains the usable static layout. */ }
})();
