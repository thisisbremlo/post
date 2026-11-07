#!/usr/bin/env node
/**
 * Opens Chromium with Post's own profile and the built desk loaded as an extension.
 * This is the phase-0 shell: Chromium draws the frame, Post draws the desk.
 *
 * Branded Google Chrome ignores --load-extension since version 137, so it is
 * refused rather than launched into a window without Post in it.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(repo, "dist-shell");
const manifestPath = join(dist, "manifest.json");

if (!existsSync(manifestPath)) {
  console.error("The desk is not built yet. Run: npm run shell:build");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (typeof manifest.key !== "string" || manifest.key.length === 0) {
  console.error("dist-shell/manifest.json has no key, so the extension ID is not stable.");
  process.exit(1);
}
const digest = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest("hex");
const extensionId = [...digest.slice(0, 32)]
  .map((character) => String.fromCharCode(97 + parseInt(character, 16)))
  .join("");

const mac = [
  ["ungoogled-chromium", "/Applications/ungoogled-chromium.app/Contents/MacOS/ungoogled-chromium"],
  ["Chromium", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
  ["Chrome Canary", "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"],
  ["Brave", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"],
  ["Google Chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
];
const linux = [
  ["ungoogled-chromium", "/usr/bin/ungoogled-chromium"],
  ["Chromium", "/usr/bin/chromium"],
  ["Chromium", "/usr/bin/chromium-browser"],
  ["Brave", "/usr/bin/brave-browser"],
  ["Google Chrome", "/usr/bin/google-chrome"],
  ["Google Chrome", "/usr/bin/google-chrome-stable"],
];
const win = [
  ["Chromium", "C:\\Program Files\\Chromium\\Application\\chrome.exe"],
  ["Brave", "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"],
  ["Google Chrome", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"],
];

function fromPath(names) {
  for (const [label, name] of names) {
    const found = spawnSync(process.platform === "win32" ? "where" : "which", [name], {
      encoding: "utf8",
    });
    const first = found.status === 0 ? found.stdout.split(/\r?\n/).find(Boolean) : null;
    if (first) return { label, binary: first.trim() };
  }
  return null;
}

const table = process.platform === "darwin" ? mac : process.platform === "win32" ? win : linux;
const explicit = process.env.POST_CHROMIUM;
const found =
  (explicit && existsSync(explicit) ? { label: "POST_CHROMIUM", binary: explicit } : null) ??
  (table.map(([label, binary]) => ({ label, binary })).find((entry) => existsSync(entry.binary)) ??
    fromPath([
      ["ungoogled-chromium", "ungoogled-chromium"],
      ["Chromium", "chromium"],
      ["Chromium", "chromium-browser"],
      ["Brave", "brave-browser"],
      ["Google Chrome", "google-chrome"],
    ]));

if (!found) {
  console.error("No Chromium found. Install ungoogled-chromium or Chromium, or set POST_CHROMIUM.");
  process.exit(1);
}

const profile = join(repo, ".chromium-profile");
const brandedChrome = /google-chrome|Google Chrome\.app|google\\chrome/i.test(found.binary);
if (brandedChrome && process.env.POST_CHROMIUM_ALLOW_BRANDED !== "1") {
  console.error(`\n${found.binary} is branded Google Chrome.`);
  console.error("Since version 137 it ignores --load-extension, so the desk cannot be injected there.");
  console.error("\nLoad it by hand instead, once per profile:");
  console.error("  1. chrome://extensions → turn developer mode on");
  console.error(`  2. Load unpacked → ${dist}`);
  console.error("\nOr install Chromium / ungoogled-chromium and run `npm run shell` again.");
  console.error("Chrome opens on chrome://extensions now.\n");
  spawn(found.binary, [`--user-data-dir=${profile}`, "--no-first-run", "chrome://extensions"], {
    stdio: "inherit",
  });
  process.exit(1);
}

const args = [
  `--user-data-dir=${profile}`,
  `--load-extension=${dist}`,
  "--no-first-run",
  "--no-default-browser-check",
  `chrome-extension://${extensionId}/index.html`,
];

console.log(`Post desk  ${dist}`);
console.log(`profile     ${profile}`);
console.log(`extension   ${extensionId}`);
console.log(`engine      ${found.label} (${found.binary})`);
console.log("\nIf no desk appears, open chrome://extensions and read the error on Post.");
if (/ungoogled/i.test(found.binary)) {
  console.log("\nungoogled-chromium removes the Chrome Web Store by design, so store installs fail there.");
  console.log("For store extensions: chrome://flags/#extension-mime-request-handling →");
  console.log("'Always prompt for install', then install chromium-web-store. A Chromium build");
  console.log("needs none of that.");
}

const child = spawn(found.binary, args, { stdio: "inherit" });
child.on("error", (error) => {
  console.error(`Could not start ${found.binary}: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
