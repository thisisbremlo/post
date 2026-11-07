import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The packaged app has no way to find the checkout it came from, so packaging
 * bakes it in here. electron/ is shipped inside the asar; this file is not in
 * git, because a checkout path is a fact about one machine.
 */
const root = process.cwd();
const target = join(root, "electron", "checkout.json");

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify({ path: root, bakedAt: new Date().toISOString() }, null, 2)}\n`);

console.log(`checkout baked ${target} -> ${root}`);
