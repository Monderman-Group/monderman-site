#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f node_modules/playwright/cli.js ]]; then
  echo 'Expected pinned Playwright installation is missing.' >&2
  exit 1
fi
source "$(dirname "${BASH_SOURCE[0]}")/ci_ubuntu_apt_scope.sh"
echo 'Installing browser OS dependencies from signed official Ubuntu HTTPS repositories only.'
sudo env APT_CONFIG="$ci_apt_config" \
  "$(command -v node)" "$PWD/node_modules/playwright/cli.js" install-deps chromium webkit
# Keep browser downloads in the ordinary runner account, not root's cache.
node node_modules/playwright/cli.js install chromium webkit
