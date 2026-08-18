from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRIAL = (ROOT / "pattern-trial.html").read_text(encoding="utf-8")
PATTERN = (ROOT / "plan-pattern.html").read_text(encoding="utf-8")
SHELL = (ROOT / "workspace-shell.js").read_text(encoding="utf-8")


def require(src: str, token: str, label: str) -> None:
    if token not in src:
        raise AssertionError(f"{label}: missing {token!r}")

for token in (
    "Use the full Pattern Workspace for 30 days.",
    "No card is required to start",
    "does not renew automatically",
    "/api/billing/start-pattern-trial",
    "pattern_trial_already_used",
    "trial_requires_admin",
    "Nothing was charged",
    "One Pattern trial per Workspace",
):
    require(TRIAL, token, "pattern-trial.html")

for token in (
    'href="pattern-trial.html"',
    "Start free 30-day trial",
    "No card required",
    "does not renew automatically",
):
    require(PATTERN, token, "plan-pattern.html")

for token in (
    "subscription_status",
    "pattern_trial_ends_at",
    'org.subscription_status === "trialing"',
    "Pattern trial · ${days} day",
):
    require(SHELL, token, "workspace-shell.js")

for forbidden in (
    "card required to start",
    "renews automatically after the trial",
    "charged automatically on day 30",
):
    if forbidden in TRIAL.lower():
        raise AssertionError(f"pattern-trial.html: forbidden trial claim {forbidden!r}")

print({"ok": True, "trial_days": 30, "card_required": False, "auto_renew": False, "one_trial_per_workspace": True})
print("Pattern trial customer contract regression passed.")
