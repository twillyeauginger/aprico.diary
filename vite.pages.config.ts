import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./github-pages", import.meta.url)),
  base: "/aprico.diary/",
  publicDir: fileURLToPath(new URL("./github-pages/public", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./out", import.meta.url)),
    emptyOutDir: true,
  },
});
