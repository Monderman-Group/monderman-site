/* Presentation and accessibility only. No response values or routing changes. */
(() => {
  'use strict';
  function enhanceFields(mount, fields) {
    if (!mount) return;
    for (const field of fields) {
      const wrapper = mount.querySelector(`[data-field-id="${field.id}"]`);
      if (!wrapper || wrapper.dataset.intakeEnhanced) continue;
      wrapper.dataset.intakeEnhanced = 'true';
      const input = wrapper.querySelector(`#preflight_${field.id}`);
      const label = wrapper.querySelector('label');
      const group = wrapper.querySelector('[role="radiogroup"]');
      const error = wrapper.querySelector('.field-error-msg');
      const errorId = `preflight_${field.id}_error`;
      if (error) { error.id = errorId; error.setAttribute('aria-live', 'polite'); }
      if (label) {
        label.id = `preflight_${field.id}_label`;
        if (!field.required) {
          const optional = document.createElement('span');
          optional.className = 'intake-field-optional';
          optional.textContent = ' (optional)';
          label.append(optional);
        }
      }
      let help = wrapper.querySelector('p.tiny');
      if (field.helper && !help) {
        help = document.createElement('p');
        label.after(help);
      }
      const describedBy = [errorId];
      if (help) {
        help.className = 'intake-field-help';
        help.removeAttribute('style');
        help.id = `preflight_${field.id}_help`;
        help.textContent = field.helper;
        // Explain the requested answer before the control, not in a disappearing placeholder.
        label.after(help);
        describedBy.unshift(help.id);
      }
      for (const control of [input, group].filter(Boolean)) {
        control.setAttribute('aria-describedby', describedBy.join(' '));
        control.setAttribute('aria-required', String(!!field.required));
      }
      if (group && label) group.setAttribute('aria-labelledby', label.id);
      if (group) {
        const choices = [...group.querySelectorAll('[role="radio"]')];
        const syncTabStop = () => {
          const selected = choices.find(button => button.getAttribute('aria-checked') === 'true') || choices[0];
          choices.forEach(button => { button.tabIndex = button === selected ? 0 : -1; });
        };
        group.addEventListener('click', syncTabStop);
        group.addEventListener('keydown', event => {
          const index = choices.indexOf(document.activeElement);
          if (index < 0) return;
          let next = index;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % choices.length;
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + choices.length) % choices.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = choices.length - 1;
          else return;
          event.preventDefault();
          choices[next].click();
          choices[next].focus();
        });
        syncTabStop();
      }
      const other = wrapper.querySelector('.opt-other-input');
      if (other) {
        other.setAttribute('aria-label', `${field.label} Specify other`);
        other.setAttribute('aria-describedby', describedBy.join(' '));
      }
      const syncError = () => {
        for (const control of [input, group, other].filter(Boolean))
          control.setAttribute('aria-invalid', String(wrapper.classList.contains('has-error')));
      };
      new MutationObserver(syncError).observe(wrapper, {attributes:true, attributeFilter:['class']});
      syncError();
    }
  }
  window.MondermanIntake = {enhanceFields};
  function boot() {
    if (!document.body.classList.contains('diagnostic-instrument')) return;
    const stageLabel = document.querySelector('.hero-step span:last-child');
    if (stageLabel) {
      // Presentation only: follow the existing active stage without changing
      // its routing, answers, saved-report recovery or admission state.
      const labels = {
        laneStage: 'Step 1 of 3 · choose your role and diagnostic length',
        depthStage: 'Step 1 of 3 · choose your role and diagnostic length',
        introStage: 'Step 1 of 3 · before you begin',
        questionStage: 'Step 2 of 3 · answer the questions',
        processingStage: 'Preparing your result',
        resultsStage: 'Step 3 of 3 · your result',
        exhaustedStage: 'Available runs',
      };
      const syncStageLabel = () => {
        const active = document.querySelector('.stage.active');
        if (active && labels[active.id]) stageLabel.textContent = labels[active.id];
      };
      const observer = new MutationObserver(syncStageLabel);
      document.querySelectorAll('.stage').forEach(stage => observer.observe(stage, {attributes:true,attributeFilter:['class']}));
      syncStageLabel();
      window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
    }
    if (typeof PRESTART_FIELDS !== 'undefined') enhanceFields(document.getElementById('preflightContextMount'), PRESTART_FIELDS);
    const environment = document.querySelector('.environment-inner');
    if (!environment || environment.querySelector('.diagnostic-support')) return;
    const support = document.createElement('nav');
    support.className = 'diagnostic-support';
    support.setAttribute('aria-label', 'Diagnostic help');
    support.innerHTML = '<button type="button" data-intake-support="feedback">Give feedback</button><button type="button" data-intake-support="assistant">Ask a question</button><a href="connect.html">Contact Monderman</a>';
    for (const [action, selector, panelSelector, openClass] of [
      ['feedback', '.mdn-fb-launch', '#mdn-fb-panel', 'mdn-fb-open'],
      ['assistant', '#mnd-launcher', '#mnd-panel', 'mnd-open'],
    ]) {
      const button = support.querySelector(`[data-intake-support="${action}"]`);
      let closeObserver;
      button.addEventListener('click', () => {
        const launcher = document.querySelector(selector);
        if (!launcher) { location.assign('connect.html'); return; }
        closeObserver?.disconnect();
        const panel = document.querySelector(panelSelector);
        if (panel) {
          let opened = false;
          closeObserver = new MutationObserver(() => {
            if (panel.classList.contains(openClass)) opened = true;
            else if (opened) {
              closeObserver.disconnect();
              button.focus();
            }
          });
          closeObserver.observe(panel, {attributes:true, attributeFilter:['class']});
        }
        // Safari does not focus a button on click; give existing dialogs a real return target.
        button.focus({preventScroll:true});
        launcher.click();
      });
    }
    const questionFooter = document.getElementById('questionFooter');
    if (questionFooter && environment.contains(questionFooter)) questionFooter.after(support);
    else environment.append(support);
    document.documentElement.setAttribute('data-diagnostic-support-ready', '');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
