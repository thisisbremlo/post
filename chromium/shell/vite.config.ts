import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  // An extension page loads its assets from chrome-extension://, never from a server.
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3100,
    strictPort: true,
  },
  build: {
    outDir: fileURLToPath(new URL("../../dist-shell", import.meta.url)),
    emptyOutDir: true,
    target: "chrome120",
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("index.html", import.meta.url)),
        background: fileURLToPath(new URL("src/background.ts", import.meta.url)),
      },
      output: {
        // The manifest names background.js, so entries keep their own names.
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
