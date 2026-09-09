import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const publishDirectory = resolve(process.argv[2] || ".render-public");
const sourceDirectory = resolve("site-shell");
const [header, footer, widgets] = await Promise.all([
  readFile(join(sourceDirectory, "header.html"), "utf8"),
  readFile(join(sourceDirectory, "footer.html"), "utf8"),
  readFile(join(sourceDirectory, "widgets.html"), "utf8"),
]);

const headerPattern = /<header\b(?=[^>]*\bid=["']siteHeader["'])[^>]*>[\s\S]*?<\/header>/i;
const footerPattern = /<footer\b(?=[^>]*\bclass=["'][^"']*\bmond-footer\b[^"']*["'])[^>]*>[\s\S]*?<\/footer>/i;
const assistantPattern = /\s*<script\b[^>]*\bsrc=["']assistant\.js[^"']*["'][^>]*><\/script>/gi;
const contactPattern = /\s*<script\b[^>]*\bsrc=["']connect-widget\.js[^"']*["'][^>]*><\/script>/gi;
const shellScriptPattern = /<script\b[^>]*\bsrc=["']canonical-site-shell\.js[^"']*["'][^>]*><\/script>/i;
const motifPattern = /<div\b(?=[^>]*\bclass=["'][^"']*\bmf-motif\b[^"']*["'])[^>]*>[\s\S]*?<\/svg>\s*<\/div>/i;
const canonicalCssPattern = /canonical-site-shell\.css\?v=[^"']+/g;
const enterpriseCssPattern = /enterprise-site\.css\?v=[^"']+/g;
// This candidate includes the report display fixes and the approved header gradient.
const shellRelease = "20260909-report-display10";
const versionScript = (html, fileName) => html.replace(
  new RegExp(`(["'])${fileName.replace(".", "\\.")}(?:\\?v=[^"']*)?\\1`, "g"),
  (_match, quote) => `${quote}${fileName}?v=${shellRelease}${quote}`,
);
const motif = footer.match(motifPattern)?.[0];

if (!motif) throw new Error("Canonical M motif is missing from the footer partial");

let normalized = 0;
for (const entry of await readdir(publishDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
  const path = join(publishDirectory, entry.name);
  let html = await readFile(path, "utf8");
  let changed = false;

  // Cache keys are normalized in the immutable public artifact so every page
  // receives the same shell release without modifying protected source pages.
  let versionedHtml = html
    .replace(canonicalCssPattern, `canonical-site-shell.css?v=${shellRelease}`)
    .replace(enterpriseCssPattern, `enterprise-site.css?v=${shellRelease}`);
  versionedHtml = versionScript(versionedHtml, "canonical-site-shell.js");
  versionedHtml = versionScript(versionedHtml, "monderman-report.js");
  versionedHtml = versionScript(versionedHtml, "assistant.js");
  versionedHtml = versionScript(versionedHtml, "connect-widget.js");
  if (versionedHtml !== html) {
    html = versionedHtml;
    changed = true;
  }

  // Footer markup is presentation-only and is safe to normalize even on the
  // four diagnostic instruments. Instrument questions, state, scoring, API
  // calls, authentication, and completion behavior remain untouched.
  if (footerPattern.test(html)) {
    html = html.replace(footerPattern, footer);
    changed = true;
  } else if (motifPattern.test(html)) {
    html = html.replace(motifPattern, motif);
    changed = true;
  }

  const usesCanonicalShell = /<body\b[^>]*\bclass=["'][^"']*\bcanonical-green-shell\b/i.test(html)
    && shellScriptPattern.test(html);
  if (!usesCanonicalShell) {
    if (changed) await writeFile(path, html);
    continue;
  }

  if (headerPattern.test(html)) html = html.replace(headerPattern, header);
  else html = html.replace(/<body\b[^>]*>/i, (opening) => `${opening}\n${header}`);

  if (!footerPattern.test(html)) html = html.replace(shellScriptPattern, `${footer}\n$&`);

  html = html.replace(assistantPattern, "").replace(contactPattern, "");
  html = html.replace(shellScriptPattern, `${widgets}\n$&`);
  // The widget partial is inserted after the first normalization pass. Version
  // the final markup as well so injected assets cannot retain an older key.
  html = versionScript(html, "canonical-site-shell.js");
  html = versionScript(html, "assistant.js");
  html = versionScript(html, "connect-widget.js");
  await writeFile(path, html);
  normalized += 1;
}

if (!normalized) throw new Error("No canonical public pages were normalized");
process.stdout.write(`Normalized the public shell in ${normalized} pages.\n`);
