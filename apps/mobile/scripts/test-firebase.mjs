import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 12))
  throw new Error('Firebase 13 tooling requires Node 24.12+. Switch Node versions and retry.');
const emulator = process.argv[2] ?? 'firestore';
if (!['firestore', 'auth'].includes(emulator))
  throw new Error('Expected firestore or auth emulator');
const env = { ...process.env };
const localJava = resolve('.tools/java21');
if (existsSync(localJava)) {
  const runtime = readdirSync(localJava, { withFileTypes: true }).find((d) => d.isDirectory());
  if (runtime) env.JAVA_HOME = join(localJava, runtime.name);
}
env.PATH = [
  dirname(process.execPath),
  ...(env.JAVA_HOME ? [join(env.JAVA_HOME, 'bin')] : []),
  env.PATH,
].join(delimiter);
const result = spawnSync(
  process.execPath,
  [
    resolve('node_modules/firebase-tools/lib/bin/firebase.js'),
    'emulators:exec',
    '--only',
    emulator,
    '--project',
    'demo-groupposter',
    emulator === 'auth'
      ? 'node --test tests/auth.emulator.mjs'
      : 'node --import tsx --test --test-concurrency=1 tests/firestore.rules.mjs tests/freeBackend.emulator.mjs tests/membership.rules.mjs',
  ],
  { env, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
