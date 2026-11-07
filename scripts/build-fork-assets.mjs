#!/usr/bin/env node
/**
 * Builds the desk bundle into chromium/fork/overlay and writes the .grd that
 * Chromium's grit target reads. Run before applying the overlay to a checkout.
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(repo, "dist-shell");
const post = join(repo, "chromium/fork/overlay/chrome/browser/ui/webui/post");
const resources = join(post, "resources");
const shim = join(repo, "chromium/fork/webui/webui-shim.js");

execFileSync("npx", ["vite", "build", "--config", "chromium/shell/vite.config.ts"], {
  cwd: repo,
  stdio: "inherit",
});

rmSync(resources, { recursive: true, force: true });
mkdirSync(resources, { recursive: true });

cpSync(join(dist, "index.js"), join(resources, "index.js"));
cpSync(join(dist, "assets"), join(resources, "assets"), { recursive: true });
cpSync(shim, join(resources, "webui-shim.js"));

const entry = '<script type="module" crossorigin src="./index.js"></script>';
const html = readFileSync(join(dist, "index.html"), "utf8");
if (!html.includes(entry)) {
  console.error("dist-shell/index.html does not reference ./index.js; did the build change?");
  process.exit(1);
}
const page = html.replace(
  entry,
  '<script src="./webui-shim.js"></script>\n    <script type="module" src="./index.js"></script>',
);
writeFileSync(join(resources, "post_ui.html"), page);

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(resources)
  .map((path) => relative(resources, path).replaceAll("\\", "/"))
  .filter((path) => path !== "post_resources.grd")
  .sort();

const includes = files
  .map((path) => {
    const id = `IDR_${path.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
    return `      <include name="${id}" file="${path}" type="BINDATA" compress="gzip" />`;
  })
  .join("\n");

const grd = `<?xml version="1.0" encoding="UTF-8"?>
<grit latest_public_release="0" current_release="1" output_all_resource_defines="false">
  <outputs>
    <output filename="grit/post_resources.h" type="rc_header" />
    <output filename="grit/post_resources_map.cc" type="resource_file_map_source" />
    <output filename="grit/post_resources_map.h" type="resource_map_header" />
    <output filename="post_resources.pak" type="data_package" />
  </outputs>
  <release seq="1">
    <includes>
${includes}
    </includes>
  </release>
</grit>
`;
writeFileSync(join(resources, "post_resources.grd"), grd);

console.log(`fork assets: ${files.length} files → ${relative(repo, resources)}`);
console.log(`entry: post_ui.html (chrome://post), default resource IDR_POST_UI_HTML`);
