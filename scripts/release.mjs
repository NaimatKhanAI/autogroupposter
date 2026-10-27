import { spawnSync } from "node:child_process";
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 24 || (major === 24 && minor < 12))
  throw new Error("Use Node 24.12+ for the commercial release toolchain.");
for (const args of [
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  [
    "node_modules/typescript/bin/tsc",
    "-p",
    "functions/tsconfig.json",
    "--noEmit",
  ],
  ["node_modules/vitest/vitest.mjs", "run"],
  ["scripts/build.mjs"],
  ["--test", "tests/build.mjs"],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
