/* Presentation only: visible motion and inspection of the existing example. */
(() => {
  const page = document.querySelector('body.homepage-enterprise.marketing-refresh');
  if (!page) return;
  const stylesReady = getComputedStyle(page).getPropertyValue('--mc-enhancement-style').trim() === '1';
  let preference;
  try { preference = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { /* Static is the fallback. */ }
  const reduced = () => !preference || preference.matches;
  const active = new Set();
  const animate = (element, frames, duration, kind) => {
    if (!stylesReady || reduced() || typeof element.animate !== 'function') return;
    try {
      const animation = element.animate(frames, {duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'none'});
      if (!animation?.finished || typeof animation.cancel !== 'function') return;
      active.add(animation);
      element.dataset.mcMotionKind = kind;
      element.dataset.mcMotionDuration = String(duration);
      element.dataset.mcMotionState = 'running';
      animation.finished.then(() => {
        element.dataset.mcMotionState = 'settled';
      }, () => {
        element.dataset.mcMotionState = 'static';
      }).finally(() => active.delete(animation));
      return animation;
    } catch {
      element.dataset.mcMotionState = 'static';
    }
  };
  preference?.addEventListener?.('change', () => {
    if (reduced()) for (const animation of active) animation.cancel();
  });

  const photos = [...page.querySelectorAll('[data-marketing-photo]')];
  const preparePrintPhotos = () => {
    for (const figure of photos) {
      const image = figure.querySelector('img');
      if (image) image.loading = 'eager';
    }
  };
  const printMedia = window.matchMedia?.('print');
  printMedia?.addEventListener?.('change', event => { if (event.matches) preparePrintPhotos(); });
  if (printMedia?.matches) preparePrintPhotos();
  for (const figure of photos) {
    const image = figure.querySelector('img');
    const picture = figure.querySelector('picture');
    if (!image || !picture) continue;
    const width = Number(image.getAttribute('width'));
    const height = Number(image.getAttribute('height'));
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      picture.style.aspectRatio = `${width} / ${height}`;
    }
    const unavailable = () => {
      if (figure.hasAttribute('data-photo-unavailable')) return;
      figure.setAttribute('data-photo-unavailable', '');
      const label = document.createElement('span');
      label.className = 'mc-photo-fallback';
      label.textContent = 'Photograph unavailable';
      label.setAttribute('aria-hidden', 'true');
      picture.append(label);
    };
    image.addEventListener('error', unavailable, {once: true});
    if (image.complete && !image.naturalWidth) unavailable();
  }

  // Nothing is hidden before an observer or animation succeeds. An absent or
  // broken enhancement leaves the complete original page readable.
  const visuals = [...new Set([
    ...photos,
    ...page.querySelectorAll('.mr-proof-composition, .home-workspace-preview, .mr-scenario-intro h2, .home-output-copy h2, .mc-human-copy h2')
  ])];
  if (stylesReady && !reduced() && 'IntersectionObserver' in window) {
    try {
      const seen = new WeakSet();
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          observer.unobserve(entry.target);
          const isPhoto = entry.target.hasAttribute('data-marketing-photo');
          animate(entry.target, [
            {transform: isPhoto ? 'translate3d(0,12px,0) scale(.985)' : 'translate3d(0,12px,0)'},
            {transform: 'translate3d(0,0,0) scale(1)'}
          ], 450, isPhoto ? 'photograph' : 'product-or-heading');
        }
      }, {threshold: .12, rootMargin: '0px 0px -4% 0px'});
      visuals.forEach(element => observer.observe(element));
    } catch { /* All content is already visible without the observer. */ }
  }

  const lenses = page.querySelector('[data-lens-demo]');
  if (lenses) {
    const panels = [...lenses.querySelectorAll('[data-lens-panel]')];
    let previous = panels.find(panel => !panel.hidden);
    let transition;
    const entered = event => {
      if (!event.target.closest('[data-lens-choice]') || !lenses.hasAttribute('data-enhanced')) return;
      const selected = panels.find(panel => !panel.hidden);
      if (!selected || selected === previous) return;
      previous = selected;
      transition?.cancel();
      transition = animate(selected, [
        {transform: 'translate3d(0,6px,0)'},
        {transform: 'translate3d(0,0,0)'}
      ], 180, 'selected-lens');
    };
    lenses.addEventListener('click', entered);
    lenses.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' '].includes(event.key)) entered(event);
    });
  }

  const preview = page.querySelector('.home-workspace-preview');
  const output = page.querySelector('.home-output-inner');
  if (!preview || !output || typeof HTMLDialogElement === 'undefined' ||
      !stylesReady) return;
  const dialog = document.createElement('dialog');
  if (typeof dialog.showModal !== 'function') return;
  dialog.className = 'mc-product-dialog';
  dialog.setAttribute('aria-labelledby', 'mc-expanded-title');
  dialog.setAttribute('aria-describedby', 'mc-expanded-note');
  const header = document.createElement('div');
  header.className = 'mc-dialog-header';
  const heading = document.createElement('div');
  const title = document.createElement('h2');
  title.id = 'mc-expanded-title';
  title.textContent = 'Illustrative product example';
  const note = document.createElement('p');
  note.id = 'mc-expanded-note';
  note.textContent = 'Example data · Not customer results';
  heading.append(title, note);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'mc-dialog-close';
  close.textContent = 'Return to page';
  header.append(heading, close);
  const host = document.createElement('div');
  host.className = 'mc-dialog-content';
  dialog.append(header, host);
  output.append(dialog);
  const controls = document.createElement('div');
  controls.className = 'mc-example-controls';
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'mc-expand-example';
  expand.textContent = 'Expand product example';
  expand.setAttribute('aria-haspopup', 'dialog');
  controls.append(expand);
  preview.before(controls);
  let placeholder;
  let returnFocus;
  const restore = () => {
    if (!placeholder) return;
    placeholder.replaceWith(preview);
    placeholder = undefined;
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
    returnFocus = undefined;
  };
  expand.addEventListener('click', () => {
    if (dialog.open || placeholder) return;
    returnFocus = expand;
    const rect = preview.getBoundingClientRect();
    const style = getComputedStyle(preview);
    placeholder = document.createElement('div');
    placeholder.className = 'mc-preview-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.height = rect.height + 'px';
    placeholder.style.marginTop = style.marginTop;
    placeholder.style.marginBottom = style.marginBottom;
    preview.before(placeholder);
    host.append(preview);
    dialog.returnValue = '';
    try {
      dialog.showModal();
      close.focus({preventScroll: true});
      animate(dialog, [{transform: 'translate3d(0,8px,0) scale(.992)'}, {transform: 'translate3d(0,0,0) scale(1)'}], 180, 'expanded-example');
    } catch {
      restore();
      controls.remove();
      dialog.remove();
      output.querySelector('.home-output-copy a')?.focus({preventScroll: true});
    }
  });
  close.addEventListener('click', () => dialog.close('return'));
  dialog.addEventListener('close', restore);
  window.addEventListener('beforeprint', () => {
    preparePrintPhotos();
    if (dialog.open) dialog.close('print');
    restore();
  });
})();
