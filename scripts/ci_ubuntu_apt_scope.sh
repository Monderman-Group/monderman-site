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

# Retain stricter runner network settings while enforcing source isolation.
ci_apt_effective=$(sudo env APT_CONFIG="$ci_apt_config" apt-config shell \
  CI_SOURCE Dir::Etc::sourcelist CI_PARTS Dir::Etc::sourceparts CI_LISTS Dir::State::lists \
  CI_HTTP_TIMEOUT Acquire::http::Timeout CI_HTTPS_TIMEOUT Acquire::https::Timeout \
  CI_RETRIES Acquire::Retries CI_UPDATE_ERROR_MODE APT::Update::Error-Mode)

# Parse only the requested assignment format; never execute apt-config output.
ci_apt_names=(CI_SOURCE CI_PARTS CI_LISTS CI_HTTP_TIMEOUT CI_HTTPS_TIMEOUT CI_RETRIES CI_UPDATE_ERROR_MODE)
ci_apt_values=()
ci_apt_index=0
ci_apt_valid=true
ci_apt_line_pattern="^([A-Z_]+)='([^']*)'$"
while IFS= read -r ci_apt_line; do
  if (( ci_apt_index >= ${#ci_apt_names[@]} )) ||
    [[ ! "$ci_apt_line" =~ $ci_apt_line_pattern ]] ||
    [[ "${BASH_REMATCH[1]}" != "${ci_apt_names[$ci_apt_index]}" ]]; then
    ci_apt_valid=false
    break
  fi
  ci_apt_values[$ci_apt_index]=${BASH_REMATCH[2]}
  ci_apt_index=$((ci_apt_index + 1))
done <<< "$ci_apt_effective"

ci_apt_number_in_bounds() {
  ci_apt_number=$1
  [[ "$ci_apt_number" =~ ^[0-9]+$ ]] || return 1
  while [[ "$ci_apt_number" == 0* && ${#ci_apt_number} -gt 1 ]]; do
    ci_apt_number=${ci_apt_number#0}
  done
  [[ ${#ci_apt_number} -le 2 ]] || return 1
  (( 10#$ci_apt_number >= $2 && 10#$ci_apt_number <= $3 ))
}

if [[ "$ci_apt_valid" != true ]] || (( ci_apt_index != ${#ci_apt_names[@]} )); then
  ci_apt_valid=false
elif [[ "${ci_apt_values[0]}" != "$ci_ubuntu_sources" ||
  "${ci_apt_values[1]}" != "$ci_apt_dir/empty-sourceparts" ||
  "${ci_apt_values[2]}" != "$ci_apt_dir/lists" ||
  "${ci_apt_values[6]}" != any ]] ||
  ! ci_apt_number_in_bounds "${ci_apt_values[3]}" 1 20 ||
  ! ci_apt_number_in_bounds "${ci_apt_values[4]}" 1 20 ||
  ! ci_apt_number_in_bounds "${ci_apt_values[5]}" 0 2; then
  ci_apt_valid=false
fi
if [[ "$ci_apt_valid" != true ]]; then
  echo 'Effective APT source isolation, update error policy, or network bounds are invalid.' >&2
  printf 'Checked CI_SOURCE=%s\nChecked CI_PARTS=%s\nChecked CI_LISTS=%s\n' \
    "$ci_ubuntu_sources" "$ci_apt_dir/empty-sourceparts" "$ci_apt_dir/lists" >&2
  for ci_apt_index in 3 4 5; do
    ci_apt_minimum=1
    ci_apt_maximum=20
    if (( ci_apt_index == 5 )); then ci_apt_minimum=0; ci_apt_maximum=2; fi
    if ci_apt_number_in_bounds "${ci_apt_values[$ci_apt_index]:-}" "$ci_apt_minimum" "$ci_apt_maximum"; then
      printf 'Checked %s=%s\n' "${ci_apt_names[$ci_apt_index]}" "$ci_apt_number" >&2
    fi
  done
  exit 1
fi
