from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "sample-report.html"
s = p.read_text(encoding="utf-8")

STYLE = r'''
<style id="sample-production-quadrant-css">
  /* Exact customer Diagnostic quadrant geometry and placement rules. */
  .sample-production-quadrant-wrap{display:grid;gap:10px}
  .sample-production-quad-with-yaxis{display:flex;align-items:stretch;gap:8px}
  .sample-production-axis-x,.sample-production-axis-y{font-size:.78rem;color:#6E6F73}
  .sample-production-axis-x{text-align:center}
  .sample-production-axis-y{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;flex:0 0 auto;padding:8px 0;align-self:stretch;display:flex;align-items:center;justify-content:center}
  .sample-production-quadrant-box{position:relative;height:320px;border:1px solid rgba(24,25,28,.16);border-radius:18px;overflow:hidden;flex:1;background-color:#FAFAF8}
  .sample-production-quadrant-box[data-y-threshold="50"]{background:radial-gradient(ellipse at 25% 28%,rgba(12,110,120,.06) 0%,transparent 50%),linear-gradient(to right,transparent calc(50% - 1px),rgba(24,25,28,.15) calc(50% - 1px),rgba(24,25,28,.15) calc(50% + 1px),transparent calc(50% + 1px)),linear-gradient(to top,transparent calc(50% - 1px),rgba(24,25,28,.15) calc(50% - 1px),rgba(24,25,28,.15) calc(50% + 1px),transparent calc(50% + 1px)),#FAFAF8}
  .sample-production-quadrant-box[data-y-threshold="67"]{background:radial-gradient(ellipse at 25% 28%,rgba(12,110,120,.06) 0%,transparent 50%),linear-gradient(to right,transparent calc(50% - 1px),rgba(24,25,28,.15) calc(50% - 1px),rgba(24,25,28,.15) calc(50% + 1px),transparent calc(50% + 1px)),linear-gradient(to top,transparent calc(67% - 1px),rgba(24,25,28,.15) calc(67% - 1px),rgba(24,25,28,.15) calc(67% + 1px),transparent calc(67% + 1px)),#FAFAF8}
  .sample-production-q-label{position:absolute;font-size:.8rem;line-height:1.35;color:#6E6F73;max-width:120px;z-index:1}
  .sample-production-q-tl{top:12px;left:12px}.sample-production-q-tr{top:12px;right:12px;text-align:right}.sample-production-q-bl{bottom:12px;left:12px}.sample-production-q-br{bottom:12px;right:12px;text-align:right}
  .sample-quadrant-dot{position:absolute;width:22px;height:22px;border-radius:999px;background:#0C6E78;border:3px solid rgba(255,255,255,.98);box-shadow:0 4px 14px rgba(12,110,120,.40),0 0 0 7px rgba(12,110,120,.10);transform:translate(-50%,-50%);z-index:0}
</style>
'''

if 'id="sample-production-quadrant-css"' not in s:
    s = s.replace('</head>', STYLE + '\n</head>', 1)
else:
    s = re.sub(r'<style id="sample-production-quadrant-css">.*?</style>', STYLE.strip(), s, count=1, flags=re.S)

CONFIG = {
    "os-quadrant": {
        "heading": "Governance weight &times; execution responsiveness",
        "x_label": "Governance weight", "y_label": "Execution responsiveness",
        "x": 68, "y": 44, "threshold": 50,
        "cells": ("Fast movement,<br>lighter governance", "Fast movement,<br>heavier governance", "Slow movement,<br>lighter governance", "Slow movement,<br>heavier governance"),
    },
    "dv-quadrant": {
        "heading": "Governance weight &times; execution responsiveness",
        "x_label": "Governance weight", "y_label": "Execution responsiveness",
        "x": 64, "y": 52, "threshold": 50,
        "cells": ("Fast movement,<br>lighter governance", "Fast movement,<br>heavier governance", "Slow movement,<br>lighter governance", "Slow movement,<br>heavier governance"),
    },
    "sc-quadrant": {
        "heading": "Governance weight &times; structural legibility",
        "x_label": "Governance weight", "y_label": "Structural legibility",
        "x": 56, "y": 50, "threshold": 67,
        "cells": ("High legibility<br>Low governance", "High legibility<br>High governance", "Low legibility<br>Low governance", "Low legibility<br>High governance"),
    },
    "ip-quadrant": {
        "heading": "Institutional condition &times; compensatory dependence",
        "x_label": "Compensatory dependence", "y_label": "Institutional condition",
        "x": 55, "y": 47, "threshold": 67,
        "cells": ("Sound condition<br>Low compensation", "Sound condition<br>High compensation", "Weak condition<br>Low compensation", "Weak condition<br>High compensation"),
    },
}

for section_id, cfg in CONFIG.items():
    section_pattern = re.compile(rf'(<section class="section" id="{re.escape(section_id)}">.*?<div class="panel"[^>]*>)(.*?)(<p style="flex:1;min-width:260px;margin:0;">)', re.S)
    m = section_pattern.search(s)
    if not m:
        raise SystemExit(f"could not locate generated quadrant panel: {section_id}")
    # Production getQuadrantCoordinates clamps both plotted coordinates to 8–92%.
    left = max(8, min(92, cfg["x"]))
    top = max(8, min(92, 100 - cfg["y"]))
    tl, tr, bl, br = cfg["cells"]
    graphic = f'''<div class="sample-quadrant sample-production-quadrant-wrap" data-production-component="diagnostic-quadrant" data-y-threshold="{cfg['threshold']}" role="img" aria-label="{cfg['heading']}: {cfg['x_label']} {cfg['x']}, {cfg['y_label']} {cfg['y']}" style="flex:0 1 430px;min-width:310px;max-width:100%;">
          <div class="sample-production-quad-with-yaxis">
            <div class="sample-production-axis-y">{cfg['y_label']}</div>
            <div class="sample-production-quadrant-box" data-y-threshold="{cfg['threshold']}">
              <div class="sample-production-q-label sample-production-q-tl">{tl}</div>
              <div class="sample-production-q-label sample-production-q-tr">{tr}</div>
              <div class="sample-production-q-label sample-production-q-bl">{bl}</div>
              <div class="sample-production-q-label sample-production-q-br">{br}</div>
              <div class="sample-quadrant-dot" style="left:{left}%;top:{top}%;"></div>
            </div>
          </div>
          <div class="sample-production-axis-x">{cfg['x_label']}</div>
          <p class="muted" style="margin:8px 0 0 28px;font-size:.8rem;">Representative plotted values: {cfg['x_label']} {cfg['x']}/100 &middot; {cfg['y_label']} {cfg['y']}/100.</p>
        </div>'''
    s = s[:m.start(2)] + graphic + s[m.end(2):]

p.write_text(s, encoding="utf-8")
print("SAMPLE_QUADRANTS_ALIGNED_TO_PRODUCTION_COMPONENT")
