from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "operational-systems.html",
    "decision-velocity.html",
    "structural-clarity.html",
    "institutional-performance.html",
]

failures = []
for filename in FILES:
    html = (ROOT / filename).read_text(encoding="utf-8")
    scripts = []
    for match in re.finditer(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", html, flags=re.I | re.S):
        attrs = match.group("attrs") or ""
        if re.search(r"\bsrc\s*=", attrs, flags=re.I):
            continue
        type_match = re.search(r"\btype\s*=\s*['\"]([^'\"]+)['\"]", attrs, flags=re.I)
        if type_match and type_match.group(1).lower() not in {"text/javascript", "application/javascript", "module"}:
            continue
        body = match.group("body")
        if body.strip():
            scripts.append(body)
    if not scripts:
        failures.append(f"{filename}: no inline JavaScript found")
        continue
    joined = "\n;\n".join(scripts)
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as handle:
        handle.write(joined)
        temp_path = handle.name
    proc = subprocess.run(["node", "--check", temp_path], text=True, capture_output=True)
    Path(temp_path).unlink(missing_ok=True)
    if proc.returncode != 0:
        failures.append(f"{filename}: inline JavaScript syntax failure\n{proc.stderr.strip()}")

if failures:
    print("DIAGNOSTIC_INLINE_JS_FAIL")
    for failure in failures:
        print("-", failure)
    raise SystemExit(1)
print("DIAGNOSTIC_INLINE_JS_PASS_4_OF_4")
