#!/usr/bin/env bash
set -euo pipefail

# Source this helper only for hosted Ubuntu dependency installation. Keep the
# normal system repositories untouched and retain Ubuntu's archive signatures.
if [[ "${GITHUB_ACTIONS:-}" != true || "$(uname -s)" != Linux || ! -r /etc/os-release ]]; then
  echo 'Dependency installer requires the Ubuntu 24.04 GitHub Actions runner.' >&2
  exit 1
fi
source /etc/os-release
if [[ "${ID:-}" != ubuntu || "${VERSION_ID:-}" != 24.04 || "${VERSION_CODENAME:-}" != noble || "$(dpkg --print-architecture)" != amd64 ]]; then
  echo 'Dependency installer requires Ubuntu 24.04 (noble) on amd64.' >&2
  exit 1
fi
ci_ubuntu_keyring=/usr/share/keyrings/ubuntu-archive-keyring.gpg
if [[ ! -s "$ci_ubuntu_keyring" || ! -r "$ci_ubuntu_keyring" ]]; then
  echo 'Expected readable Ubuntu archive signing key is missing.' >&2
  exit 1
fi

# RUNNER_TEMP can have a private parent that APT's _apt user cannot traverse.
ci_apt_dir=$(mktemp -d /tmp/monderman-ci-apt.XXXXXX)
if [[ "$ci_apt_dir" == *[!a-zA-Z0-9_./-]* ]]; then
  echo 'Unexpected runner temporary path; cannot construct APT configuration.' >&2
  exit 1
fi
chmod 755 "$ci_apt_dir"
mkdir "$ci_apt_dir/empty-sourceparts" "$ci_apt_dir/lists"
chmod 755 "$ci_apt_dir/empty-sourceparts" "$ci_apt_dir/lists"
ci_ubuntu_sources="$ci_apt_dir/ubuntu.sources"
cat > "$ci_ubuntu_sources" <<EOF
Types: deb
URIs: https://archive.ubuntu.com/ubuntu
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: $ci_ubuntu_keyring

Types: deb
URIs: https://security.ubuntu.com/ubuntu
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: $ci_ubuntu_keyring
EOF
ci_apt_config="$ci_apt_dir/apt.conf"
printf 'Dir::Etc::sourcelist "%s";\nDir::Etc::sourceparts "%s";\nDir::State::lists "%s";\nAcquire::http::Timeout "20";\nAcquire::https::Timeout "20";\nAcquire::Retries "2";\nAPT::Update::Error-Mode "any";\n' \
  "$ci_ubuntu_sources" "$ci_apt_dir/empty-sourceparts" "$ci_apt_dir/lists" \
  > "$ci_apt_config"
chmod 644 "$ci_ubuntu_sources" "$ci_apt_config"
sudo -u _apt test -r "$ci_ubuntu_keyring"
sudo -u _apt test -r "$ci_ubuntu_sources"
sudo -u _apt test -r "$ci_apt_config"
sudo -u _apt test -x "$ci_apt_dir/empty-sourceparts"
sudo -u _apt test -x "$ci_apt_dir/lists"

# Normal APT configuration must not override source isolation or network bounds.
ci_apt_effective=$(sudo env APT_CONFIG="$ci_apt_config" apt-config shell \
  CI_SOURCE Dir::Etc::sourcelist CI_PARTS Dir::Etc::sourceparts CI_LISTS Dir::State::lists \
  CI_HTTP_TIMEOUT Acquire::http::Timeout CI_HTTPS_TIMEOUT Acquire::https::Timeout \
  CI_RETRIES Acquire::Retries CI_UPDATE_ERROR_MODE APT::Update::Error-Mode)
ci_apt_expected=$(printf "CI_SOURCE='%s'\nCI_PARTS='%s'\nCI_LISTS='%s'\nCI_HTTP_TIMEOUT='20'\nCI_HTTPS_TIMEOUT='20'\nCI_RETRIES='2'\nCI_UPDATE_ERROR_MODE='any'" \
  "$ci_ubuntu_sources" "$ci_apt_dir/empty-sourceparts" "$ci_apt_dir/lists")
if [[ "$ci_apt_effective" != "$ci_apt_expected" ]]; then
  echo 'Effective APT source isolation or network bounds differ from the requested configuration.' >&2
  exit 1
fi
