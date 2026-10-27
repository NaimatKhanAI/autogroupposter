// Keep Expo's canonical dependency paths on the same Windows SUBST drive as Gradle.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const physicalRoot = fs.realpathSync.native(root);
const output = execFileSync(
  process.execPath,
  [
    '--no-warnings',
    '--eval',
    "require('expo/bin/autolinking')",
    'expo-modules-autolinking',
    'react-native-config',
    '--platform',
    'android',
    '--json',
  ],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);
function remap(value) {
  if (typeof value === 'string') {
    const normalized = value.replaceAll('\\', '/');
    const prefix = physicalRoot.replaceAll('\\', '/');
    if (
      normalized.toLowerCase() === prefix.toLowerCase() ||
      normalized.toLowerCase().startsWith(prefix.toLowerCase() + '/')
    ) {
      // CMake consumes these paths too; backslashes become escape sequences there.
      return path.join(root, normalized.slice(prefix.length)).replaceAll('\\', '/');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(remap);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remap(item)]));
  return value;
}
process.stdout.write(JSON.stringify(remap(JSON.parse(output))));
