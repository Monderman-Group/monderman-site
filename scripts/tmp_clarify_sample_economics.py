from pathlib import Path

p = Path("sample-report.html")
s = p.read_text(encoding="utf-8")
replacements = {
    "Representative current-model inputs: 12 people per normal run × 600 runs/year × 16 coordination hours/run × 55% modeled burden attribution; 1,800 hours of annual capacity per person. The 55% attribution is an explicit model assumption, not a time study.":
    "Representative current-model burden estimate: 600 runs/year × 16 coordination hours/run × 55% modeled burden attribution = 5,280 burden hours. Capacity drag uses 12 people per normal run × 1,800 annual capacity hours/person. The 55% attribution is an explicit model assumption, not a time study.",
    "Representative current-model inputs: 8 people per normal decision run × 1,150 decisions/year × 8 coordination hours/run × 34% score-responsive attribution; 1,800 hours of annual capacity per person. The attribution share is model-derived, not observed.":
    "Representative current-model burden estimate: 1,150 decisions/year × 8 coordination hours/run × 34% score-responsive attribution = 3,128 burden hours. Capacity drag uses 8 people per normal decision run × 1,800 annual capacity hours/person. The attribution share is model-derived, not observed.",
    "Representative current-model inputs: 8 people per normal run × 600 runs/year × 4 ambiguity-driven coordination hours/run × 40% score-responsive attribution; 1,800 hours of annual capacity per person. The attribution share is model-derived, not observed.":
    "Representative current-model burden estimate: 600 runs/year × 4 ambiguity-driven coordination hours/run × 40% score-responsive attribution = 960 burden hours. Capacity drag uses 8 people per normal run × 1,800 annual capacity hours/person. The attribution share is model-derived, not observed.",
    "Representative current-model inputs: 18 people per normal run × 240 tasking cycles/year × 64 coordination hours/run × 55% modeled burden attribution; 1,800 hours of annual capacity per person. The 55% attribution is an explicit model assumption, not a time study.":
    "Representative current-model burden estimate: 240 tasking cycles/year × 64 coordination hours/run × 55% modeled burden attribution = 8,448 burden hours. Capacity drag uses 18 people per normal run × 1,800 annual capacity hours/person. The 55% attribution is an explicit model assumption, not a time study.",
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f"missing expected sample economics sentence: {old[:80]}")
    s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
print("SAMPLE_ECONOMICS_COPY_CLARIFIED")
