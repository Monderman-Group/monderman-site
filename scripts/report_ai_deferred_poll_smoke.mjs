// Mock-only scheduling regression for MondermanReport.mountAIInterpretation.
// This does not contact the API, a customer account, or a model.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const reportSource = process.env.MONDERMAN_REPORT_SOURCE
  ? readFileSync(process.env.MONDERMAN_REPORT_SOURCE, "utf8")
  : readFileSync(new URL("../monderman-report.js", import.meta.url), "utf8");

const NOW = Date.parse("2026-09-09T05:00:00.000Z");
class FixedDate extends Date {
  constructor(value) { super(value === undefined ? NOW : value); }
  static now() { return NOW; }
}

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener, options = {}) {
    const values = this.listeners.get(type) || [];
    values.push({ listener, once:Boolean(options?.once) });
    this.listeners.set(type, values);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(value => value.listener !== listener));
  }
  dispatch(type) {
    const values = [...(this.listeners.get(type) || [])];
    for (const value of values) {
      value.listener({ type });
      if (value.once) this.removeEventListener(type, value.listener);
    }
  }
  count(type) { return (this.listeners.get(type) || []).length; }
}

class Element {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.innerHTML = "";
    this.isConnected = true;
    this.parent = null;
    this.children = [];
  }
  prepend(child) { child.parent = this; this.children.unshift(child); }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  querySelector(selector) {
    if (!selector.startsWith(".")) return null;
    const name = selector.slice(1);
    return this.children.find(child => String(child.className).split(/\s+/).includes(name)) || null;
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
    this.isConnected = false;
  }
  replaceWith(other) {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    this.parent.children[index] = other;
    other.parent = this.parent;
    this.parent = null;
    this.isConnected = false;
  }
}

class Timers {
  constructor() { this.nextId = 1; this.values = new Map(); }
  setTimeout = (callback, delay = 0) => {
    const id = this.nextId++;
    this.values.set(id, { callback, delay:Number(delay) });
    return id;
  };
  clearTimeout = id => { this.values.delete(id); };
  next() {
    const entry = this.values.entries().next().value;
    return entry ? { id:entry[0], ...entry[1] } : null;
  }
  async fireNext() {
    const entry = this.next();
    assert.ok(entry, "expected a scheduled poll");
    this.values.delete(entry.id);
    return entry.callback();
  }
}

function runtime() {
  const timers = new Timers();
  const documentEvents = new Events();
  const windowEvents = new Events();
  const ids = new Map();
  const document = {
    hidden:false,
    head:{appendChild(node){if(node.id)ids.set(node.id,node);return node;}},
    createElement:tag=>new Element(tag),
    getElementById:id=>ids.get(id)||null,
    addEventListener:documentEvents.addEventListener.bind(documentEvents),
    removeEventListener:documentEvents.removeEventListener.bind(documentEvents),
  };
  const window = {
    addEventListener:windowEvents.addEventListener.bind(windowEvents),
    removeEventListener:windowEvents.removeEventListener.bind(windowEvents),
  };
  window.window = window;
  const sandbox = {
    window, document, console, Intl, Date:FixedDate, Number, String, Array,
    Object, Math, JSON, RegExp, WeakSet, Blob, URL,
    setTimeout:timers.setTimeout, clearTimeout:timers.clearTimeout,
  };
  vm.runInNewContext(reportSource, sandbox, { filename:"monderman-report.js" });
  assert.equal(typeof window.MondermanReport?.mountAIInterpretation, "function");
  return { Report:window.MondermanReport, document, documentEvents, windowEvents, timers };
}

const pending = deferUntil => ({
  status:"pending",
  message:"Your measured report is available. Its AI interpretation is queued for the next daily processing window; no new run is needed.",
  ...(deferUntil ? { deferUntil } : {}),
});

let checks = 0;
const test = async (name, action) => { await action(); checks += 1; console.log(`PASS ${name}`); };

await test("future daily deferral is displayed and first read is not scheduled early", async () => {
  const state = runtime(), due = new FixedDate(NOW + 60 * 60 * 1000).toISOString();
  const host = new Element("main"), result = { ai_report:pending(due) };
  let calls = 0;
  const stop = state.Report.mountAIInterpretation(host, result, async () => { calls += 1; return { ai_report:pending(due) }; });
  assert.equal(host.children.length, 1);
  assert.match(host.children[0].innerHTML, new RegExp(`datetime="${due.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(host.children[0].innerHTML, /not a completion guarantee/i);
  assert.equal(state.timers.next().delay, 60 * 60 * 1000);
  assert.equal(calls, 0);
  stop();
});

await test("timer uses the documented 15-second floor and 24-hour-five-minute ceiling", async () => {
  for (const [offset, expected] of [[1000,15000],[2 * 86400000,86700000]]) {
    const state = runtime(), host = new Element("main");
    const stop = state.Report.mountAIInterpretation(host, { ai_report:pending(new FixedDate(NOW + offset).toISOString()) }, async () => null);
    assert.equal(state.timers.next().delay, expected);
    stop();
  }
});

await test("twenty actual failed reads remain available and then polling stops", async () => {
  const state = runtime(), host = new Element("main"), result = { ai_report:pending() };
  let calls = 0;
  state.Report.mountAIInterpretation(host, result, async () => { calls += 1; throw new Error("synthetic transient read failure"); });
  while (state.timers.next()) await state.timers.fireNext();
  assert.equal(calls, 20);
  assert.equal(state.timers.values.size, 0);
  assert.equal(state.documentEvents.count("visibilitychange"), 0);
  assert.equal(state.windowEvents.count("pagehide"), 0);
});

await test("hidden pages pause without spending a read and visibility resumes once", async () => {
  const state = runtime(), host = new Element("main"), result = { ai_report:pending() };
  let calls = 0;
  state.Report.mountAIInterpretation(host, result, async () => { calls += 1; return { ai_report:pending() }; });
  state.document.hidden = true;
  await state.timers.fireNext();
  assert.equal(calls, 0);assert.equal(state.timers.values.size, 0);
  state.documentEvents.dispatch("visibilitychange");
  assert.equal(state.timers.values.size, 0);
  state.document.hidden = false;
  state.documentEvents.dispatch("visibilitychange");
  assert.equal(state.timers.next().delay, 15000);
  await state.timers.fireNext();
  assert.equal(calls, 1);assert.equal(state.timers.values.size, 1);
});

await test("an in-flight refresh cannot overlap through visibility events", async () => {
  const state = runtime(), host = new Element("main"), result = { ai_report:pending() };
  let calls = 0, release;
  const blocked = new Promise(resolve => { release = resolve; });
  state.Report.mountAIInterpretation(host, result, async () => { calls += 1; await blocked; return { ai_report:pending() }; });
  const active = state.timers.fireNext();
  await Promise.resolve();
  assert.equal(calls, 1);assert.equal(state.timers.values.size, 0);
  state.documentEvents.dispatch("visibilitychange");
  state.documentEvents.dispatch("visibilitychange");
  assert.equal(state.timers.values.size, 0);assert.equal(calls, 1);
  release();await active;
  assert.equal(state.timers.values.size, 1);assert.equal(calls, 1);
});

await test("pagehide during an in-flight read prevents repaint and rescheduling", async () => {
  const state = runtime(), host = new Element("main"), result = { ai_report:pending() };
  let calls = 0, release;
  const blocked = new Promise(resolve => { release = resolve; });
  const completed = { status:"complete", report:{ model:"claude-opus-5", interpretation:{ summary:"Must not paint after pagehide.", observations:[], hypotheses:[], recommendations:[], limitations:[] }, limitations:[], sources:[], benchmark:{ explanation:"No comparable benchmark." } } };
  state.Report.mountAIInterpretation(host, result, async () => { calls += 1; await blocked; return { ai_report:completed }; });
  const active = state.timers.fireNext();await Promise.resolve();
  state.windowEvents.dispatch("pagehide");release();await active;
  assert.equal(calls, 1);assert.equal(result.ai_report.status, "pending");
  assert.doesNotMatch(host.children[0].innerHTML, /Must not paint after pagehide/);
  assert.equal(state.timers.values.size, 0);assert.equal(state.documentEvents.count("visibilitychange"), 0);assert.equal(state.windowEvents.count("pagehide"), 0);
});

await test("a refreshed deferUntil controls the next read", async () => {
  const state = runtime(), host = new Element("main"), first = new FixedDate(NOW + 60000).toISOString(), second = new FixedDate(NOW + 7200000).toISOString();
  const result = { ai_report:pending(first) };
  state.Report.mountAIInterpretation(host, result, async () => ({ ai_report:pending(second) }));
  assert.equal(state.timers.next().delay, 60000);
  await state.timers.fireNext();
  assert.equal(result.ai_report.deferUntil, second);
  assert.equal(state.timers.next().delay, 7200000);
});

await test("completion paints once and removes all future polling hooks", async () => {
  const state = runtime(), host = new Element("main"), result = { ai_report:pending() };
  const completed = { status:"complete", report:{ model:"claude-opus-5", interpretation:{ summary:"Synthetic completed interpretation.", observations:[], hypotheses:[], recommendations:[], limitations:[] }, limitations:[], sources:[], benchmark:{ explanation:"No comparable benchmark." } } };
  let calls = 0;
  state.Report.mountAIInterpretation(host, result, async () => { calls += 1; return { ai_report:completed }; });
  await state.timers.fireNext();
  assert.equal(calls, 1);assert.match(host.children[0].innerHTML, /Synthetic completed interpretation/);
  assert.equal(state.timers.values.size, 0);assert.equal(state.documentEvents.count("visibilitychange"), 0);assert.equal(state.windowEvents.count("pagehide"), 0);
});

await test("disconnect, pagehide and explicit stop each cancel without a read", async () => {
  for (const mode of ["disconnect","pagehide","explicit"]) {
    const state = runtime(), host = new Element("main"), result = { ai_report:pending() };
    let calls = 0;
    const stop = state.Report.mountAIInterpretation(host, result, async () => { calls += 1; return { ai_report:pending() }; });
    if (mode === "disconnect") { host.children[0].isConnected = false; await state.timers.fireNext(); }
    if (mode === "pagehide") state.windowEvents.dispatch("pagehide");
    if (mode === "explicit") stop();
    assert.equal(calls, 0, mode);assert.equal(state.timers.values.size, 0, mode);
    assert.equal(state.documentEvents.count("visibilitychange"), 0, mode);assert.equal(state.windowEvents.count("pagehide"), 0, mode);
  }
});

console.log(`Report AI deferred polling: ${checks} mock-only lifecycle checks passed. No API, customer account, model, database, or network was used.`);
