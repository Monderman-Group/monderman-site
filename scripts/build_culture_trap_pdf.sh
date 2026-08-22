#!/usr/bin/env sh
set -eu
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output_file="$repo_dir/Monderman_Brief_The_Culture_Trap.pdf"
"${PYTHON:-python3}" "$repo_dir/scripts/build_culture_trap_pdf.py" "$output_file"
