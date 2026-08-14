from pathlib import Path

harness_path = Path("operational-systems-acceptance-harness.html")
harness = harness_path.read_text()
old = 'const recoverableModelParity=(reclaimPotential.amount==null&&ex.recoverable_cost==null)||(Number(reclaimPotential.amount)===Number(ex.recoverable_cost)&&Number(reclaimPotential.factor)===Number(ex.recoverable_share_percent)&&!/comparable operating conditions|sector peer/i.test(String(reclaimPotential.driverText||"")));'
new = 'const recoverableModelParity=(reclaimPotential.amount==null&&ex.recoverable_cost==null)||(Number(reclaimPotential.amount)===Number(ex.recoverable_cost)&&Number(reclaimPotential.factor)===Number(ex.recoverable_share_percent)&&!/comparable operating conditions/i.test(String(reclaimPotential.driverText||""))&&/no sector peer factor is added/i.test(String(reclaimPotential.driverText||"")));'
if old not in harness:
    if new not in harness:
        raise SystemExit("recoverable model parity anchor not found")
else:
    harness = harness.replace(old, new, 1)
harness_path.write_text(harness)

validation_path = Path("scripts/validate_os_output_integrity.py")
validation = validation_path.read_text()
anchor = 'assert "Harness build 2026-08-13.5" in harness\n'
addition = 'assert "Harness build 2026-08-13.5" in harness\nassert "no sector peer factor is added" in harness\n'
if addition not in validation:
    if anchor not in validation:
        raise SystemExit("validation insertion anchor not found")
    validation = validation.replace(anchor, addition, 1)
validation_path.write_text(validation)
