import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

/** The build knows the commit it came from, so it can tell when main has moved. */
function commit(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

export default defineConfig({
  plugins: [react()],
  // Relative base so the same build can be loaded from file:// inside Electron.
  base: "./",
  define: {
    // SCAFFOLD_VERSION lets a test build pretend to be older than the feed.
    __APP_VERSION__: JSON.stringify(process.env.SCAFFOLD_VERSION ?? pkg.version),
    __APP_COMMIT__: JSON.stringify(process.env.SCAFFOLD_COMMIT ?? commit()),
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
});
