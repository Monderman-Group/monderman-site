from pathlib import Path
import re

p = Path("institutional-performance.html")
s = p.read_text(encoding="utf-8")
pattern = re.compile(
    r'\n\s*\}\s*else if \(direction === "down"\) \{\s*\n'
    r'\s*return "The trajectory signal suggests some pressure may be easing\.[^\n]*\n'
    r'\s*\}\s*else \{\s*\n'
    r'\s*return "The trajectory signal suggests relative stability\.[^\n]*\n'
    r'\s*\}\s*\n'
)
s2, n = pattern.subn("\n", s, count=1)
if n != 1:
    raise SystemExit(f"expected one duplicated trajectory tail, found {n}")
p.write_text(s2, encoding="utf-8")
print("IP_SYNTAX_REPAIRED")
