from pathlib import Path

p = Path("institutional-performance.html")
s = p.read_text(encoding="utf-8")
old = (
    '  } else if (direction === "down") {\n'
    '  return "The trajectory signal suggests some pressure may be easing. Verify that with measurement before assuming the problem is self-correcting; perceived improvement and structural improvement are not the same.";\n'
    '  } else {\n'
    '  return "The trajectory signal suggests relative stability. Stability here should not be confused with strength — a structure that looks stable can still be carrying real cost that people have simply gotten used to.";\n'
    '  }\n'
)
if old not in s:
    raise SystemExit("expected duplicated trajectory tail not found")
p.write_text(s.replace(old, "", 1), encoding="utf-8")
print("IP_SYNTAX_REPAIRED")
