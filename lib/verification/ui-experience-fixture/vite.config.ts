import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fixtureRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(fixtureRoot, "../../..");

export default defineConfig({
  root: fixtureRoot,
  plugins: [react()],
  resolve: {
    alias: {
      "@": repoRoot,
      "next/navigation": path.resolve(fixtureRoot, "next-navigation-shim.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    fs: {
      allow: [repoRoot],
    },
  },
});
