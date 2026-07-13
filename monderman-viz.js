/* monderman-viz.js
 * Monderman · Report Visualization Library (v1)
 *
 * Dependency-free SVG charts in an editorial register — band scales,
 * zone-shaded dot plots, composition bars, capacity waffles. Designed to
 * replace Chart.js gauges/donuts across the diagnostic report pages.
 *
 * Why SVG, not canvas: vector output stays crisp in the executive PDF
 * export at any scale; typography inherits the page font (Neue Haas);
 * everything is brand-token styled and print-safe.
 *
 * Every renderer is defensive: missing data → it renders what it can or
 * nothing at all, never throws. All charts are responsive via viewBox.
 *
 * API (each takes a container element or id, plus a data object):
 *   MViz.scoreScale(el, { score, band, calibration, benchmarkText })
 *   MViz.severityDots(el, { rows:[{label,value}], thresholds })
 *   MViz.shareBar(el, { segments:[{label,pct}] })
 *   MViz.capacityWaffle(el, { percent, caption })
 *   MViz.priorityPath(el, { steps:[{label,severity}] })
 *   MViz.trajectoryGlyph(el, { label })
 *   MViz.quadProfile(el, { points:[{label,score}] })   // synthesis page
 */
(function (global) {
  "use strict";

  /* ── theme ─────────────────────────────────────────────────────────── */
  const T = {
    ink: "#18191C",
    inkSoft: "#3A4754",
    muted: "#9A9892",
    hairline: "rgba(24,25,28,.10)",
    gridline: "rgba(24,25,28,.05)",
    accent: "#0C6E78",
    accentDark: "#0C4A50",
    accentSoft: "rgba(12,110,120,.11)",
    success: "#3C8A60",
    warning: "#C9821F",
    danger: "#B0392F",
    zoneHealthy: "rgba(60,138,96,.055)",
    zoneStrained: "rgba(201,130,31,.06)",
    zoneSevere: "rgba(176,57,47,.06)",
    fontAxis: "11px",
    fontLabel: "12.5px",
    fontValue: "13px"
  };

  /* ── svg helpers ───────────────────────────────────────────────────── */
  const NS = "http://www.w3.org/2000/svg";
  function S(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function txt(parent, x, y, str, opts) {
    const o = opts || {};
    const t = S("text", {
      x, y,
      fill: o.fill || T.inkSoft,
      "font-size": o.size || T.fontAxis,
      "font-weight": o.weight || 400,
      "text-anchor": o.anchor || "start",
      "dominant-baseline": o.baseline || "auto",
      "letter-spacing": o.spacing || "0"
    }, parent);
    t.textContent = str;
    return t;
  }
  function mount(el, w, h, ariaLabel) {
    const host = typeof el === "string" ? document.getElementById(el) : el;
    if (!host) return null;
    host.innerHTML = "";
    const svg = S("svg", {
      viewBox: `0 0 ${w} ${h}`,
      width: "100%",
      role: "img",
      "aria-label": ariaLabel || "chart",
      style: "display:block;font-family:inherit;font-variant-numeric:tabular-nums lining-nums;font-feature-settings:'tnum' 1,'lnum' 1;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;"
    });
    host.appendChild(svg);
    return svg;
  }
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }

  /* ════════════════════════════════════════════════════════════════════
   * 1. scoreScale — bullet/band chart replacing the gauge.
   *    A 0–100 horizontal scale showing: the sector's typical industry
   *    range (solid soft band), the opportunity range (hatched band),
   *    and this run's score as a strong marker. The score finally has
   *    visible reference context instead of floating in a dial.
   * ════════════════════════════════════════════════════════════════════ */
  function scoreScale(el, data) {
    const score = num(data && data.score);
    if (score === null) return;
    const cal = (data && data.calibration) || {};
    const iMin = num(cal.industryMin), iMax = num(cal.industryMax);
    const oMin = num(cal.opportunityMin), oMax = num(cal.opportunityMax);

    const W = 640, H = 132, L = 26, R = 26;
    const axW = W - L - R, axY = 84;
    const X = (v) => L + (clamp(v, 0, 100) / 100) * axW;

    const svg = mount(el, W, H, "Score in sector context");
    if (!svg) return;

    /* hatch pattern for the opportunity range */
    const defs = S("defs", {}, svg);
    const pat = S("pattern", { id: "mv-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    S("rect", { width: 6, height: 6, fill: "rgba(12,110,120,.07)" }, pat);
    S("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "rgba(12,110,120,.35)", "stroke-width": 1.4 }, pat);

    /* reference bands (drawn under the axis) */
    const bandY = axY - 16, bandH = 32;
    if (oMin !== null && oMax !== null) {
      S("rect", { x: X(oMin), y: bandY, width: X(oMax) - X(oMin), height: bandH, fill: "url(#mv-hatch)", rx: 3 }, svg);
      txt(svg, (X(oMin) + X(oMax)) / 2, bandY - 24, "OPPORTUNITY RANGE", { anchor: "middle", fill: T.muted, spacing: ".08em" });
      S("line", { x1: (X(oMin) + X(oMax)) / 2, y1: bandY - 19, x2: (X(oMin) + X(oMax)) / 2, y2: bandY - 4, stroke: T.hairline }, svg);
    }
    if (iMin !== null && iMax !== null) {
      S("rect", { x: X(iMin), y: bandY, width: X(iMax) - X(iMin), height: bandH, fill: T.accentSoft, rx: 3 }, svg);
      txt(svg, (X(iMin) + X(iMax)) / 2, axY + 34, "TYPICAL INDUSTRY RANGE", { anchor: "middle", fill: T.accentDark, spacing: ".08em" });
      S("line", { x1: (X(iMin) + X(iMax)) / 2, y1: axY + 17, x2: (X(iMin) + X(iMax)) / 2, y2: axY + 25, stroke: T.hairline }, svg);
    }

    /* axis */
    S("line", { x1: L, y1: axY, x2: W - R, y2: axY, stroke: T.hairline, "stroke-width": 1 }, svg);
    [0, 25, 50, 75, 100].forEach((v) => {
      S("line", { x1: X(v), y1: axY - 3, x2: X(v), y2: axY + 3, stroke: T.hairline }, svg);
      txt(svg, X(v), axY + 16, String(v), { anchor: "middle", fill: T.muted });
    });

    /* score marker — lozenge + numeral above */
    const sx = X(score);
    S("line", { x1: sx, y1: bandY - 6, x2: sx, y2: bandY + bandH + 6, stroke: T.ink, "stroke-width": 2.2 }, svg);
    const lozW = 56, lozH = 30, lozX = clamp(sx - lozW / 2, L, W - R - lozW), lozY = bandY - 44;
    S("rect", { x: lozX, y: lozY, width: lozW, height: lozH, rx: 3, fill: T.ink }, svg);
    txt(svg, lozX + lozW / 2, lozY + 20, String(Math.round(score)), { anchor: "middle", fill: "#fff", size: "15px", weight: 600 });
    S("path", { d: `M ${clamp(sx, lozX + 8, lozX + lozW - 8) - 5} ${lozY + lozH} l 5 6 l 5 -6 Z`, fill: T.ink }, svg);
  }

  /* ════════════════════════════════════════════════════════════════════
   * 2. severityDots — ranked dot plot replacing the donut.
   *    Each burden dimension as a dot on a 0–100 severity axis, with
   *    whisper-shaded zones (healthy <35 / strained 35–55 / severe >55,
   *    matching the engine's material-floor and note thresholds). Shows
   *    ABSOLUTE severity — pair with shareBar, which shows SHARE.
   * ════════════════════════════════════════════════════════════════════ */
  function severityDots(el, data) {
    const rows = ((data && data.rows) || [])
      .map((r) => ({ label: String(r.label || ""), value: num(r.value) }))
      .filter((r) => r.value !== null)
      .sort((a, b) => b.value - a.value);
    if (!rows.length) return;
    const th = (data && data.thresholds) || { strained: 35, severe: 55 };

    const rowH = 34, labelW = 188;
    const W = 640, L = labelW, R = 30, topPad = 30, botPad = 26;
    const H = topPad + rows.length * rowH + botPad;
    const axW = W - L - R;
    const X = (v) => L + (clamp(v, 0, 100) / 100) * axW;

    const svg = mount(el, W, H, "Burden severity by dimension");
    if (!svg) return;

    /* zones */
    const zoneTop = topPad - 8, zoneH = rows.length * rowH + 12;
    S("rect", { x: X(0), y: zoneTop, width: X(th.strained) - X(0), height: zoneH, fill: T.zoneHealthy }, svg);
    S("rect", { x: X(th.strained), y: zoneTop, width: X(th.severe) - X(th.strained), height: zoneH, fill: T.zoneStrained }, svg);
    S("rect", { x: X(th.severe), y: zoneTop, width: X(100) - X(th.severe), height: zoneH, fill: T.zoneSevere }, svg);
    txt(svg, X(th.strained / 2), zoneTop - 6, "CONTAINED", { anchor: "middle", fill: T.success, spacing: ".09em", size: "10px" });
    txt(svg, X((th.strained + th.severe) / 2), zoneTop - 6, "STRAINED", { anchor: "middle", fill: T.warning, spacing: ".09em", size: "10px" });
    txt(svg, X((th.severe + 100) / 2), zoneTop - 6, "SEVERE", { anchor: "middle", fill: T.danger, spacing: ".09em", size: "10px" });

    /* gridlines */
    [0, 25, 50, 75, 100].forEach((v) => {
      S("line", { x1: X(v), y1: zoneTop, x2: X(v), y2: zoneTop + zoneH, stroke: T.gridline }, svg);
      txt(svg, X(v), zoneTop + zoneH + 16, String(v), { anchor: "middle", fill: T.muted });
    });

    rows.forEach((r, i) => {
      const cy = topPad + i * rowH + rowH / 2 - 4;
      const dominant = i === 0;
      const dotColor = r.value >= th.severe ? T.danger : r.value >= th.strained ? T.warning : T.success;
      txt(svg, L - 12, cy + 4, r.label, { anchor: "end", fill: dominant ? T.ink : T.inkSoft, size: T.fontLabel, weight: dominant ? 700 : 400 });
      S("line", { x1: X(0), y1: cy, x2: X(r.value), y2: cy, stroke: T.hairline, "stroke-width": 1 }, svg);
      S("circle", { cx: X(r.value), cy, r: dominant ? 6.5 : 5, fill: dotColor, stroke: "#fff", "stroke-width": 1 }, svg);
      txt(svg, clamp(X(r.value) + 12, L, W - R - 8), cy + 4, String(Math.round(r.value)), { fill: T.ink, size: T.fontValue, weight: dominant ? 700 : 500 });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
   * 3. shareBar — single 100% composition bar + legend.
   *    Shows each dimension's SHARE of total burden — the authoritative
   *    composition the locked facts reference. Read together with
   *    severityDots, the pair makes the share-vs-absolute distinction
   *    visible instead of confusable.
   * ════════════════════════════════════════════════════════════════════ */
  function shareBar(el, data) {
    const segs = ((data && data.segments) || [])
      .map((s) => ({ label: String(s.label || ""), pct: num(s.pct) }))
      .filter((s) => s.pct !== null && s.pct > 0)
      .sort((a, b) => b.pct - a.pct);
    if (!segs.length) return;

    const W = 640, barH = 26, legendRowH = 24;
    const legendRows = segs.length;
    const H = 16 + barH + 18 + legendRows * legendRowH + 6;
    const svg = mount(el, W, H, "Burden composition — share of total");
    if (!svg) return;

    const palette = [T.accentDark, T.accent, "#3E8A92", "#7FB0B6", "#B5D0D3", "#DCE8E9"];
    let x = 0;
    const total = segs.reduce((s, g) => s + g.pct, 0) || 100;
    segs.forEach((g, i) => {
      const w = (g.pct / total) * (W - 0);
      S("rect", { x, y: 16, width: Math.max(w - 1.5, 0.5), height: barH, fill: palette[i % palette.length], rx: i === 0 ? 4 : 0 }, svg);
      if (w > 46) txt(svg, x + w / 2, 16 + barH / 2 + 4, Math.round(g.pct) + "%", { anchor: "middle", fill: i < 2 ? "#fff" : T.ink, size: "11.5px", weight: 600 });
      x += w;
    });

    segs.forEach((g, i) => {
      const ly = 16 + barH + 18 + i * legendRowH + 8;
      S("rect", { x: 0, y: ly - 9, width: 11, height: 11, rx: 2.5, fill: palette[i % palette.length] }, svg);
      txt(svg, 18, ly, g.label, { fill: i === 0 ? T.ink : T.inkSoft, size: T.fontLabel, weight: i === 0 ? 700 : 400 });
      txt(svg, W, ly, Math.round(g.pct) + "% of total burden", { anchor: "end", fill: T.muted, size: T.fontAxis });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
   * 4. capacityWaffle — 10×10 grid; each cell = 1% of productive capacity.
   *    Absorbed share tinted. The most immediately legible way to show
   *    "this much of your capacity is being consumed by drag."
   * ════════════════════════════════════════════════════════════════════ */
  function capacityWaffle(el, data) {
    const pct = num(data && data.percent);
    if (pct === null) return;
    const cells = clamp(Math.round(pct), 0, 100);

    const cols = 10, size = 17, gap = 4;
    const gridW = cols * size + (cols - 1) * gap;
    const W = 640, H = gridW + 34;
    const svg = mount(el, W, H, "Productive capacity absorbed");
    if (!svg) return;

    for (let i = 0; i < 100; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const absorbed = i < cells;
      S("rect", {
        x: c * (size + gap), y: r * (size + gap),
        width: size, height: size, rx: 1.5,
        fill: absorbed ? "rgba(176,57,47,.72)" : "rgba(24,25,28,.07)"
      }, svg);
    }
    const tx = gridW + 36;
    txt(svg, tx, 28, Math.round(pct) + "%", { fill: T.danger, size: "30px", weight: 600 });
    txt(svg, tx, 52, "of productive capacity absorbed", { fill: T.inkSoft, size: T.fontLabel });
    txt(svg, tx, 70, "by administrative and structural drag", { fill: T.inkSoft, size: T.fontLabel });
    if (data && data.caption) {
      String(data.caption).split("\n").forEach((line, i) => {
        txt(svg, tx, 98 + i * 18, line, { fill: T.muted, size: T.fontAxis });
      });
    }
    txt(svg, 0, gridW + 22, "Each cell = 1% of capacity", { fill: T.muted, size: "10px", spacing: ".05em" });
  }

  /* ════════════════════════════════════════════════════════════════════
   * 5. priorityPath — Fix now → Fix next → Monitor as an annotated
   *    sequence with severity chips, matching the canonical ladder.
   * ════════════════════════════════════════════════════════════════════ */
  function priorityPath(el, data) {
    const steps = ((data && data.steps) || [])
      .filter((s) => s && s.label)
      .slice(0, 3);
    if (!steps.length) return;
    const titles = ["FIX NOW", "FIX NEXT", "MONITOR"];

    const W = 640, colW = W / steps.length, H = 118;
    const svg = mount(el, W, H, "Intervention order");
    if (!svg) return;

    steps.forEach((s, i) => {
      const cx = i * colW;
      /* connecting arrow */
      if (i > 0) {
        S("line", { x1: cx - 26, y1: 56, x2: cx - 8, y2: 56, stroke: T.hairline, "stroke-width": 1.5 }, svg);
        S("path", { d: `M ${cx - 12} 51 l 7 5 l -7 5`, fill: "none", stroke: T.hairline, "stroke-width": 1.5 }, svg);
      }
      /* number badge */
      S("circle", { cx: cx + 14, cy: 18, r: 12, fill: i === 0 ? T.accentDark : "rgba(12,110,120,.14)" }, svg);
      txt(svg, cx + 14, 22.5, String(i + 1), { anchor: "middle", fill: i === 0 ? "#fff" : T.accentDark, size: "12px", weight: 700 });
      txt(svg, cx + 34, 14, titles[i] || "", { fill: T.muted, size: "10px", spacing: ".11em" });
      /* label — wrap to two lines max */
      const words = String(s.label).split(" ");
      let line1 = "", line2 = "";
      words.forEach((w) => {
        if ((line1 + " " + w).trim().length <= 20 && !line2) line1 = (line1 + " " + w).trim();
        else line2 = (line2 + " " + w).trim();
      });
      txt(svg, cx + 34, 34, line1, { fill: T.ink, size: "13.5px", weight: i === 0 ? 700 : 500 });
      if (line2) txt(svg, cx + 34, 52, line2, { fill: T.ink, size: "13.5px", weight: i === 0 ? 700 : 500 });
      /* severity chip */
      const sev = num(s.severity);
      if (sev !== null) {
        const chipY = line2 ? 64 : 48;
        const chipColor = sev >= 55 ? T.danger : sev >= 35 ? T.warning : T.success;
        S("rect", { x: cx + 34, y: chipY, width: 86, height: 20, rx: 3, fill: "rgba(24,25,28,.04)" }, svg);
        S("circle", { cx: cx + 45, cy: chipY + 10, r: 4, fill: chipColor }, svg);
        txt(svg, cx + 54, chipY + 14, "severity " + Math.round(sev), { fill: T.inkSoft, size: "11px" });
      }
    });
  }

  /* ════════════════════════════════════════════════════════════════════
   * 6. trajectoryGlyph — small slope arrow inferred from the trajectory
   *    label, with the label text beside it.
   * ════════════════════════════════════════════════════════════════════ */
  function trajectoryGlyph(el, data) {
    const label = String((data && data.label) || "").trim();
    if (!label) return;
    const l = label.toLowerCase();
    const dir = /(improv|lighter|recover|easing|better)/.test(l) ? 1
              : /(worsen|declin|heavier|deterior|accumulat|growing|compound)/.test(l) ? -1 : 0;

    const W = 640, H = 40;
    const svg = mount(el, W, H, "Trajectory");
    if (!svg) return;
    const color = dir === 1 ? T.success : dir === -1 ? T.danger : T.muted;
    const y1 = dir === 1 ? 28 : dir === -1 ? 12 : 20;
    const y2 = dir === 1 ? 12 : dir === -1 ? 28 : 20;
    S("line", { x1: 4, y1, x2: 40, y2, stroke: color, "stroke-width": 2.4, "stroke-linecap": "round" }, svg);
    const ang = Math.atan2(y2 - y1, 36);
    const ax = 40, ay = y2;
    S("path", {
      d: `M ${ax} ${ay} L ${ax - 9 * Math.cos(ang - 0.45)} ${ay - 9 * Math.sin(ang - 0.45)} M ${ax} ${ay} L ${ax - 9 * Math.cos(ang + 0.45)} ${ay - 9 * Math.sin(ang + 0.45)}`,
      stroke: color, "stroke-width": 2.4, fill: "none", "stroke-linecap": "round"
    }, svg);
    txt(svg, 56, 25, label, { fill: T.ink, size: "13.5px", weight: 500 });
  }

  /* ════════════════════════════════════════════════════════════════════
   * 7. quadProfile — the four diagnostics as one institutional profile
   *    (for the cross-assessment synthesis page): four columns, score dots,
   *    connecting profile line.
   * ════════════════════════════════════════════════════════════════════ */
  function quadProfile(el, data) {
    const pts = ((data && data.points) || [])
      .map((p) => ({ label: String(p.label || ""), score: num(p.score) }))
      .filter((p) => p.score !== null);
    if (pts.length < 2) return;

    const W = 640, H = 230, L = 40, R = 24, top = 22, bot = 44;
    const plotH = H - top - bot;
    const colW = (W - L - R) / (pts.length - 1);
    const Y = (v) => top + (1 - clamp(v, 0, 100) / 100) * plotH;

    const svg = mount(el, W, H, "Institutional profile across diagnostics");
    if (!svg) return;

    [0, 25, 50, 75, 100].forEach((v) => {
      S("line", { x1: L, y1: Y(v), x2: W - R, y2: Y(v), stroke: T.gridline }, svg);
      txt(svg, L - 8, Y(v) + 4, String(v), { anchor: "end", fill: T.muted, size: "10px" });
    });

    const path = pts.map((p, i) => `${i ? "L" : "M"} ${L + i * colW} ${Y(p.score)}`).join(" ");
    S("path", { d: path, fill: "none", stroke: T.accent, "stroke-width": 2.2 }, svg);

    pts.forEach((p, i) => {
      const x = L + i * colW;
      S("line", { x1: x, y1: top, x2: x, y2: top + plotH, stroke: T.gridline }, svg);
      S("circle", { cx: x, cy: Y(p.score), r: 5.5, fill: T.accentDark, stroke: "#fff", "stroke-width": 1.25 }, svg);
      txt(svg, x, Y(p.score) - 13, String(Math.round(p.score)), { anchor: "middle", fill: T.ink, size: "13px", weight: 700 });
      txt(svg, x, H - 22, p.label, { anchor: "middle", fill: T.inkSoft, size: "11.5px", weight: 500 });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
   * 8. effortFlow — Sankey of where labor capacity (and money) goes.
   *    Total annual capacity → Productive effort / Structural overhead /
   *    Recoverable burden → burden dimensions (in dollars).
   *
   *    Data contract (caller computes the economics; renderer lays out):
   *      { totalCost, totalHours, productiveCost, productiveHours,
   *        structuralCost, reclaimCost, dims:[{label, cost}], note }
   *    Degrades: if structural/reclaim split absent, renders a single
   *    "Administrative load" branch and fans dims from it.
   * ════════════════════════════════════════════════════════════════════ */
  let _uid = 0;
  const _chartToken = () => Math.random().toString(36).slice(2, 8);
  function fmtMoney(n) {
    const v = Math.abs(Number(n) || 0);
    const sign = Number(n) < 0 ? "-" : "";
    if (v >= 1e9) return sign + "$" + (v / 1e9).toFixed(1) + "B";
    if (v >= 1e6) return sign + "$" + (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return sign + "$" + Math.round(v / 1e3) + "K";
    return sign + "$" + Math.round(v);
  }
  function fmtHours(n) {
    const v = Number(n) || 0;
    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M hrs";
    if (v >= 1e3) return Math.round(v / 1e3) + "K hrs";
    return Math.round(v) + " hrs";
  }
  function ribbon(svg, x0, y0, h0, x1, y1, h1, color, id) {
    const cx = (x0 + x1) / 2;
    const g = S("linearGradient", { id, x1: "0", y1: "0", x2: "1", y2: "0" },
      svg.querySelector("defs") || S("defs", {}, svg));
    S("stop", { offset: "0%", "stop-color": color, "stop-opacity": ".10" }, g);
    S("stop", { offset: "100%", "stop-color": color, "stop-opacity": ".24" }, g);
    S("path", {
      d: `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}` +
         ` L ${x1} ${y1 + h1} C ${cx} ${y1 + h1}, ${cx} ${y0 + h0}, ${x0} ${y0 + h0} Z`,
      fill: `url(#${id})`
    }, svg);
  }
  function effortFlow(el, data) {
    const d = data || {};
    const totalCost = num(d.totalCost);
    if (totalCost === null || totalCost <= 0) return;
    const productiveCost = Math.max(0, num(d.productiveCost) || 0);
    const structuralCost = Math.max(0, num(d.structuralCost) || 0);
    const reclaimCost    = Math.max(0, num(d.reclaimCost) || 0);
    const hasSplit = structuralCost > 0 && reclaimCost > 0;
    const adminCost = hasSplit ? structuralCost + reclaimCost
                               : Math.max(0, totalCost - productiveCost);
    const fanCost = hasSplit ? reclaimCost : adminCost;

    /* merge dims: top 4 + Other, drop slivers */
    let dims = ((d.dims || [])
      .map((x) => ({ label: String(x.label || ""), cost: Math.max(0, num(x.cost) || 0) }))
      .filter((x) => x.cost > 0)
      .sort((a, b) => b.cost - a.cost));
    if (dims.length > 4) {
      const rest = dims.slice(4).reduce((s, x) => s + x.cost, 0);
      dims = dims.slice(0, 4);
      if (rest > 0) dims.push({ label: "Other burden", cost: rest });
    }

    /* geometry */
    const W = 640, plotH = 240, top = 34, gapB = 16;
    const xA = 2, xB = 236, xC = 380, nodeW = 11;
    const scale = plotH / totalCost;
    const hOf = (c) => Math.max(2, c * scale);

    /* pre-compute column B geometry */
    const C_PROD = T.accent, C_STRUCT = T.muted, C_RECLAIM = T.danger;
    const bDefs = hasSplit
      ? [
          { key: "prod",    label: "Productive effort",   cost: productiveCost, hours: d.productiveHours, color: C_PROD },
          { key: "struct",  label: "Structural overhead", cost: structuralCost, hours: null,              color: C_STRUCT, sub: "proportionate to operating in this sector" },
          { key: "reclaim", label: "Recoverable burden",  cost: reclaimCost,    hours: null,              color: C_RECLAIM, sub: "excess drag — the reclaim opportunity" }
        ]
      : [
          { key: "prod",  label: "Productive effort",   cost: productiveCost, hours: d.productiveHours, color: C_PROD },
          { key: "admin", label: "Administrative load", cost: adminCost,      hours: null,              color: C_RECLAIM }
        ];
    let yCursor = top;
    bDefs.forEach((n) => { n.h = hOf(n.cost); n.y = yCursor; yCursor += n.h + gapB; });

    /* pre-compute leaf rects (contiguous, proportional) + label ladder (min pitch) */
    const fanNode = bDefs[bDefs.length - 1];
    const PITCH = 19, MONEY_W = 66;
    const labelMaxChars = Math.floor((W - MONEY_W - 10 - (xC + 16)) / 6.3);
    const totalDim = dims.reduce((s, x) => s + x.cost, 0) || 1;
    let rectY = fanNode.y, prevLy = -Infinity;
    dims.forEach((x) => {
      x.srcH = fanNode.h * (x.cost / totalDim);
      x.leafH = Math.max(4, x.srcH);
      x.rectY = rectY; rectY += x.leafH + 4;
      const center = x.rectY + x.leafH / 2;
      x.ly = Math.max(center, prevLy + PITCH);
      prevLy = x.ly;
    });
    /* dynamic height: ladder + footnote must fit */
    const lastLy = dims.length ? dims[dims.length - 1].ly : top + plotH;
    const noteLines = d.note ? Math.min(3, Math.ceil(String(d.note).length / 116)) : 0;
    const H = Math.max(top + plotH + 46, Math.ceil(lastLy + 14 + 22)) + Math.max(0, noteLines - 1) * 13;

    const svg = mount(el, W, H, "Where annual labor capacity goes");
    if (!svg) return;
    S("defs", {}, svg);
    const leafTints = ["rgba(176,57,47,.90)", "rgba(176,57,47,.70)", "rgba(176,57,47,.54)", "rgba(176,57,47,.40)", "rgba(176,57,47,.28)"];

    /* column A — total */
    const hA = hOf(totalCost), yA = top;
    S("rect", { x: xA, y: yA, width: nodeW, height: hA, rx: 1.5, fill: T.ink }, svg);
    txt(svg, xA, yA - 18, "TOTAL ANNUAL CAPACITY", { fill: T.muted, size: "10px", spacing: ".11em" });
    txt(svg, xA, yA - 5, fmtMoney(totalCost) + (num(d.totalHours) ? "  ·  " + fmtHours(d.totalHours) : ""), { fill: T.ink, size: "13.5px", weight: 700 });

    /* column B */
    let aOff = 0, bLabelBottom = -Infinity;
    bDefs.forEach((n, i) => {
      const aH = hA * (n.cost / totalCost);
      ribbon(svg, xA + nodeW, yA + aOff, aH, xB, n.y, n.h, n.color, "mvg-" + _chartToken() + "-" + (++_uid));
      aOff += aH;
      S("rect", { x: xB, y: n.y, width: nodeW, height: n.h, rx: 1.5, fill: n.color }, svg);
      const ly = Math.max(n.y + 13, top + 8, bLabelBottom + 14);
      txt(svg, xB + nodeW + 9, ly, n.label, { fill: T.ink, size: "12.5px", weight: i === bDefs.length - 1 && hasSplit ? 700 : 600 });
      txt(svg, xB + nodeW + 9, ly + 15, fmtMoney(n.cost) + (num(n.hours) ? "  ·  " + fmtHours(n.hours) : ""), { fill: n.color === C_STRUCT ? T.inkSoft : n.color, size: "12px", weight: 700 });
      let bottom = ly + 15;
      if (n.sub && n.h > 44) { txt(svg, xB + nodeW + 9, ly + 30, n.sub, { fill: T.muted, size: "10px" }); bottom = ly + 30; }
      bLabelBottom = bottom;
    });

    /* column C — burden dimensions on the label ladder */
    if (dims.length && fanCost > 0) {
      dims.forEach((x, i) => {
        ribbon(svg, xB + nodeW, fanNode.y + dims.slice(0, i).reduce((s, p) => s + p.srcH, 0), x.srcH, xC, x.rectY, x.leafH, C_RECLAIM, "mvg-" + _chartToken() + "-" + (++_uid));
        S("rect", { x: xC, y: x.rectY, width: 9, height: x.leafH, rx: 1, fill: leafTints[i % leafTints.length] }, svg);
        /* leader tick when label displaced from rect center */
        const rectCenter = x.rectY + x.leafH / 2;
        if (Math.abs(x.ly - rectCenter) > 7) {
          S("path", { d: `M ${xC + 11} ${rectCenter} L ${xC + 13} ${x.ly} L ${xC + 14} ${x.ly}`, fill: "none", stroke: T.hairline, "stroke-width": 1 }, svg);
        }
        let label = x.label;
        if (label.length > labelMaxChars) label = label.slice(0, Math.max(1, labelMaxChars - 1)).trimEnd() + "…";
        txt(svg, xC + 18, x.ly + 4, label, { fill: T.ink, size: "11.5px", weight: i === 0 ? 600 : 500 });
        txt(svg, W - 4, x.ly + 4, fmtMoney(x.cost) + " / yr", { anchor: "end", fill: T.danger, size: "11px", weight: 700 });
      });
    }

    if (d.note) {
      const words = String(d.note).split(" ");
      const lines = [];
      let line = "";
      for (const w of words) {
        if ((line + " " + w).trim().length > 116) { lines.push(line.trim()); line = w; }
        else line = (line + " " + w);
      }
      if (line.trim()) lines.push(line.trim());
      lines.slice(0, 3).forEach((l, i) => txt(svg, 2, H - 8 - (Math.min(lines.length, 3) - 1 - i) * 13, l, { fill: T.muted, size: "10px" }));
    }
  }

  /* ── export ────────────────────────────────────────────────────────── */
  global.MViz = {
    theme: T,
    scoreScale,
    severityDots,
    shareBar,
    capacityWaffle,
    priorityPath,
    trajectoryGlyph,
    quadProfile,
    effortFlow,
    fmt,
    fmtMoney,
    fmtHours
  };
})(window);
