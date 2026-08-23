import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const [inputRoot, outputPath] = process.argv.slice(2);
if (!inputRoot || !outputPath) {
  throw new Error("Usage: node scripts/merge-updater-manifests.mjs <artifact-root> <output>");
}

async function findManifests(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await findManifests(path)));
    else if (entry.isFile() && basename(path) === "latest.json") found.push(path);
  }
  return found;
}

const paths = await findManifests(inputRoot);
if (paths.length < 3) {
  throw new Error(`Expected updater manifests from three build targets; found ${paths.length}.`);
}

const manifests = await Promise.all(
  paths.map(async (path) => JSON.parse(await readFile(path, "utf8"))),
);
const versions = new Set(manifests.map((manifest) => manifest.version));
if (versions.size !== 1) {
  throw new Error(`Updater manifests disagree on version: ${[...versions].join(", ")}`);
}

const platforms = Object.assign({}, ...manifests.map((manifest) => manifest.platforms ?? {}));
for (const required of ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]) {
  if (!platforms[required]) throw new Error(`Merged updater manifest is missing ${required}.`);
}

const latest = manifests.reduce((newest, manifest) =>
  Date.parse(manifest.pub_date) > Date.parse(newest.pub_date) ? manifest : newest,
);
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      version: latest.version,
      notes: latest.notes,
      pub_date: latest.pub_date,
      platforms,
    },
    null,
    2,
  )}\n`,
);
