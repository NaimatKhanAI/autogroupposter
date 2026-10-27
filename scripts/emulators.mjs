import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, readdirSync,writeFileSync } from "node:fs";
import path from "node:path";
const sibling = path.resolve("../GroupPoster");
const cli = path.join(
  sibling,
  "node_modules/firebase-tools/lib/bin/firebase.js",
);
const node = existsSync(path.join(sibling, ".tools/node24/node.exe"))
  ? path.join(sibling, ".tools/node24/node.exe")
  : process.execPath;
const java = path.join(sibling, ".tools/java21");
const runtime = existsSync(java)
  ? readdirSync(java, { withFileTypes: true }).find((d) => d.isDirectory())
  : null;
const env = {
  ...process.env,
  CI: "true",
  DEBUG: "",
  GCLOUD_PROJECT: "demo-autogroupposter",
  FUNCTIONS_DISCOVERY_TIMEOUT:'60',
};
if (runtime) {
  env.JAVA_HOME = path.join(java, runtime.name);
  env.PATH = path.join(env.JAVA_HOME, "bin") + path.delimiter + env.PATH;
}
env.PATH = path.dirname(node) + path.delimiter + env.PATH;
const localCli = existsSync("node_modules/firebase-tools/lib/bin/firebase.js")
  ? path.resolve("node_modules/firebase-tools/lib/bin/firebase.js")
  : cli;
if (!existsSync(localCli))
  throw new Error(
    "Install firebase-tools locally: npm install --save-dev firebase-tools",
  );
execFileSync(
  node,
  ["node_modules/typescript/bin/tsc", "-p", "functions/tsconfig.json"],
  { stdio: "inherit" },
);
const serve=process.argv.includes('--serve');
if(serve&&!existsSync('functions/.secret.local'))writeFileSync('functions/.secret.local','LEMON_API_KEY=local-demo-not-a-merchant-key\nLEMON_WEBHOOK_SECRET=local-demo-signing-secret\n');
const args=serve?[localCli,'emulators:start','--project','demo-autogroupposter','--only','auth,firestore,storage,functions']:[
    localCli,
    'emulators:exec',
    '--project',
    'demo-autogroupposter',
    '--only',
    'auth,firestore,storage',
    'node --test --test-concurrency=1 tests/auth.emulator.mjs tests/rules.emulator.mjs tests/api.emulator.mjs tests/storage.emulator.mjs',
];
const r = spawnSync(
  node,
  args,
  { env, stdio: "inherit" },
);
process.exitCode = r.status ?? 1;
