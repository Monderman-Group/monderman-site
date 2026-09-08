import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dialogModule = path.resolve(process.env.DV_RESULT_DIALOG_MODULE || path.join(root, "dv-result-dialog.js"));
const out = path.resolve(process.env.DV_RESULT_DIALOG_OUT || path.join(root, "output", "dv-result-dialog-smoke"));
fs.mkdirSync(out, { recursive: true });
const fontFaceCss = [
  ["55font.woff2", 400],
  ["65font.woff2", 500],
  ["75font.woff2", 700]
].map(([filename, weight]) => {
  const encoded = fs.readFileSync(path.join(root, filename)).toString("base64");
  return `@font-face{font-family:"Neue Haas Grotesk";src:url(data:font/woff2;base64,${encoded}) format("woff2");font-style:normal;font-weight:${weight};font-display:block}`;
}).join("\n");

const fixture = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Decision Velocity result dialog fixture</title>
  <style>
    :root{--ink:#18191C;--ink-soft:#6E6F73;--ink-muted:#9A9892;--accent:#0C6E78;--amber:#C9821F}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif}
    body{padding:32px;background:#F6F3EC;color:#18191C}.fixture-main{max-width:900px;margin:auto;padding:40px;background:#fff}
    .fixture-widget{position:fixed;right:16px;bottom:16px;z-index:2147483000;padding:12px;background:#fff;border:1px solid #ccc}
    #mdn-cn-panel,#mdn-fb-panel,#mnd-panel{position:fixed;right:16px;bottom:70px;padding:20px;background:#fff;border:1px solid #ccc}
  </style>
</head>
<body>
  <button id="before-open" type="button">Open result</button>
  <main id="background-main" class="fixture-main">
    <h1>Decision Velocity</h1>
    <div id="source-slot">
      <span id="before-source">Result follows</span>
      <section id="result-source">
        <p class="dv-result-dialog__eyebrow">Decision Velocity Diagnostic</p>
        <div class="dv-result-dialog__score">
          <strong class="dv-result-dialog__score-number">63</strong>
          <span class="dv-result-dialog__score-meta">/ 100 · Constrained</span>
        </div>
        <p class="dv-result-dialog__message">This result is held for the current browser session. Create a free account to unlock the complete report without repeating the diagnostic.</p>
        <div class="dv-result-dialog__actions">
          <a id="result-primary" class="dv-result-dialog__button dv-result-dialog__button--primary" data-dv-dialog-initial-focus href="#signin">Create account / sign in</a>
          <a id="result-plans" class="dv-result-dialog__text-link" href="#plans">See plans</a>
        </div>
        <p class="dv-result-dialog__note">Your accepted answers remain attached to this session. Closing this view does not change or discard them.</p>
        <p class="dv-result-dialog__message">Your result reflects the submitted answers and the selected diagnostic depth. It is a directional organizational read, not a validated causal claim.</p>
        <p class="dv-result-dialog__message">The full report describes where approval density, coordination burden, escalation dependence, and key-person brittleness appear in the measured pathway.</p>
        <div class="dv-result-dialog__pilot">
          <p class="dv-result-dialog__pilot-kicker">Limited Pattern Pilot</p>
          <p class="dv-result-dialog__pilot-copy"><strong>Take this from one leader to one team.</strong> Apply to examine the same bounded decision system across six to twelve people.</p>
          <a id="result-last-action" class="dv-result-dialog__button dv-result-dialog__button--pilot" href="#pilot">Apply to the pilot waitlist</a>
        </div>
      </section>
      <span id="after-source">Result ended</span>
    </div>
  </main>
  <section id="preserved-state" inert aria-hidden="false">Existing hidden and inert region</section>
  <div id="mnd-launcher" class="fixture-widget">Assistant</div>
  <div id="mnd-panel">Open assistant panel</div>
  <div id="mdn-cn-root"><button class="mdn-cn-launch">Contact</button><div id="mdn-cn-panel" class="mdn-cn-open">Open contact panel</div></div>
  <div id="mdn-fb-root"><button class="mdn-fb-launch">Feedback</button><div id="mdn-fb-panel">Open feedback panel</div></div>
  <script>
    window.resultActionClicks = 0;
    document.getElementById("result-primary").addEventListener("click", function (event) { event.preventDefault(); window.resultActionClicks += 1; });
  </script>
</body>
</html>`;
const viewports = [
  { name: "phone-short", width: 375, height: 667, textScale: 1 },
  { name: "phone", width: 390, height: 844, textScale: 1 },
  { name: "tablet-portrait", width: 768, height: 1024, textScale: 1 },
  { name: "tablet-landscape", width: 1024, height: 768, textScale: 1 },
  { name: "desktop", width: 1440, height: 1000, textScale: 1 },
  { name: "phone-200-percent-text", width: 390, height: 844, textScale: 2 }
];
const findings = [];

for (const [browserName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const viewport of viewports) {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: "reduce"
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(`console: ${message.text()}`);
        });

        await page.setContent(fixture, { waitUntil: "load" });
        await page.addStyleTag({ content: fontFaceCss });
        await page.addStyleTag({ path: path.join(root, "dv-result-dialog.css") });
        await page.addScriptTag({ path: dialogModule });
        await page.evaluate(() => document.fonts && document.fonts.ready);
        if (viewport.textScale !== 1) {
          await page.evaluate((scale) => { document.documentElement.style.fontSize = `${scale * 100}%`; }, viewport.textScale);
        }

        await page.locator("#before-open").focus();
        await page.evaluate(() => {
          window.dialogCloseReason = null;
          window.MondermanDVResultDialog.open({
            label: "Your condition read is ready",
            content: document.getElementById("result-source"),
            initialFocus: "#result-primary",
            onClose: (reason) => { window.dialogCloseReason = reason; }
          });
        });

        const label = `${browserName}/${viewport.name}`;
        const semantics = await page.evaluate(() => {
          const panel = document.querySelector(".dv-result-dialog__panel");
          const labelledBy = panel.getAttribute("aria-labelledby");
          return {
            role: panel.getAttribute("role"),
            modal: panel.getAttribute("aria-modal"),
            labelledBy,
            labelText: document.getElementById(labelledBy)?.textContent,
            activeId: document.activeElement?.id,
            apiOpen: window.MondermanDVResultDialog.isOpen(),
            sourceCount: document.querySelectorAll("#result-source").length
          };
        });
        assert.equal(semantics.role, "dialog", `${label}: missing dialog role`);
        assert.equal(semantics.modal, "true", `${label}: missing aria-modal`);
        assert.equal(semantics.labelText, "Your condition read is ready", `${label}: aria-labelledby does not resolve`);
        assert.equal(semantics.activeId, "result-primary", `${label}: initial focus did not enter the result`);
        assert.equal(semantics.apiOpen, true, `${label}: API does not report the open dialog`);
        assert.equal(semantics.sourceCount, 1, `${label}: result content was cloned or lost`);

        const background = await page.evaluate(() => {
          const inspect = (selector) => {
            const node = document.querySelector(selector);
            return {
              inert: node.inert === true || node.hasAttribute("inert"),
              ariaHidden: node.getAttribute("aria-hidden"),
              visibility: getComputedStyle(node).visibility,
              pointerEvents: getComputedStyle(node).pointerEvents
            };
          };
          return {
            main: inspect("#background-main"),
            assistant: inspect("#mnd-launcher"),
            connect: inspect("#mdn-cn-root"),
            feedback: inspect("#mdn-fb-root")
          };
        });
        assert.equal(background.main.inert, true, `${label}: main content is not inert`);
        assert.equal(background.main.ariaHidden, "true", `${label}: main content is not hidden from the accessibility tree`);
        for (const key of ["assistant", "connect", "feedback"]) {
          assert.equal(background[key].inert, true, `${label}: ${key} widget is not inert`);
          assert.equal(background[key].visibility, "hidden", `${label}: ${key} widget remains visible above the dialog`);
          assert.equal(background[key].pointerEvents, "none", `${label}: ${key} widget remains interactive`);
        }

        await page.evaluate(() => {
          const late = document.createElement("button");
          late.id = "late-widget";
          late.textContent = "Late widget";
          document.body.appendChild(late);
        });
        await page.waitForFunction(() => document.getElementById("late-widget")?.hasAttribute("inert"));

        const geometry = await page.evaluate(() => {
          const box = (node) => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
          };
          const panel = document.querySelector(".dv-result-dialog__panel");
          const scroll = document.querySelector(".dv-result-dialog__scroll");
          return {
            viewport: { width: innerWidth, height: innerHeight },
            panel: box(panel),
            scroll: box(scroll),
            scrollClientHeight: scroll.clientHeight,
            scrollHeight: scroll.scrollHeight,
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            panelOverflow: panel.scrollWidth - panel.clientWidth
          };
        });
        assert.ok(geometry.panel.left >= -1 && geometry.panel.right <= geometry.viewport.width + 1, `${label}: panel overflows horizontally`);
        assert.ok(geometry.panel.top >= -1 && geometry.panel.bottom <= geometry.viewport.height + 1, `${label}: panel overflows vertically`);
        assert.ok(geometry.documentOverflow <= 1, `${label}: dialog creates ${geometry.documentOverflow}px page overflow`);
        assert.ok(geometry.panelOverflow <= 1, `${label}: panel creates ${geometry.panelOverflow}px horizontal overflow`);
        assert.ok(geometry.scrollClientHeight > 0, `${label}: result scroll region collapsed`);

        await page.screenshot({ path: path.join(out, `${browserName}-${viewport.name}-top.png`), fullPage: false });

        const actionFit = [];
        const contentActions = page.locator(".dv-result-dialog__scroll a[href], .dv-result-dialog__scroll button:not([disabled])");
        for (let actionIndex = 0; actionIndex < await contentActions.count(); actionIndex += 1) {
          const fit = await contentActions.nth(actionIndex).evaluate((node) => {
            node.scrollIntoView({ block: "nearest", inline: "nearest" });
            const action = node.getBoundingClientRect();
            const scroller = node.closest(".dv-result-dialog__scroll").getBoundingClientRect();
            return {
              id: node.id || node.textContent.trim(),
              actionTop: action.top,
              actionBottom: action.bottom,
              actionLeft: action.left,
              actionRight: action.right,
              scrollTop: scroller.top,
              scrollBottom: scroller.bottom,
              scrollLeft: scroller.left,
              scrollRight: scroller.right
            };
          });
          assert.ok(fit.actionTop >= fit.scrollTop - 1 && fit.actionBottom <= fit.scrollBottom + 1, `${label}/${fit.id}: action is not vertically reachable`);
          assert.ok(fit.actionLeft >= fit.scrollLeft - 1 && fit.actionRight <= fit.scrollRight + 1, `${label}/${fit.id}: action is not horizontally reachable`);
          actionFit.push(fit);
        }

        await page.locator(".dv-result-dialog__scroll").evaluate((node) => { node.scrollTop = node.scrollHeight; });
        const lastAction = await page.locator("#result-last-action").evaluate((node) => {
          const action = node.getBoundingClientRect();
          const scroller = node.closest(".dv-result-dialog__scroll").getBoundingClientRect();
          return { actionTop: action.top, actionBottom: action.bottom, scrollTop: scroller.top, scrollBottom: scroller.bottom };
        });
        assert.ok(lastAction.actionTop >= lastAction.scrollTop - 1, `${label}: last action scrolls above the visible result region`);
        assert.ok(lastAction.actionBottom <= lastAction.scrollBottom + 1, `${label}: last action cannot be reached by scrolling`);

        await page.screenshot({ path: path.join(out, `${browserName}-${viewport.name}-bottom.png`), fullPage: false });

        await page.locator("#result-primary").click();
        assert.equal(await page.evaluate(() => window.resultActionClicks), 1, `${label}: moving the result discarded its event handlers`);

        // The real teaser has three links, not a primary button. Safari may
        // skip links during native Tab traversal, so test every starting action
        // in both directions for more than a complete cycle, without Alt+Tab.
        const focusOrder = [".dv-result-dialog__close", "#result-primary", "#result-plans", "#result-last-action"];
        const keyboardCycles = [];
        for (let startIndex = 0; startIndex < focusOrder.length; startIndex += 1) {
          for (const direction of [1, -1]) {
            await page.locator(focusOrder[startIndex]).focus();
            for (let step = 1; step <= focusOrder.length + 1; step += 1) {
              await page.keyboard.press(direction === 1 ? "Tab" : "Shift+Tab");
              const expected = focusOrder[(startIndex + direction * step + focusOrder.length * 2) % focusOrder.length];
              const focused = await page.locator(expected).evaluate((node) => {
                const action = node.getBoundingClientRect();
                const scroller = node.closest(".dv-result-dialog__scroll");
                const visibleRegion = (scroller || node.closest(".dv-result-dialog__panel")).getBoundingClientRect();
                return {
                  matches: document.activeElement === node,
                  activeTag: document.activeElement?.tagName,
                  visible: action.top >= visibleRegion.top - 1 && action.bottom <= visibleRegion.bottom + 1
                    && action.left >= visibleRegion.left - 1 && action.right <= visibleRegion.right + 1
                };
              });
              assert.equal(focused.matches, true, `${label}: keyboard cycle from ${focusOrder[startIndex]} direction ${direction} step ${step} missed ${expected}; active=${focused.activeTag}`);
              assert.equal(focused.visible, true, `${label}: keyboard-focused action ${expected} is outside its visible scroll region`);
            }
            keyboardCycles.push({ start: focusOrder[startIndex], direction, steps: focusOrder.length + 1 });
          }
        }

        // Tab from the programmatically focused panel enters its first action;
        // reverse Tab enters its last. Dynamic focus loss must recover too.
        for (const direction of [1, -1]) {
          await page.locator(".dv-result-dialog__panel").focus();
          await page.keyboard.press(direction === 1 ? "Tab" : "Shift+Tab");
          assert.equal(await page.locator(direction === 1 ? focusOrder[0] : focusOrder.at(-1)).evaluate(node => document.activeElement === node), true, `${label}: panel-focus navigation failed`);
          await page.evaluate(() => {
            const temporary = document.createElement("a");
            temporary.href = "#temporary";
            temporary.textContent = "Temporary action";
            document.querySelector(".dv-result-dialog__content").appendChild(temporary);
            temporary.focus();
            temporary.remove();
          });
          await page.keyboard.press(direction === 1 ? "Tab" : "Shift+Tab");
          assert.equal(await page.locator(direction === 1 ? focusOrder[0] : focusOrder.at(-1)).evaluate(node => document.activeElement === node), true, `${label}: dynamically removed current action did not recover`);
        }

        // These otherwise-matching nodes must never enter the keyboard cycle.
        await page.evaluate(() => {
          const excluded = document.createElement("div");
          excluded.id = "excluded-actions";
          excluded.innerHTML = '<a href="#negative" tabindex="-1">Negative tab index</a><a href="#negative-two" tabindex="-2">Other negative tab index</a><button disabled>Disabled</button><a href="#hidden" hidden>Hidden</a><a href="#visibility" style="visibility:hidden">Invisible</a><a href="#aria-hidden" aria-hidden="true">Hidden from accessibility</a><fieldset disabled><button>Disabled by fieldset</button></fieldset>';
          document.querySelector(".dv-result-dialog__content").appendChild(excluded);
        });
        await page.locator("#result-last-action").focus();
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("dv-result-dialog__close")), true, `${label}: Tab escaped after the last result action`);
        await page.keyboard.press("Shift+Tab");
        assert.equal(await page.evaluate(() => document.activeElement?.id), "result-last-action", `${label}: Shift+Tab escaped before the close control`);
        await page.locator("#excluded-actions").evaluate(node => node.remove());

        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !window.MondermanDVResultDialog.isOpen());

        const restored = await page.evaluate(() => {
          const source = document.getElementById("result-source");
          const main = document.getElementById("background-main");
          const preserved = document.getElementById("preserved-state");
          const late = document.getElementById("late-widget");
          return {
            reason: window.dialogCloseReason,
            activeId: document.activeElement?.id,
            sourceParent: source?.parentElement?.id,
            previousElement: source?.previousElementSibling?.id,
            nextElement: source?.nextElementSibling?.id,
            sourceText: source?.querySelector(".dv-result-dialog__score-number")?.textContent,
            mainInert: main.inert === true || main.hasAttribute("inert"),
            mainHasAria: main.hasAttribute("aria-hidden"),
            preservedInert: preserved.inert === true || preserved.hasAttribute("inert"),
            preservedAria: preserved.getAttribute("aria-hidden"),
            lateInert: late.inert === true || late.hasAttribute("inert"),
            lateHasAria: late.hasAttribute("aria-hidden"),
            overlayCount: document.querySelectorAll("[data-dv-result-dialog]").length
          };
        });
        assert.equal(restored.reason, "escape", `${label}: Escape close reason was not reported`);
        assert.equal(restored.activeId, "before-open", `${label}: focus did not return to its prior control`);
        assert.equal(restored.sourceParent, "source-slot", `${label}: result did not return to its original parent`);
        assert.equal(restored.previousElement, "before-source", `${label}: result did not return to its exact source position`);
        assert.equal(restored.nextElement, "after-source", `${label}: source placeholder was not removed cleanly`);
        assert.equal(restored.sourceText, "63", `${label}: closing changed or discarded the score`);
        assert.equal(restored.mainInert, false, `${label}: background inert state was not removed`);
        assert.equal(restored.mainHasAria, false, `${label}: background aria-hidden state was not removed`);
        assert.equal(restored.preservedInert, true, `${label}: pre-existing inert state was not restored`);
        assert.equal(restored.preservedAria, "false", `${label}: pre-existing aria-hidden value was not restored`);
        assert.equal(restored.lateInert, false, `${label}: dynamically inserted background retained dialog inert state`);
        assert.equal(restored.lateHasAria, false, `${label}: dynamically inserted background retained dialog aria-hidden`);
        assert.equal(restored.overlayCount, 0, `${label}: closed overlay remains in the DOM`);

        await page.locator("#result-primary").click();
        assert.equal(await page.evaluate(() => window.resultActionClicks), 2, `${label}: restored result lost its event listener`);

        await page.evaluate(() => {
          window.MondermanDVResultDialog.open({
            label: "String content result",
            headingHidden: true,
            content: '<p id="string-result-copy">String content remains supported.</p><button id="string-result-action" data-dv-dialog-initial-focus type="button">Continue</button>',
            initialFocus: "#string-result-action"
          });
        });
        assert.equal(await page.locator("#string-result-copy").textContent(), "String content remains supported.", `${label}: string content did not render`);
        assert.equal(await page.evaluate(() => document.activeElement?.id), "string-result-action", `${label}: string-content initial focus failed`);
        await page.evaluate(() => window.MondermanDVResultDialog.close("test"));

        await page.evaluate(() => {
          window.MondermanDVResultDialog.open({
            label: "Dynamic action removal",
            content: '<a id="removable-action" href="#temporary">Temporary action</a><div id="editable-action" contenteditable="true">Editable field</div>',
            initialFocus: "#removable-action",
            returnFocus: document.getElementById("before-open")
          });
        });
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement?.id), "editable-action", `${label}: naturally focusable editable content was excluded`);
        await page.locator("#removable-action").focus();
        await page.locator("#removable-action").evaluate(node => node.remove());
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => window.MondermanDVResultDialog.isOpen()), false, `${label}: Escape did not close after the focused action was removed`);
        assert.equal(await page.evaluate(() => document.activeElement?.id), "before-open", `${label}: dynamic-removal Escape lost return focus`);

        await page.evaluate(() => {
          window.MondermanDVResultDialog.open({ label: "No available actions", content: '<p>No actions are currently available.</p>', dismissible: false });
        });
        for (const key of ["Tab", "Shift+Tab"]) {
          await page.keyboard.press(key);
          assert.equal(await page.locator(".dv-result-dialog__panel").evaluate(node => document.activeElement === node), true, `${label}: zero-action dialog lost focus`);
        }
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => window.MondermanDVResultDialog.isOpen()), true, `${label}: nondismissible dialog unexpectedly closed`);
        await page.evaluate(() => window.MondermanDVResultDialog.close("test"));

        assert.deepEqual(errors, [], `${label}: browser errors\n${errors.join("\n")}`);
        findings.push({ browser: browserName, ...viewport, geometry, actionFit, lastAction, keyboardCycles, status: "pass" });
        await page.close();
      }
    } finally {
      await browser.close();
    }
}

fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(findings, null, 2) + "\n");
console.log(`DV_RESULT_DIALOG_SMOKE_PASS ${findings.length} viewport/browser combinations; evidence: ${out}`);
