#!/usr/bin/env node
/**
 * Builds the store upload: dist/focus-guard-<version>.zip with manifest.json at the top level.
 * Checks the manifest first (every referenced file exists, description length, icons), so a
 * broken package is caught here rather than by store review.
 *
 *   npm run package
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { createZip, readZip } = require("./zip.js");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const MAX_DESCRIPTION = 132;
const REQUIRED_ICONS = ["16", "32", "48", "128"];

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, base);
    return [path.relative(base, full).split(path.sep).join("/")];
  });
}

/** Every file the manifest points at. */
function referencedFiles(manifest) {
  return [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.content_scripts || []).flatMap((cs) => [...(cs.js || []), ...(cs.css || [])]),
    ...(manifest.web_accessible_resources || []).flatMap((w) => w.resources),
  ].filter(Boolean);
}

function checkManifest(manifest, files) {
  if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
  if (!/^\d+(\.\d+){0,3}$/.test(manifest.version || "")) fail(`bad version "${manifest.version}"`);
  if (!manifest.name) fail("manifest has no name");
  if (!manifest.description || manifest.description.length > MAX_DESCRIPTION) {
    fail(`description must be 1–${MAX_DESCRIPTION} characters (is ${manifest.description?.length || 0})`);
  }
  const missingIcons = REQUIRED_ICONS.filter((size) => !manifest.icons?.[size]);
  if (missingIcons.length) fail(`missing icon sizes: ${missingIcons.join(", ")}`);
  const missing = referencedFiles(manifest).filter((f) => !files.includes(f.replace(/^\//, "")));
  if (missing.length) fail(`manifest points at missing files: ${missing.join(", ")}`);
  // Scripts loaded by the worker with importScripts must exist too.
  const worker = fs.readFileSync(path.join(SRC, manifest.background.service_worker), "utf8");
  const imported = [...worker.matchAll(/["']([\w/.-]+\.js)["']/g)].map((m) => m[1]).filter((f) => f.includes("/") || f.endsWith(".js"));
  const missingImports = imported.filter((f) => !files.includes(f));
  if (missingImports.length) fail(`background imports missing files: ${missingImports.join(", ")}`);
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
  const files = listFiles(SRC).sort();
  checkManifest(manifest, files);

  const entries = files.map((name) => ({ name, data: fs.readFileSync(path.join(SRC, name)) }));
  const zip = createZip(entries);

  // Read it back: names use "/", manifest at the top level, contents identical.
  const back = readZip(zip);
  if (!back.some((f) => f.name === "manifest.json")) fail("manifest.json is not at the top level of the zip");
  if (back.some((f) => f.name.includes("\\"))) fail("zip contains backslash paths");
  back.forEach((f, i) => {
    if (!f.data.equals(entries[i].data)) fail(`zip content mismatch for ${f.name}`);
  });

  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, `focus-guard-${manifest.version}.zip`);
  fs.writeFileSync(out, zip);
  const kb = (zip.length / 1024).toFixed(1);
  console.log(`✔ ${path.relative(ROOT, out)}  (${files.length} files, ${kb} KB, version ${manifest.version})`);
}

main();
