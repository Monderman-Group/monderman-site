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
// Refresh both the reviewed report renderer and the newer shared brand release.
const shellRelease = "20260910-report22-brand3";
const assistantRelease = "20260910-bounded-chat1";
const pilotRelease = "20260910-pilot-retry1";
const productPages = new Set([
  "diagnostics.html", "platform-services.html", "plan-signal.html", "plan-pattern.html",
  "plan-enterprise.html", "new-in-the-role.html", "after-an-acquisition.html",
  "after-a-reorganization.html", "transformation-behind-schedule.html", "pilot.html",
  "roi.html", "connect.html", "why-monderman.html", "security.html", "subprocessors.html",
  "Monderman_Platform_Brief.html",
]);
const diagnosticPages = new Set([
  "decision-velocity.html", "structural-clarity.html",
  "operational-systems.html", "institutional-performance.html",
]);
const refreshedAssets = [
  "monderman-report.js", "sample-report-production.js", "sample-report-production.css",
  "homepage-hero-system.css", "homepage-workspace-demo.css", "homepage-workspace-demo.js",
  "workspace-product-design.css", "report-screen-experience.css", "report-screen-experience.js",
  "dv-result-dialog.css", "dv-result-dialog.js",
  "visual-polish.css", "monderman-shell.css", "publication-hero.css", "first-run-moments.css",
  "pilot-waitlist.css", "monderman-depth-lure-tile.css",
  "brand-surfaces.css",
];
const versionScript = (html, fileName) => html.replace(
  new RegExp(`(["'])${fileName.replace(".", "\\.")}(?:\\?v=[^"']*)?\\1`, "g"),
  (_match, quote) => `${quote}${fileName}?v=${fileName === "pilot-waitlist.js" ? pilotRelease : ["assistant.js", "workspace-assistant.js"].includes(fileName) ? assistantRelease : shellRelease}${quote}`,
);
const motif = footer.match(motifPattern)?.[0];

if (!motif) throw new Error("Canonical M motif is missing from the footer partial");

let normalized = 0;
for (const entry of await readdir(publishDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".css")) {
    const path = join(publishDirectory, entry.name);
    const original = await readFile(path, "utf8");
    let css = original;
    for (const asset of refreshedAssets) css = versionScript(css, asset);
    if (css !== original) await writeFile(path, css);
    continue;
  }
  if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
  const path = join(publishDirectory, entry.name);
  let html = await readFile(path, "utf8");
  let changed = false;
  const usesCanonicalShell = /<body\b[^>]*\bclass=["'][^"']*\bcanonical-green-shell\b/i.test(html)
    && shellScriptPattern.test(html);

  if (diagnosticPages.has(entry.name)) {
    if (!html.includes('href="report-screen-experience.css')) {
      html = html.replace("</head>", `<link rel="stylesheet" href="report-screen-experience.css?v=${shellRelease}">\n</head>`);
    }
    if (!html.includes('src="report-screen-experience.js')) {
      // Instruments contain complete HTML report templates inside inline JS.
      // The first </body> belongs to one of those strings; inserting a raw
      // </script> there would terminate the instrument script in the browser.
      const documentBodyEnd = html.toLowerCase().lastIndexOf("</body>");
      if (documentBodyEnd < 0) throw new Error(`Document body is missing in ${entry.name}`);
      html = html.slice(0, documentBodyEnd) +
        `<script src="report-screen-experience.js?v=${shellRelease}" defer></script>\n` +
        html.slice(documentBodyEnd);
    }
    changed = true;
  }

  if (productPages.has(entry.name) || entry.name === "index.html") {
    if (productPages.has(entry.name) && !/\bproduct-surface\b/.test(html)) {
      html = html.replace(/(<body\b[^>]*\bclass=["'])/, "$1product-surface ");
    }
    if (!html.includes('href="public-product-design.css')) {
      html = html.replace("</head>", `<link rel="stylesheet" href="public-product-design.css?v=${shellRelease}">\n</head>`);
    }
    changed = true;
  }

  // The final screen layer keeps page heroes and public footers on one brand
  // surface, including the standalone cross-tool report introduction.
  if (usesCanonicalShell || footerPattern.test(html) || entry.name === "cross-tool-synthesis.html") {
    if (!html.includes('href="brand-surfaces.css')) {
      html = html.replace("</head>", `<link rel="stylesheet" href="brand-surfaces.css?v=${shellRelease}">\n</head>`);
    }
    changed = true;
  }

  // Cache keys are normalized in the immutable public artifact so every page
  // receives the same shell release without modifying protected source pages.
  let versionedHtml = html
    .replace(canonicalCssPattern, `canonical-site-shell.css?v=${shellRelease}`)
    .replace(enterpriseCssPattern, `enterprise-site.css?v=${shellRelease}`);
  versionedHtml = versionScript(versionedHtml, "canonical-site-shell.js");
  versionedHtml = versionScript(versionedHtml, "assistant.js");
  versionedHtml = versionScript(versionedHtml, "workspace-assistant.js");
  versionedHtml = versionScript(versionedHtml, "connect-widget.js");
  versionedHtml = versionScript(versionedHtml, "pilot-waitlist.js");
  for (const asset of refreshedAssets) versionedHtml = versionScript(versionedHtml, asset);
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
