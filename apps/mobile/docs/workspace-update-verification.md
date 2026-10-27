# Workspace update — 2026-10-21

Completed group summaries, collection/search filters, sorting and visible bulk selection; queue summaries, paused filtering and priority/newest sorting; searchable post assignment with existing tasks excluded and loading/error guards. The overview omits paused scheduled tasks.

Validation:

- TypeScript and ESLint passed.
- All 65 tests across 8 files passed with `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --pool=threads`. The initial default fork run hit a UI worker startup timeout; the complete single-worker run passed.
- Android/Hermes export passed: 1678 modules. Local output: `artifacts/workspace-update-2026-10-21` (ignored by Git).
- Changed source formatting passed Prettier; Git whitespace check passed.

The local runtime reports Node 22.16.0; the repository recommends Node 24.12+. No dependency changes or backend deployments were made. No new APK was built, and physical-device visual acceptance remains outstanding.

Device acceptance: verify light/dark appearance, collection and queue filters, selections preserved across search changes, bulk activation, excluded assigned groups, scheduled reminders and sharing confirmations.
