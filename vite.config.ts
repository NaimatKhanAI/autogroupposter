import { defineConfig } from "vite";
export default defineConfig({
  root: "apps/website",
  envDir: "../..",
  build: { outDir: "../../dist/website", emptyOutDir: true },
});
