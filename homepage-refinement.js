/* Native disclosure has a stable initial layout and works without JavaScript. */
(() => {
  const preview = document.querySelector('body.homepage-refinement .hero .hf-hero-details');
  if (!preview) return;
  let beforePrint;
  window.addEventListener('beforeprint', () => { beforePrint = preview.open; preview.open = true; });
  window.addEventListener('afterprint', () => { if (beforePrint !== undefined) preview.open = beforePrint; });
})();
/* A finite guide through the existing qualitative workflow, not a scored result. */
(() => {
  'use strict';
  const page = document.querySelector('body.homepage-refinement');
  const demo = page?.querySelector('[data-lens-demo][data-enhanced]');
  const button = demo?.querySelector('[data-workflow-playback]');
  if (!page || !demo || !button ||
      getComputedStyle(page).getPropertyValue('--hf-motion-ready').trim() !== '1' ||
      getComputedStyle(page).getPropertyValue('--mc-enhancement-style').trim() !== '1' ||
      typeof Element.prototype.animate !== 'function' || !('IntersectionObserver' in window)) return;
  let preference, printMedia;
  try {
    preference = matchMedia('(prefers-reduced-motion: reduce)');
    printMedia = matchMedia('print');
  } catch { return; }
  const paths = [...demo.querySelectorAll('[data-lens-panel] .mr-scenario-path')];
  if (paths.length !== 4 || paths.some(path => path.children.length !== 4)) return;
  const visible = new WeakMap(), played = new WeakSet();
  let path, animations = [], generation = 0, state = 'static', manuallyPaused = false, failed = false;
  const selected = () => paths.find(item => !item.closest('[data-lens-panel]').hidden);
  const supported = () => !failed && !preference.matches && !printMedia.matches;
  const label = () => {
    button.disabled = !supported();
    button.textContent = !supported() ? 'Static illustration' : state === 'running' ? 'Pause illustration' : state === 'paused' ? 'Resume illustration' : state === 'complete' ? 'Replay illustration' : 'Play illustration';
    button.setAttribute('aria-pressed', String(state === 'running'));
    demo.dataset.hfPlayback = state;
  };
  const reset = () => {
    generation++;
    animations.forEach(animation => { try { animation.cancel(); } catch { /* Static fallback. */ } });
    animations = [];
    state = 'static';
  };
  const pause = () => {
    if (state !== 'running') return;
    animations.forEach(animation => animation.pause());
    state = 'paused';
    label();
  };
  const start = () => {
    reset();
    if (!path || !supported() || document.hidden || !visible.get(path)) { label(); return; }
    const current = generation;
    try {
      [...path.children].forEach((step, index) => {
        let trace = step.querySelector('.hf-flow-trace');
        if (!trace) {
          trace = document.createElement('span');
          trace.className = 'hf-flow-trace';
          trace.setAttribute('aria-hidden', 'true');
          step.append(trace);
        }
        const animation = trace.animate([
          {transform: 'scaleX(0)', opacity: .35},
          {transform: 'scaleX(1)', opacity: 1}
        ], {duration: 3000, delay: index * 3000, easing: 'ease-in-out', fill: 'both'});
        animation?.finished?.catch?.(() => {});
        if (!animation?.finished || ['cancel', 'pause', 'play'].some(key => typeof animation[key] !== 'function')) throw new Error('Animation unavailable');
        animations.push(animation);
        const emphasis = step.animate([
          {backgroundColor: 'transparent', offset: 0},
          {backgroundColor: '#E8F0ED', offset: .1},
          {backgroundColor: '#E8F0ED', offset: .85},
          {backgroundColor: 'transparent', offset: 1}
        ], {duration: 3000, delay: index * 3000, easing: 'linear', fill: 'none'});
        emphasis?.finished?.catch?.(() => {});
        if (!emphasis?.finished || ['cancel', 'pause', 'play'].some(key => typeof emphasis[key] !== 'function')) throw new Error('Animation unavailable');
        animations.push(emphasis);
      });
      played.add(path);
      state = 'running';
      label();
      Promise.all(animations.map(animation => animation.finished)).then(() => {
        if (current !== generation) return;
        animations.forEach(animation => animation.cancel());
        animations = [];
        state = 'complete';
        label();
      }, () => {
        if (current !== generation) return;
        failed = true;
        reset();
        label();
      });
    } catch {
      failed = true;
      reset();
      label();
    }
  };
  const reconcile = () => {
    const next = selected();
    if (next !== path) { reset(); path = next; manuallyPaused = false; }
    if (!supported()) { reset(); label(); return; }
    if (document.hidden || !visible.get(path) || manuallyPaused) { pause(); label(); return; }
    if (state === 'paused') {
      animations.forEach(animation => animation.play());
      state = 'running';
      label();
    } else if (!played.has(path)) start();
    else label();
  };
  try {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target, entry.isIntersecting));
      reconcile();
    }, {threshold: .2});
    paths.forEach(item => observer.observe(item));
    button.addEventListener('click', () => {
      if (state === 'running') { manuallyPaused = true; pause(); }
      else if (state === 'paused') { manuallyPaused = false; reconcile(); }
      else { manuallyPaused = false; path = selected(); start(); }
    });
    const changed = event => {
      if (event.target.closest('[data-lens-choice]')) queueMicrotask(reconcile);
    };
    demo.addEventListener('click', changed);
    demo.addEventListener('keydown', changed);
    document.addEventListener('visibilitychange', reconcile);
    preference.addEventListener?.('change', reconcile);
    window.addEventListener('beforeprint', () => { reset(); label(); });
    window.addEventListener('afterprint', label);
    path = selected();
    label();
  } catch {
    failed = true;
    reset();
    label();
  }
})();
