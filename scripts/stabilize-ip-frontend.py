from pathlib import Path
import re
import subprocess

page_path = Path("institutional-performance.html")
page = page_path.read_text()

# The acceptance bridge must live in the production page's largest inline
# application script and remain inert for normal customers.
assert "__MONDERMAN_IP_ACCEPTANCE__" in page
assert "normalizeInstitutionalPerformanceCustomerResult" in page
assert "single_disclosed_run_exposure_model" in page
assert "expert_authored_instrument_design_reference" in page

# Remove any accidental duplicate bridge if multiple concurrent patch jobs
# applied the insertion. Keep the first complete block only.
marker = "// Internal release-test bridge."
positions = [m.start() for m in re.finditer(re.escape(marker), page)]
if len(positions) > 1:
    first = positions[0]
    for start in reversed(positions[1:]):
        end_marker = "})();\n"
        end = page.find(end_marker, start)
        if end < 0: raise SystemExit("Could not bound duplicate IP bridge")
        page = page[:start] + page[end + len(end_marker):]
page_path.write_text(page)

harness = Path("institutional-performance-acceptance-harness.html")
assert harness.exists()
text = harness.read_text()
assert text.count("Harness build 2026-08-14.1") >= 1
assert "window.runInstitutionalPerformanceAcceptance" in text
assert "window.__IP_ACCEPTANCE_DATASET__" in text

# Write a machine-readable source inventory used by the PR and later cleanup.
Path("scripts/ip_release_inventory.txt").write_text("\n".join([
    "production_page=institutional-performance.html",
    "temporary_harness=institutional-performance-acceptance-harness.html",
    "harness_build=2026-08-14.1",
    "production_bridge=__MONDERMAN_IP_ACCEPTANCE__",
    "report_contract=single_disclosed_run_exposure_model",
    "reference_basis=expert_authored_instrument_design_reference",
]) + "\n")
