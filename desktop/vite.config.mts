import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Electron loads the production page through file://, so assets must be relative.
  base: "./",
  plugins: [react({})],
  clearScreen: false,
  server: {
    strictPort: true,
    port: 5173,
  },
});
