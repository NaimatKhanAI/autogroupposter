import { build } from "vite";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
const root = process.cwd();
await build({
  configFile: false,
  root: path.join(root, "apps/website"),
  envDir: root,
  build: { outDir: path.join(root, "dist/website"), emptyOutDir: true },
});
await build({
  configFile: false,
  root: path.join(root, "apps/chrome-extension"),
  envDir: root,
  base: "./",
  build: {
    outDir: path.join(root, "dist/chrome-extension"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.join(root, "apps/chrome-extension/popup.html"),
        sidepanel: path.join(root, "apps/chrome-extension/sidepanel.html"),
      },
    },
  },
});
await build({
  configFile: false,
  root,
  envDir: root,
  build: {
    outDir: path.join(root, "dist/chrome-extension"),
    emptyOutDir: false,
    lib: {
      entry: path.join(root, "apps/chrome-extension/src/background.ts"),
      formats: ["es"],
      fileName: () => "background.js",
    },
  },
});
const manifest = {
  manifest_version: 3,
  name: "AutoGroupPoster",
  version: "1.0.0",
  description:
    "Organize groups and drafts, prepare campaigns, and review each post before sharing.",
  minimum_chrome_version: "116",
  permissions: ["storage", "sidePanel", "alarms"],
  action: { default_popup: "popup.html", default_title: "AutoGroupPoster" },
  side_panel: { default_path: "sidepanel.html" },
  background: { service_worker: "background.js", type: "module" },
  icons: {
    16: "icons/16.png",
    32: "icons/32.png",
    48: "icons/48.png",
    128: "icons/128.png",
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
};
await fs.writeFile(
  "dist/chrome-extension/manifest.json",
  JSON.stringify(manifest, null, 2),
);
await fs.cp("assets/icons", "dist/chrome-extension/icons", { recursive: true });
await fs.mkdir("releases", { recursive: true });
if (process.platform === "win32")
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Compress-Archive -Path 'dist/chrome-extension/*' -DestinationPath 'releases/AutoGroupPoster-1.0.0.zip' -Force",
    ],
    { stdio: "inherit" },
  );
else
  execFileSync("zip", ["-r", "../../releases/AutoGroupPoster-1.0.0.zip", "."], {
    cwd: "dist/chrome-extension",
    stdio: "inherit",
  });
console.log(
  "Built customer website, popup, side panel, worker and releases/AutoGroupPoster-1.0.0.zip",
);
