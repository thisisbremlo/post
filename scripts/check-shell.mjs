#!/usr/bin/env node
/**
 * Checks the built extension the way Chromium will: every file the manifest
 * names has to be in dist-shell, and the worker's module type has to match the
 * code Vite emitted. Run it before blaming the browser.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(repo, "dist-shell");
const problems = [];
const notes = [];

const need = (condition, message) => {
  if (!condition) problems.push(message);
};

const manifestPath = join(dist, "manifest.json");
if (!existsSync(manifestPath)) {
  console.error("dist-shell/manifest.json is missing. Run: npm run shell:build");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

need(manifest.manifest_version === 3, "manifest_version must be 3");
need(Boolean(manifest.name), "name is missing");
need(/^\d+(\.\d+){0,3}$/.test(manifest.version ?? ""), "version must be 1-4 dot-separated integers");
need(Boolean(manifest.background?.service_worker), "background.service_worker is missing");

const worker = manifest.background?.service_worker;
if (worker) {
  const workerPath = join(dist, worker);
  need(existsSync(workerPath), `service worker ${worker} is not in the package`);
  if (existsSync(workerPath)) {
    const code = readFileSync(workerPath, "utf8");
    const usesImport = /^\s*import[\s{*]/m.test(code);
    need(
      !usesImport || manifest.background.type === "module",
      `${worker} uses import but background.type is not "module" — Chrome refuses to register it`,
    );
    notes.push(
      `worker ${worker} is ${manifest.background.type === "module" ? "a module" : "classic"} (${(
        statSync(workerPath).size / 1024
      ).toFixed(1)} kB)`,
    );
    for (const match of code.matchAll(/from\s*"([^"]+)"/g)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      need(
        existsSync(join(dist, specifier)),
        `worker imports ${specifier}, which is not in the package`,
      );
    }
  }
}

for (const [label, set] of [
  ["icons", manifest.icons],
  ["action.default_icon", manifest.action?.default_icon],
]) {
  if (!set) continue;
  for (const [size, relative] of Object.entries(set)) {
    need(existsSync(join(dist, relative)), `${label}.${size} points at ${relative}, which is missing`);
  }
}

const newtab = manifest.chrome_url_overrides?.newtab;
need(Boolean(newtab), "chrome_url_overrides.newtab is missing, so Post is not the new tab");
if (newtab) {
  const htmlPath = join(dist, newtab);
  need(existsSync(htmlPath), `newtab page ${newtab} is missing`);
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, "utf8");
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((url) => !/^(https?:|data:|chrome-extension:)/.test(url));
    for (const ref of refs) {
      const relative = ref.replace(/^\.\//, "").split("?")[0];
      need(existsSync(join(dist, relative)), `index.html references ${ref}, which is missing`);
    }
  }
}

let extensionId = null;
if (!manifest.key) {
  problems.push("key is missing — Chrome would derive a new extension ID on every load");
} else {
  const der = Buffer.from(manifest.key, "base64");
  need(der.length > 0, "key is not valid base64");
  if (der.length > 0) {
    const hex = createHash("sha256").update(der).digest("hex").slice(0, 32);
    extensionId = [...hex].map((digit) => String.fromCharCode(97 + parseInt(digit, 16))).join("");
    notes.push(`extension id ${extensionId} (${der.length}-byte public key)`);
  }
}

for (const permission of ["tabs", "bookmarks", "history", "management", "storage"]) {
  need(
    (manifest.permissions ?? []).includes(permission),
    `permission "${permission}" is missing, so part of the desk cannot work`,
  );
}

const size = [...readFileSync(manifestPath)].length;
notes.push(`manifest ${size} bytes · ${manifest.permissions?.length ?? 0} permissions`);

for (const note of notes) console.log(`ok   ${note}`);
for (const problem of problems) console.error(`fail ${problem}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in ${dist}`);
  process.exit(1);
}

console.log("\nThe package is complete. To load it by hand:");
console.log("  chrome://extensions → enable developer mode → Load unpacked");
console.log(`  → ${dist}`);
console.log("\nBranded Google Chrome ignores --load-extension since version 137.");
console.log("`npm run shell` works with ungoogled-chromium, Chromium, Canary or Brave.");
