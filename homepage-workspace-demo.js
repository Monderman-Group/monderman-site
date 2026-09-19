/* A public, local-only tour. Selecting steps never reads or changes a workspace. */
(() => {
  const app = document.querySelector('[data-workspace-demo]');
  if (!app) return;
  const tabs = [...app.querySelectorAll('[role="tab"]')];
  const panels = [...app.querySelectorAll('[role="tabpanel"]')];
  const preview = app.closest('.home-workspace-preview');
  const choices = [...app.querySelectorAll('input[name="hwd-journey"]')];
  const depthNext = 'Participation and compatibility checks guide when responses can be combined within one diagnostic.';
  const depthEvaluateNext = 'Review differences between perspectives before agreeing a change.';
  // Authored illustrative actions are proposals, not quotations from a report or
  // claims of achieved results. Numerical evidence stays in generated markup.
  const journeys = {
    structural_clarity: {
      name: 'Structural Clarity', type: 'depth',
      gatherTitle: 'Find out who owns supplier onboarding.',
      gatherDescription: 'Ask the people doing, managing and overseeing the work about responsibility, authority and handoffs.',
      evaluateTitle: 'Compare where responsibility is clear or disputed.',
      evaluateDescription: 'Bring Structural Clarity responses together. Keep differences between operational, managerial and senior-leader views visible.',
      actionTitle: 'Give each supplier request a named owner.',
      actionOne: 'Name the role responsible for a request from receipt to completion.',
      actionTwo: 'Set out which roles decide, contribute and approve.',
      actionThree: 'Record unresolved handoffs and who must resolve them.',
      actionOwner: 'Procurement lead',
      actionMeasure: 'Requests reassigned or reopened because ownership was unclear, and time spent resolving handoffs.',
      compareTitle: 'Check whether ownership has become clearer.',
      compareDescription: 'Repeat compatible Structural Clarity runs. Compare unresolved handoffs and misassigned requests before and after the change.',
      reportHref: 'sample-report.html#depth', reportLabel: 'Read the Structural Clarity Depth example',
    },
    decision_velocity: {
      name: 'Decision Velocity', type: 'depth',
      gatherTitle: 'Follow decisions from request to answer.',
      gatherDescription: 'Ask requesters, reviewers and decision makers about approval steps, waiting time and decisions that have to be reopened.',
      evaluateTitle: 'Compare where decisions wait.',
      evaluateDescription: 'Bring Decision Velocity responses together. Check whether different groups report the same approval delays or different ones.',
      actionTitle: 'Set a clear route for supplier exceptions.',
      actionOne: 'Name the person authorized to decide each type of exception.',
      actionTwo: 'Require a complete request before the decision is sent for approval.',
      actionThree: 'Set an escalation route when the decision owner is unavailable.',
      actionOwner: 'Procurement manager',
      actionMeasure: 'Time from a complete request to a decision, and decisions sent back for another approval.',
      compareTitle: 'Check whether decisions move faster.',
      compareDescription: 'Repeat compatible Decision Velocity runs. Compare waiting time and extra approvals for similar supplier requests before and after the change.',
      reportHref: 'diagnostics.html#methodology-and-sources', reportLabel: 'See how Depth Synthesis works',
    },
    operational_systems: {
      name: 'Operational Systems', type: 'depth',
      gatherTitle: 'Find the work that gets repeated.',
      gatherDescription: 'Ask the people who prepare, review and manage supplier files about duplicate checks, manual steps and recurring rework.',
      evaluateTitle: 'Compare where processes create extra work.',
      evaluateDescription: 'Bring Operational Systems responses together. Review where groups agree about repeated work and where their accounts differ.',
      actionTitle: 'Stop sending incomplete files through review.',
      actionOne: 'Use one completeness checklist before a supplier file enters review.',
      actionTwo: 'Reuse current, verified documents instead of collecting the same information again.',
      actionThree: 'Keep required checks and record why a file is returned for correction.',
      actionOwner: 'Supplier onboarding lead',
      actionMeasure: 'Review passes and staff time per completed supplier file, alongside required quality checks.',
      compareTitle: 'Check whether repeated work has fallen.',
      compareDescription: 'Repeat compatible Operational Systems runs. Compare review passes, staff time and quality for similar supplier files.',
      reportHref: 'diagnostics.html#methodology-and-sources', reportLabel: 'See how Depth Synthesis works',
    },
    institutional_performance: {
      name: 'Institutional Performance', type: 'depth',
      gatherTitle: 'Ask what it takes to deliver reliably.',
      gatherDescription: 'Ask staff and leaders about missed commitments, recurring problems and dependence on a few people to keep supplier onboarding moving.',
      evaluateTitle: 'Compare whether delivery is dependable.',
      evaluateDescription: 'Bring Institutional Performance responses together. Review differences in how groups describe reliability, recurring fixes and sustained results.',
      actionTitle: 'Address recurring causes of late completion.',
      actionOne: 'Agree the expected turnaround and who owns missed commitments.',
      actionTwo: 'Review late cases to distinguish recurring causes from one-off problems.',
      actionThree: 'Test a change to one recurring cause while tracking quality as well as speed.',
      actionOwner: 'Operations director',
      actionMeasure: 'On-time completions, reopened cases and hours spent resolving recurring problems.',
      compareTitle: 'Check whether reliable delivery is sustained.',
      compareDescription: 'Repeat compatible Institutional Performance runs. Compare on-time completion, quality and recurring problems over a comparable period.',
      reportHref: 'diagnostics.html#methodology-and-sources', reportLabel: 'See how Depth Synthesis works',
    },
    cross_lens_synthesis: {
      name: 'Cross-Lens Synthesis', type: 'cross',
      gatherTitle: 'Connect different views of the same work.',
      gatherDescription: 'Ask the people doing, managing and overseeing supplier onboarding about responsibilities, decisions, processes and performance.',
      gatherNext: 'Check participation and compatibility before combining evidence across diagnostics.',
      evaluateTitle: 'See which changes could release capacity.',
      evaluateDescription: 'Compare the four diagnostics together, then test a business case using separate operating records.',
      evaluateNext: "The planning case covers group evidence and operating inputs, not one person's run.",
      actionTitle: 'Fix ownership and review steps together.',
      actionOne: 'Name the person responsible for each supplier exception and the decision it needs.',
      actionTwo: 'Use one completeness checklist before review, while keeping required checks.',
      actionThree: 'Track exception handling and repeated reviews separately so benefits are not counted twice.',
      actionOwner: 'Operations director',
      actionMeasure: 'Hours spent on each activity, decision waiting time and supplier files completed correctly.',
      compareTitle: 'Check the improvement across all four diagnostics.',
      compareDescription: 'Repeat compatible campaigns for the same work. Compare the findings and actual operating records with the original plan.',
      reportHref: 'sample-report.html#synthesis', reportLabel: 'Read the Cross-Lens example',
    },
  };
  function selectJourney(key) {
    if (!Object.hasOwn(journeys, key)) return;
    const journey = journeys[key];
    const group = app.querySelector(`[data-demo-group="${key}"]`);
    const evidence = app.querySelector(`[data-demo-evaluation="${key}"]`);
    if (!evidence || (journey.type === 'depth' && !group)) return;
    const copy = { gatherNext: depthNext, evaluateNext: depthEvaluateNext, ...journey };
    app.querySelectorAll('[data-demo-copy]').forEach(el => {
      if (typeof copy[el.dataset.demoCopy] === 'string') el.textContent = copy[el.dataset.demoCopy];
    });
    app.querySelectorAll('[data-demo-product-label]').forEach(el => {
      el.textContent = journey.type === 'depth' ? `${journey.name} · Depth Synthesis` : journey.name;
    });
    app.querySelectorAll('[data-demo-evaluation]').forEach(el => { el.hidden = el !== evidence; });
    app.querySelectorAll('[data-demo-group]').forEach(el => { el.hidden = journey.type === 'depth' && el !== group; });
    const financial = preview.querySelector(`[data-demo-assumptions-for="${key}"]`);
    preview.querySelectorAll('[data-demo-assumptions-for]').forEach(el => { el.hidden = el !== financial; });
    preview.querySelector('.home-preview-method').hidden = !financial;
    const groups = [...app.querySelectorAll('[data-demo-group]')];
    // All four source groups contain the same approved participant set. The
    // generator checks that equality; never add them up as different people.
    const participants = (group || groups[0]).dataset.participants;
    const count = groups.length;
    const runs = groups.reduce((total, el) => total + Number(el.dataset.participants), 0);
    app.querySelector('[data-demo-participation]').textContent = journey.type === 'depth'
      ? `Example campaign: ${participants} people completed ${journey.name}, once each. Depth Synthesis compares these responses within one diagnostic.`
      : `The same ${participants} people completed all ${count} diagnostics: ${runs} runs, not ${runs} people.`;
    app.querySelector('[data-demo-baseline-label]').textContent = journey.type === 'depth' ? 'Saved group median' : 'Saved campaign';
    app.querySelector('[data-demo-baseline-value]').textContent = journey.type === 'depth' ? group.querySelector('[data-demo-lens]').textContent : String(runs);
    app.querySelector('[data-demo-baseline-context]').textContent = journey.type === 'depth'
      ? `${participants} participants · ${journey.name}` : `runs from ${participants} participants across ${count} diagnostics`;
    const link = app.querySelector('[data-demo-report-link]');
    link.href = journey.reportHref;
    link.replaceChildren(document.createTextNode(journey.reportLabel + ' '));
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '→'; link.append(arrow);
    app.dataset.demoSelectedJourney = key;
    app.dataset.demoJourneyType = journey.type;
    choices.forEach(input => { input.checked = input.value === key; });
  }
  choices.forEach(input => input.addEventListener('change', () => { if (input.checked) selectJourney(input.value); }));
  selectJourney(choices.find(input => input.checked)?.value || 'cross_lens_synthesis');
  app.querySelector('.hwd-journey-choice').hidden = false;
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
