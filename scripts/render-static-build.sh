#!/usr/bin/env bash
set -euo pipefail

release_revision="${RENDER_GIT_COMMIT:-}"
if [[ ! "$release_revision" =~ ^[a-f0-9]{40}$ ]]; then
  echo "RENDER_GIT_COMMIT must be the immutable 40-character deployment revision" >&2
  exit 1
fi

mkdir -p .well-known
marker_tmp=".well-known/monderman-release.json.tmp"
printf '{"revision":"%s"}\n' "$release_revision" > "$marker_tmp"
mv "$marker_tmp" .well-known/monderman-release.json

echo "Static site release marker generated for ${release_revision}"
