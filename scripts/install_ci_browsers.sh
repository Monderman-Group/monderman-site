#!/usr/bin/env bash
set -euo pipefail

# The hosted runner includes unrelated vendor APT repositories. Browser OS
# dependencies come from its signed Ubuntu sources only. Scope this setting to
# this installation; do not edit system sources or relax package verification.
if [[ "${GITHUB_ACTIONS:-}" != true || "$(uname -s)" != Linux ]]; then
  echo 'Browser dependency installer requires the Ubuntu GitHub Actions runner.' >&2
  exit 1
fi
pw_ubuntu_sources=/etc/apt/sources.list.d/ubuntu.sources
if [[ ! -s "$pw_ubuntu_sources" || ! -f node_modules/playwright/cli.js ]]; then
  echo 'Expected Ubuntu sources or pinned Playwright installation is missing.' >&2
  exit 1
fi
# RUNNER_TEMP can have a private parent directory that APT's _apt user cannot
# traverse. Use /tmp and verify read access before starting package downloads.
pw_apt_dir=$(mktemp -d /tmp/monderman-browser-apt.XXXXXX)
if [[ "$pw_apt_dir" == *[!a-zA-Z0-9_./-]* ]]; then
  echo 'Unexpected runner temporary path; cannot construct APT configuration.' >&2
  exit 1
fi
chmod 755 "$pw_apt_dir"
mkdir "$pw_apt_dir/empty-sourceparts" "$pw_apt_dir/lists"
printf 'Dir::Etc::sourcelist "%s";\nDir::Etc::sourceparts "%s";\nDir::State::lists "%s";\n' \
  "$pw_ubuntu_sources" "$pw_apt_dir/empty-sourceparts" "$pw_apt_dir/lists" \
  > "$pw_apt_dir/apt.conf"
sudo -u _apt test -r "$pw_apt_dir/apt.conf"

# APT reads its normal configuration too. Fail closed if it overrides our
# source isolation, rather than silently consulting the vendor repositories.
pw_effective=$(sudo env APT_CONFIG="$pw_apt_dir/apt.conf" apt-config shell \
  PW_SOURCE Dir::Etc::sourcelist PW_PARTS Dir::Etc::sourceparts PW_LISTS Dir::State::lists)
pw_expected=$(printf "PW_SOURCE='%s'\nPW_PARTS='%s'\nPW_LISTS='%s'" \
  "$pw_ubuntu_sources" "$pw_apt_dir/empty-sourceparts" "$pw_apt_dir/lists")
if [[ "$pw_effective" != "$pw_expected" ]]; then
  echo 'Effective APT source isolation differs from the requested configuration.' >&2
  exit 1
fi
echo 'Installing browser OS dependencies from signed Ubuntu repositories only.'
sudo env APT_CONFIG="$pw_apt_dir/apt.conf" \
  "$(command -v node)" "$PWD/node_modules/playwright/cli.js" install-deps chromium webkit
# Keep browser downloads in the ordinary runner account, not root's cache.
node node_modules/playwright/cli.js install chromium webkit
