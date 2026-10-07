#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/ci_ubuntu_apt_scope.sh"
sudo env APT_CONFIG="$ci_apt_config" apt-get update
sudo env APT_CONFIG="$ci_apt_config" apt-get install -y poppler-utils
python -m pip install --disable-pip-version-check pypdf==6.10.0 pdfplumber==0.11.9 reportlab==4.4.9
