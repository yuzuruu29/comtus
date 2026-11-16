#!/usr/bin/env node
/**
 * Build the site-hosted Tauri updater manifest (public/desktop/latest.json)
 * from CI artifacts + downloaded release assets.
 *
 * WHY THIS EXISTS
 * Three parallel build jobs each upload an aggregate `latest.json` to the
 * same release asset name — last writer wins and earlier jobs' platform
 * entries are silently lost (v0.3.1 shipped without darwin-aarch64).
 *
 * This script instead derives every entry deterministically:
 *   • the `updater-<rust-target>` artifacts hold each job's own .sig file,
 *     so signature ↔ platform pairing comes from the directory name;
 *   • the release assets hold the updater payloads (.app.tar.gz / .exe);
 *   • the release's aggregated latest.json supplies only version/notes/date.
 *
 * All URLs are rewritten to the public site origin because release assets
 * on the private repo 404 for end users.
 *
 * USAGE
 *   node scripts/build-site-manifest.mjs
 *     --artifacts "dir containing updater-TARGET subdirectories"
 *     --assets   "dir of downloaded release assets"
 *     --out      public/desktop/latest.json
 *     --config   src-tauri/tauri.conf.json
 *     --site-base https://comtus-ai.vercel.app/desktop
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!flag.startsWith("--") || i + 1 >= argv.length) {
      throw new Error(`Bad argument near "${flag}". Expected --key value pairs.`);
    }
    out[flag.slice(2)] = argv[i + 1];
  }
  for (const required of ["artifacts", "assets", "out", "config", "site-base"]) {
    if (!out[required]) throw new Error(`Missing required --${required}`);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

/** rust-target → { manifestKeys, payload filename matcher } */
const TARGETS = {
  "aarch64-apple-darwin": {
    keys: ["darwin-aarch64", "darwin-aarch64-app"],
    match: (n) => n === "Comtus_aarch64.app.tar.gz",
  },
  "x86_64-apple-darwin": {
    keys: ["darwin-x86_64", "darwin-x86_64-app"],
    match: (n) => n === "Comtus_x64.app.tar.gz",
  },
  "x86_64-pc-windows-msvc": {
    keys: ["windows-x86_64", "windows-x86_64-nsis"],
    match: (n) => n.endsWith(".exe") && !n.endsWith(".sig"),
  },
};

// ── Release assets ───────────────────────────────────────────────────
const assetNames = await readdir(args.assets);
const payloads = assetNames.filter((n) => !n.endsWith(".sig") && n !== "latest.json");
if (payloads.length === 0) throw new Error(`No updater payloads found in ${args.assets}`);

// ── Aggregated manifest: metadata hints only ─────────────────────────
let meta = {};
try {
  meta = JSON.parse(await readFile(join(args.assets, "latest.json"), "utf8"));
} catch {
  console.warn("[build-site-manifest] no aggregated latest.json — will derive metadata from tag/config");
}

// ── Per-target signatures from artifacts ─────────────────────────────
const conf = JSON.parse(await readFile(args.config, "utf8"));
const tagVersion = (process.env.GITHUB_REF_NAME ?? "").replace(/^v/, "");
const version = meta.version || tagVersion || conf.version;

const platforms = {};
for (const [target, spec] of Object.entries(TARGETS)) {
  const dir = join(args.artifacts, `updater-${target}`);
  let sigName;
  try {
    const entries = await readdir(dir);
    sigName = entries.find((n) => n.endsWith(".sig"));
  } catch {
    throw new Error(`No artifact directory for ${target} — was the build job skipped?`);
  }
  if (!sigName) throw new Error(`Artifact dir for ${target} contains no .sig file`);

  const payload = payloads.find(spec.match);
  if (!payload) throw new Error(`No matching updater payload for ${target} among: ${payloads.join(", ")}`);

  // `tauri signer` already writes the .sig file as base64 of the minisign
  // text, which is exactly what the updater's signature field holds.
  // Encoding it again broke every update through v0.3.2.
  const signature = (await readFile(join(dir, sigName), "utf8")).trim();
  if (!Buffer.from(signature, "base64").toString().startsWith("untrusted comment:")) {
    throw new Error(`${sigName} is not a base64 minisign signature; the updater would reject it`);
  }

  for (const key of spec.keys) {
    platforms[key] = { signature, url: `${args["site-base"]}/${payload}` };
  }
  console.log(`[build-site-manifest] ${target}: ${sigName} + ${payload}`);
}

if (!platforms["darwin-aarch64"] || !platforms["darwin-x86_64"] || !platforms["windows-x86_64"]) {
  throw new Error("Manifest is missing a required primary platform after assembly");
}
if (version !== conf.version) {
  throw new Error(`Manifest version ${version} disagrees with tauri.conf.json ${conf.version}`);
}

const manifest = {
  version,
  notes: meta.notes ?? "",
  pub_date: meta.pub_date ?? new Date().toISOString(),
  platforms,
};

await writeFile(args.out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[build-site-manifest] wrote ${args.out} (${Object.keys(platforms).length} entries, v${version})`);
