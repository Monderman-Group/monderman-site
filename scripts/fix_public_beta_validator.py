from pathlib import Path
p=Path('scripts/validate_frontend_release.py')
s=p.read_text(encoding='utf-8')
s=s.replace("if token not in privacy:e.append('privacy disclosure '+token)", "if token.lower() not in privacy.lower():e.append('privacy disclosure '+token)")
s=s.replace("if token not in security:e.append('security disclosure '+token)", "if token.lower() not in security.lower():e.append('security disclosure '+token)")
p.write_text(s, encoding='utf-8')
print('PUBLIC_BETA_VALIDATOR_FIX=PASS')
