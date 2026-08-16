from pathlib import Path
p = Path(__file__).resolve().parents[1] / "sample-report.html"
s = p.read_text(encoding="utf-8")
repls = {
"Instrument version: config 1.1.0 &middot; scorer operational_systems_high_score_good_2026_05_14_concentration_penalty": "Instrument version: config 1.2.0 · scorer operational_systems_high_score_good_2026_08_13_experience_neutral_v3",
"Instrument version: config 1.0.0 &middot; scorer decision_velocity_high_score_good_2026_08_02_ceiling8_canonical_band_cuts": "Instrument version: config 1.0.0 · scorer decision_velocity_high_score_good_2026_08_12_release_v3",
"Instrument version: config 1.1.0 &middot; scorer structural_clarity_high_score_good_2026_08_02_canonical_band_cuts": "Instrument version: config 1.2.0 · scorer structural_clarity_high_score_good_2026_08_11_methodology_v4",
"Instrument version: config 1.1.0 &middot; scorer institutional_performance_high_score_good_2026_08_02_canonical_band_cuts": "Instrument version: config 1.2.0 · scorer institutional_performance_high_score_good_2026_08_10_missingness_v2",
}
for old,new in repls.items():
    if old not in s:
        raise SystemExit(f"missing provenance token: {old}")
    s=s.replace(old,new,1)
p.write_text(s,encoding="utf-8")
print("SAMPLE_PROVENANCE_FIXED")
