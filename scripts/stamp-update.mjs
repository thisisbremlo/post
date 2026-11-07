// Every release writes one small public file the app can read without a token.
// Run it before committing: `npm run stamp`.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const notes = execSync("git log -1 --format=%s", { encoding: "utf8" }).trim();

const feed = { version: pkg.version, notes };
writeFileSync(new URL("../update.json", import.meta.url), `${JSON.stringify(feed, null, 2)}\n`);
console.log(`update.json → ${feed.version} · ${feed.notes}`);
