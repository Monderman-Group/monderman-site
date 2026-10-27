// Bounded public accents, with the previous CSS as a negative-scope control.
// All pages and fonts are local; no account, provider or production calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium, webkit} from 'playwright';

const goldRunMode = process.env.GOLD_ACCENT_MODE ?? 'full';
assert.ok(['full', 'preflight'].includes(goldRunMode), 'Unknown Gold accent mode');
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.SITE_BASE || 'http://127.0.0.1:4175';
const origin = new URL(base).origin;
const out = process.env.GOLD_ACCENT_OUT || fs.mkdtempSync('/tmp/public-gold-accent-');
const baseline = '30138204856fb7e6d5e14264c060c7b89ed391a1';
const cssFiles = ['enterprise-site.css', 'homepage-workspace-demo.css', 'monderman-depth-lure-tile.css'];
const oldCSS = Object.fromEntries(cssFiles.map(file => [file, execFileSync('git', ['show', `${baseline}:${file}`], {cwd: root, encoding: 'utf8'})]));
const heroSelector = ':is(.hero .hero-actions, .ps-hero .ps-hero-actions) > a.btn:is(.btn-accent, .btn-primary)[href^="pilot.html"], .hero .actions > a.pilot-primary[href="#apply"]';
const heroPages = ['index.html', 'platform-services.html', 'why-monderman.html', 'pilot.html', 'decision-velocity-article.html', 'structural-clarity-article.html', 'operational-systems-article.html', 'institutional-performance-article.html'];
const secondaryPages = ['plan-signal.html', 'plan-pattern.html', 'diagnostics.html', 'from-tokens-to-outcomes.html'];
const pages = [...heroPages, ...secondaryPages, 'Monderman_Platform_Brief.html'];
const gold = 'rgb(230, 199, 101)', lightGold = 'rgb(230, 199, 101)', goldInk = 'rgb(122, 96, 21)', deep = 'rgb(4, 24, 27)', teal = 'rgb(12, 110, 120)';
const seaGlass = 'rgb(169, 208, 212)', seaGlassHover = 'rgb(196, 225, 227)';
const rows = [], errors = [];
let checks = 0, screenshots = 0;
fs.mkdirSync(out, {recursive: true});
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const contrast = (foreground, background) => {
  const luminance = color => {
    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
};
const colors = locator => locator.evaluate(el => {
  const style = getComputedStyle(el);
  let background = el;
  while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(background).backgroundImage === 'none') background = background.parentElement;
  const backing = background ? getComputedStyle(background) : null;
  let backgrounds = [backing ? backing.backgroundColor : 'rgb(255, 255, 255)'];
  if (backing && backing.backgroundImage !== 'none') {
    const stops = [...backing.backgroundImage.matchAll(/rgba?\(([^)]+)\)/g)].map(match => match[1].split(',').map(Number));
    const opaque = stops.filter(stop => stop.length === 3 || stop[3] === 1);
    if (!opaque.length) throw new Error('Gradient contrast requires an opaque backing stop');
    let samples = opaque.map(stop => stop.slice(0, 3));
    const overlays = stops.filter(stop => stop.length === 4 && stop[3] > 0 && stop[3] < 1);
    for (const pseudo of ['::before', '::after']) {
      const layer = getComputedStyle(background, pseudo);
      if (layer.display !== 'none' && layer.content !== 'none') {
        overlays.push(...[...layer.backgroundImage.matchAll(/rgba?\(([^)]+)\)/g)].map(match => match[1].split(',').map(Number)).filter(stop => stop.length === 4 && stop[3] > 0 && stop[3] < 1));
      }
    }
    for (const overlay of overlays) samples = samples.concat(samples.map(base => base.map((value, i) => value * (1 - overlay[3]) + overlay[i] * overlay[3])));
    backgrounds = samples.map(sample => 'rgb(' + sample.map(Math.round).join(', ') + ')');
  }
  return {color: style.color, background: backgrounds[0], backgrounds, border: style.borderBottomColor, leftBorder: style.borderLeftColor, opacity: style.opacity};
});
const minimumContrast = paint => Math.min(...paint.backgrounds.map(background => contrast(paint.color, background)));
const chromeColors = page => page.locator('.header, .header *, footer.mond-footer, footer.mond-footer *').evaluateAll(elements => elements.map(el => {
  const style = getComputedStyle(el);
  return [el.tagName, el.className, style.color, style.backgroundColor, style.backgroundImage, style.borderColor];
}));
// Prime the original native menu nodes before observing hidden inherited style.
// Readiness is page-local state/layout only; colors never enter its predicate.
const chromeSelector = '.header, .header *, footer.mond-footer, footer.mond-footer *';
const chromeResourceEvidence = new WeakMap();
async function chromeDeadline(action, milliseconds, label) {
  const end = performance.now() + milliseconds;
  const remaining = () => {
    const value = Math.floor(end - performance.now());
    if (value <= 0) throw new Error(label + ': deadline exceeded');
    return value;
  };
  const guard = {remaining, step: async operation => { const value = await operation(remaining()); remaining(); return value; }};
  let timer;
  try {
    const value = await Promise.race([
      Promise.resolve().then(() => { remaining(); return action(guard); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ': deadline exceeded')), milliseconds); }),
    ]);
    if (performance.now() >= end) throw new Error(label + ': result arrived after deadline');
    return value;
  } finally { clearTimeout(timer); }
}
function observeChromeResources(page, metadata) {
  const state = {metadata, requests: [], omitted: 0}, rows = new Map();
  chromeResourceEvidence.set(page, state);
  page.on('request', request => {
    if (state.requests.length >= 256) { state.omitted++; return; }
    const row = {url: request.url(), method: request.method(), type: request.resourceType(), status: null, mime: null, finished: false, failure: null};
    rows.set(request, row); state.requests.push(row);
  });
  page.on('response', response => { const row = rows.get(response.request()); if (row) { row.status = response.status(); row.mime = response.headers()['content-type'] || null; } });
  page.on('requestfinished', request => { const row = rows.get(request); if (row) row.finished = true; });
  page.on('requestfailed', request => { const row = rows.get(request); if (row) row.failure = request.failure()?.errorText || 'unavailable'; });
}
async function captureChromeOrigin(page, guard) {
  const original = await guard.step(() => page.evaluateHandle(selector => {
    const header = document.querySelector('#siteHeader'), nav = header?.querySelector('.nav'), button = header?.querySelector('.site-menu-button');
    if (!header || !nav || !button) throw new Error('Original native navigation controls are required');
    const menus = [...nav.querySelectorAll('.nav-menu')], parents = menus.map(menu => menu.querySelector('.nav-parent')), dropdowns = menus.map(menu => menu.querySelector('.nav-dropdown'));
    if (!menus.length || parents.some(node => !node) || dropdowns.some(node => !node)) throw new Error('Complete original menu inventory is required');
    if (header.classList.contains('mobile-nav-open') || menus.some(menu => menu.classList.contains('is-open')) || button.getAttribute('aria-expanded') !== 'false' || parents.some(parent => parent.getAttribute('aria-expanded') !== 'false')) throw new Error('Fresh navigation must start closed');
    const scrollNodes = [header, header.querySelector('.header-inner'), nav, ...menus, ...dropdowns].filter(Boolean);
    return {selector, header, nav, button, menus, parents, dropdowns, nodes: [...document.querySelectorAll(selector)], href: location.href, active: document.activeElement,
      headerClass: header.getAttribute('class'), menuClasses: menus.map(node => node.getAttribute('class')), parentAria: parents.map(node => node.getAttribute('aria-expanded')),
      buttonExpanded: button.getAttribute('aria-expanded'), buttonLabel: button.getAttribute('aria-label'),
      scroll: {x: scrollX, y: scrollY, nodes: scrollNodes.map(node => ({node, left: node.scrollLeft, top: node.scrollTop}))}};
  }, chromeSelector));
  const info = await guard.step(() => original.evaluate(value => ({menus: value.menus.length, nodes: value.nodes.length, url: value.href, active: {tag: value.active?.tagName, id: value.active?.id || ''}})));
  return {original, info};
}
async function waitChromeState(page, original, mobile, phase, index, timeout) {
  await page.waitForFunction(({original, mobile, phase, index}) => {
    if (location.href !== original.href) throw new Error('Menu preparation navigated away from its original URL');
    const nodes = [...document.querySelectorAll(original.selector)], menus = [...original.nav.querySelectorAll('.nav-menu')];
    if (nodes.length !== original.nodes.length || nodes.some((node, i) => node !== original.nodes[i]) || menus.length !== original.menus.length || menus.some((node, i) => node !== original.menus[i]) || menus.some((menu, i) => menu.querySelector('.nav-parent') !== original.parents[i] || menu.querySelector('.nav-dropdown') !== original.dropdowns[i])) throw new Error('Original navigation node identity/inventory changed');
    const shown = element => {
      const box = element.getBoundingClientRect();
      if (!(box.width > 0 && box.height > 0)) return false;
      for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) !== 1) return false;
      }
      return true;
    };
    if (phase === 'nav-open') return original.header.classList.contains('mobile-nav-open') && original.button.getAttribute('aria-expanded') === 'true' && shown(original.nav);
    if (phase === 'dropdown') return shown(original.dropdowns[index]) && (mobile ? original.menus[index].classList.contains('is-open') && original.parents[index].getAttribute('aria-expanded') === 'true' && menus.filter(menu => menu.classList.contains('is-open')).length === 1 : original.menus[index].matches(':hover'));
    if (phase !== 'closed') throw new Error('Unknown native menu state');
    return original.header.getAttribute('class') === original.headerClass && original.button.getAttribute('aria-expanded') === original.buttonExpanded && original.button.getAttribute('aria-label') === original.buttonLabel
      && menus.every((menu, i) => menu.getAttribute('class') === original.menuClasses[i] && original.parents[i].getAttribute('aria-expanded') === original.parentAria[i] && !menu.matches(':hover') && !menu.matches(':focus-within'))
      && original.dropdowns.every(dropdown => !shown(dropdown)) && document.activeElement === original.active
      && scrollX === original.scroll.x && scrollY === original.scroll.y && original.scroll.nodes.every(({node, left, top}) => node.scrollLeft === left && node.scrollTop === top);
  }, {original, mobile, phase, index}, {timeout});
}
async function primeChrome(page, originState, mobile, progress) {
  const {original, info} = originState;
  if (mobile) await chromeDeadline(async guard => { progress.phase = 'open-navigation'; await guard.step(timeout => page.locator('#siteHeader .site-menu-button').click({timeout})); await guard.step(timeout => waitChromeState(page, original, mobile, 'nav-open', -1, timeout)); await guard.step(() => settle(page)); }, 3000, 'Native navigation open');
  for (let index = 0; index < info.menus; index++) {
    await chromeDeadline(async guard => {
      progress.phase = 'prime-menu'; progress.menu = index;
      const parent = page.locator('#siteHeader .nav-menu .nav-parent').nth(index);
      if (mobile) await guard.step(timeout => parent.click({timeout}));
      else await guard.step(timeout => parent.hover({timeout}));
      await guard.step(timeout => waitChromeState(page, original, mobile, 'dropdown', index, timeout));
      await guard.step(() => settle(page));
      assert.equal(page.url(), info.url, 'Native menu preparation retains its URL');
      progress.primed.push(index);
    }, 3000, 'Native dropdown ' + index);
  }
}
const chromeHoverPoint = Object.freeze({x: 12, y: 8});
// This serialized function is also the state-only readiness predicate. Its
// capture=false path never reads any compared paint value.
function chromeNativeObservation({original, mobile, phase, capture}) {
  const nodes = [...document.querySelectorAll(original.selector)], menus = [...original.nav.querySelectorAll('.nav-menu')];
  if (location.href !== original.href || nodes.length !== original.nodes.length || nodes.some((node, i) => node !== original.nodes[i]) || menus.length !== original.menus.length || menus.some((node, i) => node !== original.menus[i]) || menus.some((menu, i) => menu.querySelector('.nav-parent') !== original.parents[i] || menu.querySelector('.nav-dropdown') !== original.dropdowns[i])) throw new Error('Original navigation URL/node identity changed during observation');
  if (typeof document.getAnimations !== 'function' || typeof CSSTransition !== 'function') throw new Error('Native CSS transition observation is required');
  const describe = node => node ? {tag: node.tagName, id: node.id, className: node.getAttribute('class'), href: node.getAttribute('href'), index: nodes.indexOf(node)} : null;
  const pseudo = node => ({...describe(node), hover: node.matches(':hover'), focus: node.matches(':focus'), focusVisible: node.matches(':focus-visible'), focusWithin: node.matches(':focus-within')});
  const shown = element => {
    const box = element.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0)) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) !== 1) return false;
    }
    return true;
  };
  const assess = () => {
    const parent = original.parents.at(-1), hovered = [...document.querySelectorAll(':hover')], hoveredAnchors = hovered.filter(node => node.tagName === 'A');
    const focusVisible = [...document.querySelectorAll(':focus-visible')], box = parent.getBoundingClientRect(), style = getComputedStyle(parent);
    const hitPoint = {x: box.x + parseFloat(style.borderLeftWidth || '0') + 12, y: box.y + parseFloat(style.borderTopWidth || '0') + 8};
    const hit = document.elementFromPoint(hitPoint.x, hitPoint.y);
    const transitions = document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => {
      const target = animation.effect?.target;
      const knownTarget = target instanceof Element;
      const relevant = !knownTarget || nodes.some(node => node === target || target.contains(node));
      return {relevant, target: knownTarget ? describe(target) : null, property: animation.transitionProperty, pending: animation.pending, playState: animation.playState};
    }).filter(animation => animation.relevant);
    const transitionsSettled = transitions.every(animation => !animation.pending && ['finished', 'idle'].includes(animation.playState));
    let nativeReady;
    if (phase === 'all-menus-primed-final-visible') {
      const path = []; for (let node = parent; node; node = node.parentElement) path.unshift(node);
      nativeReady = parent.clientWidth > 12 && parent.clientHeight > 8 && hit?.closest('a') === parent
        && hovered.length === path.length && hovered.every((node, i) => node === path[i]) && hoveredAnchors.length === 1 && hoveredAnchors[0] === parent
        && shown(original.dropdowns.at(-1)) && document.activeElement === (mobile ? parent : original.active)
        && focusVisible.length === 0
        && (mobile ? original.header.classList.contains('mobile-nav-open') && original.button.getAttribute('aria-expanded') === 'true'
          && menus.every((menu, i) => menu.classList.contains('is-open') === (i === menus.length - 1) && original.parents[i].getAttribute('aria-expanded') === String(i === menus.length - 1))
          : original.header.getAttribute('class') === original.headerClass && original.button.getAttribute('aria-expanded') === original.buttonExpanded && menus.every((menu, i) => menu.getAttribute('class') === original.menuClasses[i] && original.parents[i].getAttribute('aria-expanded') === original.parentAria[i]));
    } else if (phase === 'restored-original-closed') {
      nativeReady = original.header.getAttribute('class') === original.headerClass && original.button.getAttribute('aria-expanded') === original.buttonExpanded && original.button.getAttribute('aria-label') === original.buttonLabel
        && menus.every((menu, i) => menu.getAttribute('class') === original.menuClasses[i] && original.parents[i].getAttribute('aria-expanded') === original.parentAria[i] && !menu.matches(':hover') && !menu.matches(':focus-within'))
        && original.dropdowns.every(dropdown => !shown(dropdown)) && document.activeElement === original.active && hoveredAnchors.length === 0 && focusVisible.length === 0
        && scrollX === original.scroll.x && scrollY === original.scroll.y && original.scroll.nodes.every(({node, left, top}) => node.scrollLeft === left && node.scrollTop === top);
    } else throw new Error('Unknown foreground observation phase');
    return {ready: nativeReady && document.hasFocus() && transitionsSettled, requestedActivation: 'page.bringToFront', documentHasFocus: document.hasFocus(), url: location.href,
      active: describe(document.activeElement), nodes: nodes.map(pseudo), hoverPath: hovered.map(describe), focusPath: [...document.querySelectorAll(':focus')].map(describe), focusVisiblePath: focusVisible.map(describe),
      requestedParentLocalHover: phase === 'all-menus-primed-final-visible' ? {x: 12, y: 8} : null, freshHitTestProbe: {point: hitPoint, element: describe(hit), closestAnchor: describe(hit?.closest('a'))},
      menus: menus.map((menu, i) => ({className: menu.getAttribute('class'), expanded: original.parents[i].getAttribute('aria-expanded'), retainedStyle: menu.getAttribute('style')})),
      scroll: {x: scrollX, y: scrollY, nodes: original.scroll.nodes.map(({node}) => ({...describe(node), left: node.scrollLeft, top: node.scrollTop}))}, transitions, transitionsSettled};
  };
  const before = assess();
  if (!capture) return before.ready;
  if (!before.ready) throw new Error('Foreground native state is not ready at signature capture');
  const signature = nodes.map(el => { const style = getComputedStyle(el); return [el.tagName, el.className, style.color, style.backgroundColor, style.backgroundImage, style.borderColor]; });
  const nativeState = assess();
  if (!nativeState.ready) throw new Error('Foreground native state changed during the atomic signature observation');
  return {signature, nativeState};
}
async function observePreparedChrome(page, originState, mobile, phase, progress) {
  const {original, info} = originState;
  return chromeDeadline(async guard => {
    progress.phase = phase + '-activation';
    await guard.step(() => page.bringToFront());
    if (phase === 'all-menus-primed-final-visible') {
      const safePoint = await guard.step(() => original.evaluate(value => {
        const parent = value.parents.at(-1), box = parent.getBoundingClientRect();
        return parent.isConnected && parent.clientWidth > 12 && parent.clientHeight > 8 && box.width > 0 && box.height > 0;
      }));
      assert.ok(safePoint, 'Final original parent contains the fixed native hover point');
      progress.phase = phase + '-fixed-parent-hover';
      await guard.step(timeout => page.locator('#siteHeader .nav-menu .nav-parent').nth(info.menus - 1).hover({position: chromeHoverPoint, timeout}));
      await guard.step(() => settle(page));
    } else {
      await guard.step(() => restoreChrome(page, originState, mobile, progress, guard));
    }
    progress.phase = phase + '-native-state-and-transitions';
    const handle = await guard.step(timeout => page.waitForFunction(chromeNativeObservation, {original, mobile, phase, capture: false}, {timeout}));
    await guard.step(() => handle.dispose());
    progress.phase = phase + '-atomic-signature';
    const snapshot = await guard.step(() => page.evaluate(chromeNativeObservation, {original, mobile, phase, capture: true}));
    progress.phase = phase + '-captured';
    return snapshot;
  }, 3000, 'Foreground ' + phase + ' observation');
}

async function restoreChrome(page, originState, mobile, progress, guard) {
  const {original, info} = originState;
    progress.phase = 'restore-closed';
    await guard.step(() => original.evaluate(value => { for (const {node, left, top} of value.scroll.nodes) node.scrollTo({left, top, behavior: 'instant'}); }));
    await guard.step(() => page.keyboard.press('Escape'));
    const safeBackground = await guard.step(() => page.evaluate(() => !document.elementFromPoint(1, 1)?.closest('a,button,input,select,textarea,summary,label')));
    assert.ok(safeBackground, 'Original header edge is a noninteractive blur target');
    await guard.step(() => page.mouse.click(1, 1)); await guard.step(() => page.mouse.move(0, 0));
    await guard.step(() => original.evaluate(value => {
      // Keep the native --nav-dropdown-top value; ordinary close does too.
      if (value.active !== document.body && value.active !== document.documentElement) value.active.focus({preventScroll: true});
      for (const {node, left, top} of value.scroll.nodes) node.scrollTo({left, top, behavior: 'instant'});
      window.scrollTo({left: value.scroll.x, top: value.scroll.y, behavior: 'instant'});
    }));
    await guard.step(timeout => waitChromeState(page, original, mobile, 'closed', -1, timeout)); await guard.step(() => settle(page));
    assert.equal(page.url(), info.url, 'Closed navigation retains its URL');
}
async function chromeFailureState(page) {
  return page.evaluate(selector => {
    const elements = [...document.querySelectorAll(selector)];
    const signature = elements.map(node => { const style = getComputedStyle(node); return [node.tagName, node.className, style.color, style.backgroundColor, style.backgroundImage, style.borderColor]; });
    const inspect = node => { const style = getComputedStyle(node), box = node.getBoundingClientRect(); return {tag: node.tagName, id: node.id, className: node.getAttribute('class'), display: style.display, visibility: style.visibility, opacity: style.opacity, color: style.color, box: {x: box.x, y: box.y, width: box.width, height: box.height}, scroll: {left: node.scrollLeft, top: node.scrollTop}, hover: node.matches(':hover'), focus: node.matches(':focus'), focusVisible: node.matches(':focus-visible'), focusWithin: node.matches(':focus-within')}; };
    return {signature, documentHasFocus: document.hasFocus(), hoverPath: [...document.querySelectorAll(':hover')].map(inspect), focusPath: [...document.querySelectorAll(':focus')].map(inspect), focusVisiblePath: [...document.querySelectorAll(':focus-visible')].map(inspect), nativeTransitions: typeof document.getAnimations === 'function' && typeof CSSTransition === 'function' ? document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => ({target: animation.effect?.target instanceof Element ? inspect(animation.effect.target) : null, property: animation.transitionProperty, pending: animation.pending, playState: animation.playState})) : {unavailable: 'Native transition API missing'}, url: location.href, readyState: document.readyState, documentClasses: document.documentElement.className, active: document.activeElement ? inspect(document.activeElement) : null, viewport: {width: innerWidth, height: innerHeight}, scroll: {x: scrollX, y: scrollY}, fonts: {status: document.fonts.status},
      nodes: elements.map(node => ({...inspect(node), ancestry: [...function* () { for (let parent = node.parentElement; parent; parent = parent.parentElement) yield parent; }()].map(inspect)})),
      menus: [...document.querySelectorAll('#siteHeader .nav-menu')].map(node => ({className: node.className, style: node.getAttribute('style'), expanded: node.querySelector('.nav-parent')?.getAttribute('aria-expanded')})),
      stylesheets: [...document.styleSheets].map(sheet => { let rules; try { rules = sheet.cssRules.length; } catch (error) { rules = {unavailable: String(error)}; } return {href: sheet.href, disabled: sheet.disabled, media: sheet.media.mediaText, rules}; })};
  }, chromeSelector);
}
async function recordChromeFailure(page, prior, label, observation, error) {
  const name = label.replace(/[^a-zA-Z0-9._-]/g, '_'), payload = {status: 'FAIL', mode: goldRunMode, label, error: String(error), recordedAt: new Date().toISOString(), assertedSignatures: observation.comparisons, progress: observation.progress, preparation: observation.preparation || null, restoration: observation.restoration || null, freshDiagnostics: {}};
  const end = performance.now() + 8000;
  const bounded = (action, label) => {
    const remaining = Math.floor(end - performance.now());
    if (remaining <= 0) { payload.evidenceDeadline = 'Paired evidence deadline exceeded'; return Promise.reject(new Error(payload.evidenceDeadline)); }
    return chromeDeadline(guard => guard.step(action), Math.min(2000, remaining), label);
  };
  for (const [mode, target] of [['actual', page], ['prior', prior]]) {
    const resource = chromeResourceEvidence.get(target);
    payload.freshDiagnostics[mode] = {resources: resource ? {metadata: resource.metadata, requests: resource.requests.map(row => ({...row})), omitted: resource.omitted} : null};
    try {
      const {signature, ...state} = await bounded(() => chromeFailureState(target), mode + ' fresh state/signature');
      payload.freshDiagnostics[mode].signatureAfterFailure = signature; payload.freshDiagnostics[mode].stateAfterFailure = state;
    } catch (failure) { payload.freshDiagnostics[mode].stateUnavailable = String(failure); }
    try { await bounded(timeout => target.screenshot({path: path.join(out, name + '-' + mode + '-FAIL.png'), fullPage: false, timeout}), mode + ' failure PNG'); } catch (failure) { payload.freshDiagnostics[mode].screenshotUnavailable = String(failure); }
  }
  fs.writeFileSync(path.join(out, name + '-FAIL.json'), JSON.stringify(payload, null, 2) + '\n');
}
async function comparePreparedChrome(page, prior, width, label) {
  const observation = {mode: goldRunMode, comparisons: [], progress: {actual: {phase: 'capture', primed: []}, prior: {phase: 'capture', primed: []}}};
  let actualOrigin, priorOrigin;
  try {
    [actualOrigin, priorOrigin] = await chromeDeadline(guard => Promise.all([captureChromeOrigin(page, guard), captureChromeOrigin(prior, guard)]), 3000, 'Original menu inventory');
    equal(actualOrigin.info.menus, priorOrigin.info.menus, label + ': matching original menu inventories');
    const priming = await Promise.allSettled([primeChrome(page, actualOrigin, width <= 1180, observation.progress.actual), primeChrome(prior, priorOrigin, width <= 1180, observation.progress.prior)]);
    observation.preparation = priming.map((result, index) => ({mode: index ? 'prior' : 'actual', status: result.status, error: result.status === 'rejected' ? String(result.reason) : null}));
    for (const result of priming) if (result.status === 'rejected') throw result.reason;
    // All menus are primed first; foreground inputs and snapshots are sequential.
    for (const phase of ['all-menus-primed-final-visible', 'restored-original-closed']) {
      const comparison = {phase, actual: null, expected: null, actualState: null, expectedState: null};
      observation.comparisons.push(comparison);
      if (phase === 'restored-original-closed') observation.restoration = [];
      for (const [mode, target, originState, tupleKey, stateKey] of [['actual', page, actualOrigin, 'actual', 'actualState'], ['prior', prior, priorOrigin, 'expected', 'expectedState']]) {
        try {
          const snapshot = await observePreparedChrome(target, originState, width <= 1180, phase, observation.progress[mode]);
          comparison[tupleKey] = snapshot.signature; comparison[stateKey] = snapshot.nativeState;
          if (phase === 'restored-original-closed') observation.restoration.push({mode, status: 'fulfilled', error: null});
        } catch (error) {
          if (phase === 'restored-original-closed') observation.restoration.push({mode, status: 'rejected', error: String(error)});
          throw error;
        }
      }
      equal(comparison.actual, comparison.expected, label + (phase === 'restored-original-closed' ? ': navigation and footer colors remain exact' : ': initialized visible navigation and footer colors remain exact'));
    }
    fs.writeFileSync(path.join(out, label.replace(/[^a-zA-Z0-9._-]/g, '_') + '-chrome.json'), JSON.stringify({status: 'PASS', label, ...observation}, null, 2) + '\n');
    return observation;
  } catch (error) {
    try { await recordChromeFailure(page, prior, label, observation, error); } finally { throw error; }
  } finally {
    await actualOrigin?.original.dispose().catch(() => {});
    await priorOrigin?.original.dispose().catch(() => {});
  }
}

async function open(browser, file, width, prior = false) {
  const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: 'reduce'});
  page.on('pageerror', error => errors.push(file + ': ' + error.message));
  observeChromeResources(page, {file, width, prior});
  await page.addInitScript(() => { window.supabase = {createClient: () => ({auth: {
    getSession: async () => ({data: {session: null}}),
    onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
  }})}; });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const old = prior && oldCSS[url.pathname.slice(1)];
    return old ? route.fulfill({contentType: 'text/css', body: old}) : route.continue();
  });
  await page.goto(`${base}/${file}`, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return page;
}
async function screenshot(locator, file) {
  await locator.scrollIntoViewIfNeeded();
  await locator.screenshot({path: path.join(out, file)});
  screenshots++;
}

if (goldRunMode === 'full') {
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch({headless: true});
  try {
    for (const width of [390, 768, 1440]) {
      for (const file of pages) {
        const label = `${engine}/${width}/${file}`;
        const [page, prior] = await Promise.all([open(browser, file, width), open(browser, file, width, true)]);
        await comparePreparedChrome(page, prior, width, label);
        await prior.close();
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': no horizontal overflow');
        if (heroPages.includes(file)) {
          const cta = page.locator(heroSelector);
          const outlined = width >= 1181 && file.endsWith('-article.html');
          equal(await cta.count(), 1, label + ': exactly one dark hero invitation request');
          equal((await cta.textContent()).trim(), 'Request an invitation', label + ': approved invitation copy');
          const initial = await colors(cta);
          equal(await cta.evaluate(el => getComputedStyle(el).backgroundColor), outlined ? 'rgba(0, 0, 0, 0)' : seaGlass, label + ': invitation fill preserves desktop hierarchy');
          equal(initial.color, outlined ? seaGlass : deep, label + ': invitation text');
          equal(initial.border, seaGlass, label + ': original sea-glass invitation border');
          const filledHeaderActions = await page.locator('.header .site-entry-link').evaluateAll(nodes => nodes.filter(el => {
            const box = el.getBoundingClientRect(), style = getComputedStyle(el);
            return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0
              && style.visibility !== 'hidden' && Number(style.opacity) > 0
              && ['rgb(169, 208, 212)', 'rgb(196, 225, 227)', 'rgb(230, 199, 101)', 'rgb(12, 110, 120)'].includes(style.backgroundColor);
          }).length);
          equal(filledHeaderActions + (outlined ? 0 : 1), 1, label + ': header and hero retain exactly one filled invitation');
          ok(minimumContrast(initial) >= 4.5, label + ': invitation text contrast across backing colors');
          for (const state of ['hover', 'focus']) {
            if (state === 'hover') await cta.hover();
            else { await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await cta.focus(); }
            await page.waitForFunction(({selector, target}) => getComputedStyle(document.querySelector(selector)).borderBottomColor === target, {selector: heroSelector, target: seaGlassHover});
            const active = await colors(cta);
            equal(active.color, outlined ? seaGlassHover : deep, label + ': ' + state + ' text');
            equal(await cta.evaluate(el => getComputedStyle(el).backgroundColor), outlined ? 'rgba(0, 0, 0, 0)' : seaGlassHover, label + ': ' + state + ' fill');
            ok(minimumContrast(active) >= 4.5, label + ': ' + state + ' contrast across backing colors');
          }
          await cta.evaluate(el => el.blur());
          await page.mouse.move(0, 0);
          rows.push({engine, width, file, outlined, invitationContrast: minimumContrast(initial)});
        }
        if (heroPages.includes(file) || secondaryPages.includes(file)) {
          const lightSurface = file.startsWith('plan-');
          const selector = lightSurface ? '.pl-buy > a.btn-secondary' : ':is(.hero .hero-actions, .ps-hero .ps-hero-actions, .hero .actions, .article-hero .article-actions) > :is(a.btn-secondary, a.btn-hero-secondary, a.btn.secondary, a.article-action:not(.article-action-primary))';
          const secondary = page.locator(selector);
          equal(await secondary.count(), 1, label + ': exactly one secondary opening action');
          if (file === 'index.html') {
            equal((await secondary.textContent()).trim(), 'View sample reports', label + ': approved sample-entry copy');
            equal(await secondary.getAttribute('href'), 'sample-report.html', label + ': sample-entry destination');
            const activation = page.locator('.hero-invitation-link');
            equal(await activation.count(), 1, label + ': one invited-user entry');
            equal(await activation.getAttribute('href'), 'pattern-trial.html', label + ': invitation destination unchanged');
          }
          const initial = await colors(secondary);
          equal(await secondary.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', label + ': secondary action remains outlined');
          equal(initial.border, gold, label + ': secondary outline uses the shared gold');
          equal(initial.color, lightSurface ? goldInk : gold, label + ': secondary text fits its backing surface');
          ok(minimumContrast(initial) >= 4.5, label + ': secondary text contrast');
          for (const state of ['hover', 'focus']) {
            if (state === 'hover') await secondary.hover();
            else { await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await secondary.focus(); }
            const target = lightSurface ? gold : lightGold;
            await page.waitForFunction(({selector, target}) => getComputedStyle(document.querySelector(selector)).borderBottomColor === target, {selector, target});
            const active = await colors(secondary);
            equal(active.color, lightSurface ? goldInk : lightGold, label + ': secondary ' + state + ' text');
            equal(await secondary.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', label + ': secondary ' + state + ' remains outlined');
            ok(minimumContrast(active) >= 4.5, label + ': secondary ' + state + ' contrast');
          }
          await secondary.evaluate(el => el.blur());
          await page.mouse.move(0, 0);
          await settle(page);
          if (lightSurface) {
            const primary = await colors(page.locator('.pl-buy > a.btn-accent'));
            equal(primary.background, teal, label + ': light-surface primary retains teal');
          }
        }
        if (file === 'pilot.html') {
          equal((await colors(page.locator('.pilot-status'))).color, lightGold, label + ': invitation availability uses mild gold');
          equal(await page.locator('.pilot-status').evaluate(el => getComputedStyle(el, '::before').backgroundColor), gold, label + ': invitation status dot uses the same gold');
        }
        if (file === 'platform-services.html') {
          equal(await page.locator('table.ps-table td.svc').evaluateAll((cells, color) => cells.every(el => getComputedStyle(el).textDecorationColor === color), gold), true, label + ': service underlines use the same gold');
        }
        if (file === 'index.html') {
          const tabs = page.locator('.hwd-tabs button');
          for (let index = 0; index < 4; index++) {
            await tabs.nth(index).click();
            await settle(page);
            const selected = page.locator('.hwd-tabs button[aria-selected="true"]');
            const number = await colors(selected.locator('span'));
            equal(number.color, goldInk, label + ': active number is gold ink');
            equal(number.opacity, '1', label + ': active number is fully opaque');
            ok(contrast(number.color, number.background) >= 4.5, label + ': active number contrast');
            const tab = await colors(selected);
            equal(tab.border, gold, label + ': active underline');
            ok([teal, 'rgb(10, 91, 99)'].includes(tab.color), label + ': active label remains teal');
            equal(await page.locator('.hwd-tabs button:not([aria-selected="true"]) span').evaluateAll((els, ink) => els.some(el => getComputedStyle(el).color === ink), goldInk), false, label + ': inactive numbers do not acquire gold');
          }
          await tabs.first().click();
          await page.mouse.move(0, 0);
          await screenshot(page.locator('.hero'), `${engine}-${width}-home-hero.png`);
        }
        if (file === 'platform-services.html') await screenshot(page.locator('.ps-hero'), `${engine}-${width}-pricing-hero.png`);
        if (file === 'index.html') {
          const tile = page.locator('[data-home-report-quad]');
          equal(await tile.count(), 1, label + ': one current report preview');
          equal(await tile.locator('.hrq-tile').count(), 4, label + ': four distinct report sections');
          const figures = tile.locator('[data-promo-score], .mr-overview-sankey-source strong, .mr-overview-sankey-outcome strong');
          equal(await figures.count(), 9, label + ': score and separate money/time values');
          equal(await figures.evaluateAll(els => [...new Set(els.map(el => getComputedStyle(el).color))]), ['rgb(9, 56, 62)'], label + ': report figures use dark teal');
          const value = await colors(tile.locator('[data-promo-score]'));
          ok(contrast(value.color, value.background) >= 4.5, label + ': report score contrast');
          equal((await colors(tile.locator('.hrq-wordmark>span'))).color, gold, label + ': gold remains a small brand accent');
          equal(await tile.locator('.mr-overview-sankey').count(), 2, label + ': money and time remain separate');
          ok(await tile.isVisible(), label + ': report preview is visible');
          await screenshot(tile, `${engine}-${width}-home-report-tile.png`);
          rows.push({engine, width, file, reportValueContrast: contrast(value.color, value.background), reportTileVisible: true});
        }
        if (file === 'Monderman_Platform_Brief.html') {
          const tile = page.locator('#monderman-depth-lure-composite');
          equal(await tile.locator('.md-opportunity > strong').count(), 1, label + ': only one primary value');
          const value = await colors(tile.locator('.md-opportunity > strong'));
          equal(value.color, 'rgb(7, 53, 58)', label + ': primary report value uses dark teal');
          ok(contrast(value.color, value.background) >= 4.5, label + ': primary report value contrast');
          equal(await tile.locator('strong, dd').evaluateAll((els, ink) => els.filter(el => getComputedStyle(el).color === ink).length, goldInk), 0, label + ': no mustard report values');
          equal((await colors(tile.locator('.md-opportunity'))).leftBorder, teal, label + ': report frame remains teal');
          if (await tile.isVisible()) await screenshot(tile, `${engine}-${width}-brief-report-tile.png`);
          rows.push({engine, width, file, reportValueContrast: contrast(value.color, value.background), reportTileVisible: await tile.isVisible()});
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
}
equal(errors, [], 'No browser runtime errors');
fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({status: 'PASS', checks, screenshots, baseline, rows, providerCalls: 0}, null, 2) + '\n');
console.log(JSON.stringify({status: 'PASS', checks, screenshots, layouts: 6, pages: pages.length, out, providerCalls: 0}));
} else {
  const fixedCases = [
    {engine: 'webkit', type: webkit, width: 390, file: 'from-tokens-to-outcomes.html'},
    {engine: 'chromium', type: chromium, width: 768, file: 'structural-clarity-article.html'},
    {engine: 'chromium', type: chromium, width: 1440, file: 'index.html'},
  ];
  const preflightRows = [];
  for (const {engine, type, width, file} of fixedCases) {
    const browser = await type.launch({headless: true});
    let page, prior, originalFailure;
    try {
      [page, prior] = await Promise.all([open(browser, file, width), open(browser, file, width, true)]);
      const label = `${engine}/${width}/${file}`;
      const observation = await comparePreparedChrome(page, prior, width, label);
      preflightRows.push({engine, width, file, phases: observation.comparisons.map(row => row.phase), fullSignaturesVerified: true});
    } catch (error) {
      originalFailure = error;
      throw error;
    } finally {
      const closing = await Promise.allSettled([page?.close(), prior?.close()]);
      const cleanupFailures = closing.flatMap((result, index) => result.status === 'rejected' ? [{target: index ? 'prior-page' : 'actual-page', error: result.reason}] : []);
      try { await browser.close(); } catch (error) { cleanupFailures.push({target: 'browser', error}); }
      if (cleanupFailures.length) {
        const evidence = {status: 'PREFLIGHT_CLEANUP_FAILURE', mode: goldRunMode, engine, width, file, originalFailure: originalFailure ? String(originalFailure) : null, cleanupFailures: cleanupFailures.map(({target, error}) => ({target, error: String(error)}))};
        const evidencePath = path.join(out, `${engine}_${width}_${file}`.replace(/[^a-zA-Z0-9._-]/g, '_') + '-cleanup-FAIL.json');
        try { fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n'); } catch (error) { evidence.evidenceWriteFailure = String(error); }
        console.error(JSON.stringify({...evidence, evidencePath}));
        if (!originalFailure) throw cleanupFailures[0].error;
      }
    }
  }
  equal(errors, [], 'No preflight browser runtime errors');
  const receipt = {status: 'PREFLIGHT_PASS', mode: goldRunMode, checks, baseline, cases: preflightRows, full78CaseCertification: false, providerCalls: 0};
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({...receipt, out}));
}
