#!/usr/bin/env bash
set -euo pipefail

release_revision="${RENDER_GIT_COMMIT:-}"
if [[ ! "$release_revision" =~ ^[a-f0-9]{40}$ ]]; then
  echo "RENDER_GIT_COMMIT must be the immutable 40-character deployment revision" >&2
  exit 1
fi

publish_dir=".render-public"
rm -rf -- "$publish_dir"
mkdir -p "$publish_dir/.well-known" "$publish_dir/assets/brand" "$publish_dir/assets/books" "$publish_dir/assets/research" "$publish_dir/sample-data"

copy_root_matches() {
  local pattern file
  for pattern in "$@"; do
    while IFS= read -r file; do
      cp -- "$file" "$publish_dir/$file"
    done < <(find . -maxdepth 1 -type f -name "$pattern" -print | sed 's#^./##' | sort)
  done
}

# Public pages and the files they load directly. Development scripts, workflows,
# source documents, test fixtures, and PDF-production fonts are intentionally not
# copied into the publish directory.
copy_root_matches "*.html" "*.css" "*.js" "*.woff" "*.woff2"
cp -- CNAME robots.txt sitemap.txt sitemap.xml legal-document-manifest.json public-search-index.json "$publish_dir/"
cp -- favicon.ico favicon.svg favicon-192.png apple-touch-icon.png "$publish_dir/"
cp -- Hero-Image.jpg founder-jason-adamson.jpg founder-elizabeth-neiford.jpg "$publish_dir/"
cp -- sample-data/production-diagnostic-samples.json "$publish_dir/sample-data/"

cp -- assets/books/governance-bureaucracy-organization-cover.jpg "$publish_dir/assets/books/"
cp -- \
  assets/brand/brand-foundations-v2.css \
  assets/brand/brand-lockup.css \
  assets/brand/monderman-favicon.svg \
  assets/brand/monderman-map-cream.svg \
  assets/brand/monderman-mark-v2-small.svg \
  assets/brand/monderman-social-card.png \
  "$publish_dir/assets/brand/"
find assets/research -maxdepth 1 -type f -name '*.png' ! -name 'after-the-first-lap-social.png' -exec cp -- {} "$publish_dir/assets/research/" \;

stale_pdfs=(
  "Monderman_Brief_Accumulated_Drag_Department_of_War.pdf"
  "Monderman_Insight_Every_Node_for_Itself_Aug2026.pdf"
  "Monderman_Insight_Merit_After_the_Machine_2026-08-11.pdf"
  "Monderman_Insight_After_the_First_Lap.pdf"
)
is_stale_pdf() {
  local candidate="$1" stale
  for stale in "${stale_pdfs[@]}"; do
    [[ "$candidate" == "$stale" ]] && return 0
  done
  return 1
}
while IFS= read -r pdf; do
  is_stale_pdf "$pdf" || cp -- "$pdf" "$publish_dir/$pdf"
done < <(find . -maxdepth 1 -type f -name '*.pdf' -print | sed 's#^./##' | sort)

for stale in "${stale_pdfs[@]}"; do
  if [[ -e "$publish_dir/$stale" ]]; then
    echo "Superseded PDF copied into public build: $stale" >&2
    exit 1
  fi
done

for private_path in scripts site-shell .github docs pdf-src test-fixtures node_modules; do
  if [[ -e "$publish_dir/$private_path" ]]; then
    echo "Non-public path copied into public build: $private_path" >&2
    exit 1
  fi
done

node scripts/inject-public-shell.mjs "$publish_dir"

marker_tmp="$publish_dir/.well-known/monderman-release.json.tmp"
printf '{"revision":"%s"}\n' "$release_revision" > "$marker_tmp"
mv "$marker_tmp" "$publish_dir/.well-known/monderman-release.json"

echo "Static site build generated in ${publish_dir} for ${release_revision}"
