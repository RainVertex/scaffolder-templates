// Lightweight, dependency-free checks for every skeleton in this repo.
//
// Usage: node scripts/validate.mjs
//
// Enforces the invariants that must hold *before* rendering:
//   1. Any file whose contents use templating (${{ ... }} or ${% ... %}) must be named
//      *.tmpl, otherwise the placeholder would leak verbatim into a generated repo.
//   2. Each template directory must ship a skeleton/catalog-info.yaml.tmpl so the
//      platform catalog can ingest the generated project.
//
// Only top-level directories that contain a skeleton/ are scanned, so the repo README
// (which documents the ${{ }} dialect) is correctly ignored.

import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

const isDir = (p) => fs.stat(p).then((s) => s.isDirectory(), () => false);
const exists = (p) => fs.stat(p).then(() => true, () => false);

const templates = [];
for (const e of await fs.readdir(repoRoot, { withFileTypes: true })) {
  if (!e.isDirectory() || e.name.startsWith(".")) continue;
  if (await isDir(path.join(repoRoot, e.name, "skeleton"))) templates.push(e.name);
}

if (templates.length === 0) {
  console.error("no template directories with a skeleton/ subdirectory were found");
  process.exit(1);
}

const errors = [];
for (const template of templates) {
  const skeleton = path.join(repoRoot, template, "skeleton");

  if (!(await exists(path.join(skeleton, "catalog-info.yaml.tmpl")))) {
    errors.push(`${template}: missing skeleton/catalog-info.yaml.tmpl`);
  }

  for (const file of await walk(skeleton)) {
    const content = await fs.readFile(file, "utf8");
    const templated = content.includes("${{") || content.includes("${%");
    if (templated && !file.endsWith(".tmpl")) {
      errors.push(`${path.relative(repoRoot, file)}: uses templating but is not a .tmpl file`);
    }
  }
}

if (errors.length) {
  console.error("Skeleton validation failed:");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`Validated ${templates.length} templates: ${templates.join(", ")}`);
