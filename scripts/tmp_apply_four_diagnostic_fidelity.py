from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(name): return (ROOT / name).read_text(encoding="utf-8")
def write(name, text): (ROOT / name).write_text(text, encoding="utf-8")

def replace_once(text, old, new, label, required=True):
    count = text.count(old)
    if required and count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    if not count:
        return text
    return text.replace(old, new, 1)

def replace_regex_once(text, pattern, repl, label):
    text2, n = re.subn(pattern, repl, text, count=1, flags=re.S | re.M)
    if n != 1: raise SystemExit(f"{label}: expected 1 regex match, found {n}")
    return text2

ARROW_FUNCTION = '''function renderTrajectorySparkline(result) {
const mount = $("trajectorySparkline");
const chipMount = $("trajectoryChipMount");
const note = $("trajectorySparklineNote");
if (!mount || !chipMount) return;
const dir = result?.trajectory?.direction || "flat";
const color = dir === "up" ? "#B0392F" : dir === "down" ? "#3C8A60" : "#C9821F";
const arrow = dir === "up" ? "↗" : dir === "down" ? "↘" : "→";
// A single run cannot supply a time series. Show the reported direction as a
// symbol rather than drawing fabricated historical points.
mount.innerHTML = `<text x="60" y="25" text-anchor="middle" font-size="24" font-weight="700" fill="${color}">${arrow}</text>`;
chipMount.innerHTML = $("trajectorySignalWrap")?.innerHTML || "";
if (note) note.textContent = result?.trajectory?.note || "Single-run directional signal";
}'''

def replace_sparkline(text, label):
    return replace_regex_once(text, r'^function renderTrajectorySparkline\(result\) \{.*?^\}', ARROW_FUNCTION, label)

# ---------------------------------------------------------------------------
# Production Diagnostic report surfaces: do not imply longitudinal observations
# from one run. DV already has this contract; align OS, SC and IP to it.
# ---------------------------------------------------------------------------
os = replace_sparkline(read("operational-systems.html"), "OS trajectory renderer")
os_repls = [
    ('id="scoreMetaTrajectoryText">Trajectory: --', 'id="scoreMetaTrajectoryText">Self-reported change: --'),
    ('<strong>Trajectory</strong><br>Trajectory indicates whether burden pressure appears to be rising, holding steady, or easing based on the current signal pattern.', '<strong>Self-reported change</strong><br>This records the participant\'s reported change direction in the current run. It is not a measured longitudinal trend.'),
    ('>Trajectory signal will appear here after scoring.<', '>Self-reported change signal will appear here after scoring.<'),
    ('<h4>Trajectory</h4>', '<h4>Self-reported change</h4>'),
    ('>Trajectory interpretation will appear here after scoring.<', '>Self-reported change interpretation will appear here after scoring.<'),
    ('<p class="summary-label">Trajectory</p>', '<p class="summary-label">Self-reported change</p>'),
    ('<p class="summary-sub tight" id="trajectoryValueSub">Directional signal</p>', '<p class="summary-sub tight" id="trajectoryValueSub">Not a longitudinal measurement</p>'),
    ('id="exportMetaBenchmark">Benchmark: --', 'id="exportMetaBenchmark">Design reference: --'),
    ('id="exportMetaTrajectory">Trajectory: --', 'id="exportMetaTrajectory">Self-reported change: --'),
    ('<strong>Trajectory:</strong> ${escapeHtml(trajectoryLabel)}', '<strong>Self-reported change:</strong> ${escapeHtml(trajectoryLabel)}'),
    ('<strong>Benchmark:</strong> ${escapeHtml(benchmarkPosition)}', '<strong>Design reference:</strong> ${escapeHtml(benchmarkPosition)}'),
    ('`Trajectory: ${result?.trajectory?.label || "No strong directional signal"}`', '`Self-reported change: ${result?.trajectory?.label || "Not established"}`'),
    ('within the comparable range for ${industry.sectorName}. The design reference is not itself evidence of peer performance; the case for change comes from trajectory, qualitative operating evidence, and recoverable capacity.', 'within the instrument design-reference range for ${industry.sectorName}. The design reference is not itself evidence of peer performance; the case for change comes from self-reported change evidence, qualitative operating evidence, and recoverable capacity.'),
]
for old,new in os_repls:
    if old in os: os = os.replace(old,new)
# Dynamic benchmark labels can occur more than once; they are all the same design-reference concept.
os = os.replace('`Benchmark: ${', '`Design reference: ${')
write("operational-systems.html", os)

sc = replace_sparkline(read("structural-clarity.html"), "SC change-pressure renderer")
sc = sc.replace('>Trajectory signal will appear here after scoring.<', '>Change-pressure risk signal will appear here after scoring.<')
write("structural-clarity.html", sc)

ip = replace_sparkline(read("institutional-performance.html"), "IP trajectory renderer")
ip_repls = [
    ('<strong>Clarity profile</strong><br>Concentrated means one dimension is clearly the primary institutional weakness. Distributed means weaknesses are spread across dimensions.', '<strong>Condition profile</strong><br>Concentrated means one dimension is clearly the primary institutional weakness. Distributed means weaknesses are spread across dimensions.'),
    ('id="scoreMetaTrajectoryText">Trajectory: --', 'id="scoreMetaTrajectoryText">Self-reported change: --'),
    ('<strong>Trajectory</strong><br>Trajectory indicates whether the institutional condition appears to be eroding, holding steady, or improving based on the current signal pattern.', '<strong>Self-reported change</strong><br>This records the participant\'s reported change direction in the current run. It is not a measured longitudinal trend or forecast.'),
    ('>Trajectory signal will appear here after scoring.<', '>Self-reported change signal will appear here after scoring.<'),
    ('Instrument reference range, opportunity range, and directional trajectory.', 'Instrument reference range, opportunity range, and self-reported change signal.'),
    ('<h4>Trajectory</h4>', '<h4>Self-reported change</h4>'),
    ('>Trajectory interpretation will appear here after scoring.<', '>Self-reported change interpretation will appear here after scoring.<'),
    ('<p class="summary-label">Trajectory</p>', '<p class="summary-label">Self-reported change</p>'),
    ('<p class="summary-sub tight" id="trajectoryValueSub">Directional signal</p>', '<p class="summary-sub tight" id="trajectoryValueSub">Not a longitudinal measurement</p>'),
    ('id="exportMetaBenchmark">Benchmark: --', 'id="exportMetaBenchmark">Design reference: --'),
    ('id="exportMetaTrajectory">Trajectory: --', 'id="exportMetaTrajectory">Self-reported change: --'),
    ('<strong>Trajectory:</strong> ${escapeHtml(trajectoryLabel)}', '<strong>Self-reported change:</strong> ${escapeHtml(trajectoryLabel)}'),
    ('<strong>Benchmark:</strong> ${escapeHtml(benchmarkPosition)}', '<strong>Design reference:</strong> ${escapeHtml(benchmarkPosition)}'),
    ('`Trajectory: ${result?.trajectory?.label || "No strong directional signal"}`', '`Self-reported change: ${result?.trajectory?.label || "Not established"}`'),
    ('within the comparable range for ${industry.sectorName}. The design reference is not itself evidence of peer performance; the case for change comes from trajectory, qualitative operating evidence, and recoverable capacity.', 'within the instrument design-reference range for ${industry.sectorName}. The design reference is not itself evidence of peer performance; the case for change comes from self-reported change evidence, qualitative operating evidence, and recoverable capacity.'),
    ('This run shows rising trajectory combined with limited input depth. The pattern points toward worsening drag, but the signal underlying that pattern is thin. Treat the direction of the read seriously while treating the magnitude as provisional — a follow-up run with broader participant coverage is the right next step before committing to large interventions.', 'This run contains a self-reported rising-strain signal combined with limited input depth. It is not a measured trend or forecast. Treat the direction as a prompt to investigate; a follow-up run with broader participant coverage is the right next step before committing to large interventions.'),
    ('This run shows rising trajectory combined with limited input depth. Treat the direction seriously while treating the magnitude as provisional. A follow-up run with broader participant coverage is the right next step before committing to large interventions.', 'This run contains a self-reported rising-strain signal combined with limited input depth. It is not a measured trend or forecast. A follow-up run with broader participant coverage is the right next step before committing to large interventions.'),
]
for old,new in ip_repls:
    if old in ip: ip = ip.replace(old,new)
ip = ip.replace('`Benchmark: ${', '`Design reference: ${')
ip = replace_regex_once(ip, r'  function buildTrajectoryNarrative\(direction\) \{.*?^  \}', '''  function buildTrajectoryNarrative(direction) {
  if (direction === "up") {
  return "This run contains a self-reported signal of rising strain. It is not a measured trend or forecast; repeat the Diagnostic before treating direction as longitudinal evidence.";
  } else if (direction === "down") {
  return "This run contains a self-reported signal of easing strain. It is not a measured trend; repeat the Diagnostic before treating the direction as sustained improvement.";
  } else {
  return "This run does not establish longitudinal change. A flat or unclear self-report is a current-run signal only; repeat measurement is required to establish direction over time.";
  }
  }''', "IP trajectory narrative")
ip = ip.replace('const trajectory = result?.trajectory?.direction === "up" ? " and the trajectory suggests it is still slipping" : result?.trajectory?.direction === "down" ? " though there are early signs it is easing" : "";', 'const trajectory = result?.trajectory?.direction === "up" ? " and this run includes a self-reported rising-strain signal" : result?.trajectory?.direction === "down" ? " and this run includes a self-reported easing-strain signal" : "";')
write("institutional-performance.html", ip)

# ---------------------------------------------------------------------------
# Marketing sample: replace obsolete capacity economics with current production
# capacity semantics and current-code-compatible representative inputs.
# ---------------------------------------------------------------------------
sample = read("sample-report.html")

def capacity_svg(prod, admin, drag, hours, cost, drag_pct, note):
    W=600; x=20; y=42; h=28
    pw=W*prod/100; aw=W*admin/100; dw=W*drag/100
    return f'''<div class="panel">
        <svg viewBox="0 0 640 142" role="img" aria-label="Capacity allocation" style="display:block;width:100%;height:auto;font-family:inherit;font-variant-numeric:tabular-nums lining-nums;-webkit-font-smoothing:antialiased;">
          <text x="20" y="18" fill="#9A9892" font-size="10" font-weight="700" letter-spacing=".12em">CAPACITY ALLOCATION</text>
          <rect x="{x}" y="{y}" width="{pw:.1f}" height="{h}" rx="4" fill="#0C6E78"/><rect x="{x+pw:.1f}" y="{y}" width="{aw:.1f}" height="{h}" fill="#9A9892"/><rect x="{x+pw+aw:.1f}" y="{y}" width="{dw:.1f}" height="{h}" rx="4" fill="#B0392F"/>
          <circle cx="24" cy="94" r="5" fill="#0C6E78"/><text x="36" y="98" fill="#18191C" font-size="12">Productive work {prod}%</text>
          <circle cx="224" cy="94" r="5" fill="#9A9892"/><text x="236" y="98" fill="#18191C" font-size="12">Necessary administrative load {admin}%</text>
          <circle cx="488" cy="94" r="5" fill="#B0392F"/><text x="500" y="98" fill="#18191C" font-size="12">Recoverable drag {drag}%</text>
          <text x="20" y="126" fill="#6E6F73" font-size="11">Measured burden: {hours:,} hrs · ${cost:,} · capacity drag {drag_pct}%</text>
        </svg>
        <p class="muted" style="margin:12px 0 0;font-size:.85rem;">{note}</p>
      </div>
      <p>Current-model representative inputs yield <strong>{hours:,} annual burden hours</strong>* and <strong>${cost:,}</strong>* in labor exposure, with capacity drag around {drag_pct}%*.</p>'''

def replace_capacity(text, section_id, replacement):
    pat = rf'(<section class="section" id="{section_id}">)(.*?)(</section>)'
    m = re.search(pat, text, re.S)
    if not m: raise SystemExit(f"missing section {section_id}")
    body = m.group(2)
    old_pat = r'<div class="panel">\s*<svg\b[^>]*aria-label="Where annual labor capacity goes".*?</svg>\s*<p class="muted"[^>]*>.*?</p>\s*</div>\s*<p>Directional modeling suggests.*?</p>'
    body2,n = re.subn(old_pat, replacement, body, count=1, flags=re.S)
    if n != 1: raise SystemExit(f"{section_id}: old capacity block match {n}")
    return text[:m.start()] + m.group(1) + body2 + m.group(3) + text[m.end():]

sample = replace_capacity(sample, "os-headline", capacity_svg(76,16,8,5280,485760,24,"Representative current-model inputs: 12 people per normal run × 600 runs/year × 16 coordination hours/run × 55% modeled burden attribution; 1,800 hours of annual capacity per person. The 55% attribution is an explicit model assumption, not a time study."))
sample = replace_capacity(sample, "dv-headline", capacity_svg(78,17,5,3128,344080,22,"Representative current-model inputs: 8 people per normal decision run × 1,150 decisions/year × 8 coordination hours/run × 34% score-responsive attribution; 1,800 hours of annual capacity per person. The attribution share is model-derived, not observed."))
sample = replace_capacity(sample, "sc-headline", capacity_svg(93,5,2,960,74880,7,"Representative current-model inputs: 8 people per normal run × 600 runs/year × 4 ambiguity-driven coordination hours/run × 40% score-responsive attribution; 1,800 hours of annual capacity per person. The attribution share is model-derived, not observed."))
sample = replace_capacity(sample, "ip-headline", capacity_svg(74,17,9,8448,844800,26,"Representative current-model inputs: 18 people per normal run × 240 tasking cycles/year × 64 coordination hours/run × 55% modeled burden attribution; 1,800 hours of annual capacity per person. The 55% attribution is an explicit model assumption, not a time study."))

# Narrative and cover economics are the same representative inputs as the charts.
repls = [
    ('roughly 31,500 hours a year, about $2.9 million in labor', 'roughly 5,280 hours a year, about $486,000 in labor'),
    ('roughly 5,500 hours a year, about $601,000 in labor', 'roughly 3,128 hours a year, about $344,000 in labor'),
    ('about $153,894 a year across roughly 2,000 hours', 'about $74,880 a year across roughly 960 hours'),
    ('roughly 58,800 hours a year — about $5.9 million in labor across a 204-person directorate', 'roughly 8,448 hours a year — about $844,800 in labor from the representative sampled pathway within a 204-person directorate'),
    ('Against comparable institutions the reading sits below range, and the composition explains why:', 'Against the Monderman instrument design reference the reading sits below range, and the composition explains why:'),
    ('Fragile performance condition', 'Degraded institutional condition'),
    ('$2,900,000 / yr measured burden', '$485,760 / yr measured burden'),
    ('$600,930 / yr measured burden', '$344,080 / yr measured burden'),
    ('$153,894 / yr measured burden', '$74,880 / yr measured burden'),
    ('$5,875,200 / yr measured burden', '$844,800 / yr measured burden'),
    ('140 people at $92/hr loaded, 9 admin hrs/person/wk', '140-person procurement function; 12 people per normal run at $92/hr loaded, 600 runs/yr, 16 coordination hrs/run'),
    ('90 people at $110/hr loaded, ~1,150 decisions/yr', '90-person talent function; 8 people per normal decision run at $110/hr loaded, ~1,150 decisions/yr, 8 coordination hrs/run'),
    ('96 people at $78/hr loaded, 14 standing meetings/wk', '96-person care-coordination function; 8 people per normal run at $78/hr loaded, 600 runs/yr, 4 ambiguity-driven coordination hrs/run'),
    ('204 people at $100/hr loaded, ~24 tasking cycles/yr', '204-person directorate; 18 people per normal run at $100/hr loaded, 240 tasking cycles/yr, 64 coordination hrs/run'),
    ('204 people at $100/hr loaded, roughly 24 tasking cycles a year', 'a 204-person directorate; 18 people per normal run at $100/hr loaded, 240 tasking cycles a year, 64 coordination hours per run'),
    ('Instrument version: config 1.1.0 · scorer operational_systems_high_score_good_2026_05_14_concentration_penalty', 'Instrument version: config 1.2.0 · scorer operational_systems_high_score_good_2026_08_13_experience_neutral_v3'),
    ('Instrument version: config 1.0.0 · scorer decision_velocity_high_score_good_2026_08_02_ceiling8_canonical_band_cuts', 'Instrument version: config 1.0.0 · scorer decision_velocity_high_score_good_2026_08_12_release_v3'),
    ('Instrument version: config 1.1.0 · scorer structural_clarity_high_score_good_2026_08_02_canonical_band_cuts', 'Instrument version: config 1.2.0 · scorer structural_clarity_high_score_good_2026_08_11_methodology_v4'),
    ('Instrument version: config 1.1.0 · scorer institutional_performance_high_score_good_2026_08_02_canonical_band_cuts', 'Instrument version: config 1.2.0 · scorer institutional_performance_high_score_good_2026_08_10_missingness_v2'),
]
for old,new in repls:
    if old in sample: sample = sample.replace(old,new)

# Change-signal sample sections: arrows are directional symbols, not time series.
def update_change_section(text, section_id, aria, prose, label_replace=None):
    pat = rf'(<section class="section" id="{section_id}">)(.*?)(</section>)'
    m = re.search(pat,text,re.S)
    if not m: raise SystemExit(f"missing {section_id}")
    body=m.group(2)
    body=body.replace('aria-label="Trajectory"', f'aria-label="{aria}"',1)
    if label_replace:
        body=body.replace(*label_replace)
    body,n=re.subn(r'<p class="muted" style="margin-top:14px;"><strong>Trajectory\.</strong>.*?</p>', prose, body, count=1, flags=re.S)
    if n!=1: raise SystemExit(f"{section_id}: trajectory prose match {n}")
    return text[:m.start()]+m.group(1)+body+m.group(3)+text[m.end():]

sample=update_change_section(sample,"os-update","Self-reported change",'<p class="muted" style="margin-top:14px;"><strong>Self-reported change.</strong> Operational creep is rising. This is a current-run self-report, not a measured longitudinal trend or forecast.</p>')
sample=update_change_section(sample,"dv-update","Self-reported change",'<p class="muted" style="margin-top:14px;"><strong>Self-reported change.</strong> Rising drag pressure. This is the participant\'s reported direction in the current run; it does not predict future accumulation.</p>')
sample=update_change_section(sample,"sc-update","Change-pressure risk",'<p class="muted" style="margin-top:14px;"><strong>Change-pressure risk.</strong> No elevated change-pressure signal. This is a single-run risk signal, not evidence of improvement, decline, or stability over time.</p>',('No strong directional signal','No elevated change-pressure signal'))

# IP exposes both fragility and the certified self-reported strain-change field.
sample=sample.replace('<p class="muted" style="margin-top:14px;"><strong>Fragility.</strong> Elevated</p>', '<p class="muted" style="margin-top:14px;"><strong>Fragility.</strong> Elevated</p><p class="muted" style="margin-top:8px;"><strong>Self-reported change.</strong> Rising strain. This current-run change signal is self-reported; it is not longitudinal or predictive.</p>')

# Hard stop if obsolete visual/economic claims survived.
for stale in ['aria-label="Where annual labor capacity goes"','Dimension dollars apportion the recoverable burden','likely to continue accumulating','Against comparable institutions','[18,20,22,25,28,31]']:
    if stale in sample: raise SystemExit(f"stale sample token remains: {stale}")
if sample.count('aria-label="Capacity allocation"') != 4: raise SystemExit('expected four capacity allocation visuals')
write("sample-report.html", sample)

print("FOUR_DIAGNOSTIC_FIDELITY_PATCH_APPLIED")
