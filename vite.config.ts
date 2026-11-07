import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the same build can be loaded from file:// inside Electron.
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
});
