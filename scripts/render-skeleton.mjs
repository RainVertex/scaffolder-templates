// Render a scaffolder skeleton with mock values, for CI smoke-testing.
//
// Usage: node scripts/render-skeleton.mjs <template-name> <output-dir>
//
// This mirrors the subset of the platform render engine the skeletons rely on.
// Source of truth: modular-engineering-platform/packages/scaffolder-core/src/render.ts
// and .../src/actions/fetch.ts. Specifically:
//   - comments:    ${# ... #} are dropped
//   - variables:   ${{ values.* }}, optionally piped through filters
//   - filters:     kebabCase, camelCase, pascalCase, titleCase, dump
//   - raw blocks:  ${% raw %} ... {% endraw %} emit their body verbatim, so GitHub Actions
//                  ${{ ... }} expressions survive. NOTE the close tag has no leading $:
//                  nunjucks parseRaw hardcodes {% %}, so ${% endraw %} would leak a stray $.
//   - path marker: __PASCAL__ (the platform passes these as runtime pathSubstitutions;
//                  for CI we resolve it to pascalCase(values.name))
//   - a trailing .tmpl is stripped from output filenames
//
// Anything else templated (other ${% ... %} tags, unknown filters, an unresolved
// ${{ values.x }}) is left in place and flagged, so CI surfaces the gap loudly instead of
// emitting broken output. Extend this file (or run the real engine) for richer features.

import { promises as fs } from "node:fs";
import path from "node:path";

const [templateName, outDir] = process.argv.slice(2);
if (!templateName || !outDir) {
  console.error("usage: node scripts/render-skeleton.mjs <template-name> <output-dir>");
  process.exit(2);
}

const repoRoot = path.resolve(import.meta.dirname, "..");

// Mock values stand in for the wizard/form parameters the platform injects.
const values = {
  name: `${templateName}-ci`,
  description: `CI render smoke test for ${templateName}`,
  owners: [],
};

const toWords = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

const FILTERS = {
  kebabCase: (s) => toWords(s).map((w) => w.toLowerCase()).join("-"),
  camelCase: (s) => toWords(s).map((w, i) => (i === 0 ? w.toLowerCase() : cap(w))).join(""),
  pascalCase: (s) => toWords(s).map(cap).join(""),
  titleCase: (s) => toWords(s).map(cap).join(" "),
  dump: (v) => JSON.stringify(v),
};

const COMMENT_RE = /\$\{#[\s\S]*?#\}/g;
const RAW_RE = /\$\{%\s*raw\s*%\}([\s\S]*?)\{%\s*endraw\s*%\}/g;
const VAR_RE = /\$\{\{\s*([^}]+?)\s*\}\}/g;
const PLACEHOLDER_RE = /RAWPLACEHOLDER_(\d+)_RAWPLACEHOLDER/g;

// Resolve `${{ values.x | filter | filter }}`. Anything else is left untouched so the
// leftover check can flag it.
function substituteValues(src) {
  return src.replace(VAR_RE, (whole, expr) => {
    const parts = expr.split("|").map((p) => p.trim());
    const ref = parts.shift();
    const m = /^values\.([A-Za-z0-9_]+)$/.exec(ref);
    if (!m || !(m[1] in values)) return whole;
    let val = values[m[1]];
    for (const name of parts) {
      const fn = FILTERS[name];
      if (!fn) return whole;
      val = fn(val);
    }
    return typeof val === "string" ? val : String(val);
  });
}

// Render a file's contents. Returns { text, leftover }, where leftover is true if any
// templating survived outside a raw block (an authoring mistake we want CI to catch).
function renderContent(src) {
  const withoutComments = src.replace(COMMENT_RE, "");
  // Pull raw bodies out so their ${{ ... }} survive verbatim, then restore them last.
  const rawBodies = [];
  let masked = withoutComments.replace(RAW_RE, (_m, body) => {
    rawBodies.push(body);
    return `RAWPLACEHOLDER_${rawBodies.length - 1}_RAWPLACEHOLDER`;
  });
  masked = substituteValues(masked);
  const leftover = masked.includes("${{") || masked.includes("${%");
  const text = masked.replace(PLACEHOLDER_RE, (_m, i) => rawBodies[Number(i)]);
  return { text, leftover };
}

function renderPath(relPosix) {
  let out = relPosix.endsWith(".tmpl") ? relPosix.slice(0, -".tmpl".length) : relPosix;
  out = out.split("__PASCAL__").join(FILTERS.pascalCase(values.name));
  return substituteValues(out);
}

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

const skeleton = path.join(repoRoot, templateName, "skeleton");
if (!(await fs.stat(skeleton).then((s) => s.isDirectory(), () => false))) {
  console.error(`no skeleton directory at ${skeleton}`);
  process.exit(1);
}

const absOut = path.resolve(outDir);
await fs.rm(absOut, { recursive: true, force: true });

// Fail-closed: collect anything that didn't fully resolve and abort before declaring success.
const problems = [];
for (const file of await walk(skeleton)) {
  const relPosix = path.relative(skeleton, file).split(path.sep).join("/");
  const destRel = renderPath(relPosix);
  if (/__[A-Z0-9]+__/.test(destRel)) problems.push(`${destRel} (unresolved path marker)`);
  const { text, leftover } = renderContent(await fs.readFile(file, "utf8"));
  if (leftover) problems.push(`${relPosix} (unresolved templating in content)`);
  const dest = path.join(absOut, destRel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, text);
}

if (problems.length) {
  console.error("Unresolved templating after render:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("Supported: ${# comments #}, ${{ values.* }} (+ kebabCase|camelCase|pascalCase|");
  console.error("titleCase|dump), and ${% raw %} ... {% endraw %} blocks. Extend this script or");
  console.error("scaffolder-core/render.ts for anything else.");
  process.exit(1);
}

const rendered = await walk(absOut);
console.log(`Rendered ${templateName} -> ${outDir} (${rendered.length} files)`);
