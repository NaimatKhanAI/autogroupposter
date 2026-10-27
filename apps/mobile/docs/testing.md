# Tests

- `npm run check`: TypeScript, ESLint and Vitest (58 unit tests).
- `npm run test:auth`: Firebase Authentication emulator and the real JavaScript SDK, covering signup, verification, login, reset and deletion.
- `npm run test:backend` or `npm run test:db`: Firestore emulator, actual client backend operations and ownership/security rules (11 tests).
- `npm run format:check`: repository formatting.

Emulator tests use demo-groupposter and refuse to run without the emulator host. Node 24.12+ is required. Firestore needs Java 21+; scripts/test-firebase.mjs uses the ignored local Java runtime when present, otherwise JAVA_HOME/PATH. Tests never alter system Java settings.

`npm run functions:build` checks the retained optional server source. `test:functions` is a legacy HTTP suite for an explicitly configured disposable Cloud Functions deployment; it is not part of the free backend acceptance path.

Live testing in this task used only disposable QA accounts and their records. Physical-device testing remains necessary for keyboard/safe areas, accessibility, verification-email app return, offline behavior and large font layout. A successful Metro export does not establish device rendering.
