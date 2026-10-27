# Device update and n8n preparation — 2026-10-22

The current Android release preview was built and installed with `adb install -r` on the connected vivo 1907 (arm64-v8a). Gradle `assembleRelease` passed, including native compilation, release lint and a 1678-module JavaScript bundle. The installed package is `com.groupposter.manager`, version 1.0.0/code 1. First installation time was preserved; last update time changed. The app process remained running after launch, and sampled AndroidRuntime/ReactNativeJS error logs were empty.

The unlocked phone rendered the sign-in screen correctly. The owner then signed in on the phone; no credentials were collected or entered by the agent. Authenticated deep-link navigation to Groups, Queue and Automations succeeded. Group summary cards, queue summary cards, filters, sorting controls, scrolling and zero-record states rendered correctly. Automations showed the n8n setup-required card from the new bundle. The account had zero groups and tasks, so populated selection, task transitions and actual Facebook sharing remain untested on-device. Sampled app error logs remained empty after navigation.

Local APK: `artifacts/GroupPoster-preview.apk`; screenshots: `artifacts/groupposter-device-update.png`, `artifacts/device-groups.png`, `artifacts/device-queue.png`, `artifacts/device-integrations.png`, `artifacts/device-groups-empty.png` and `artifacts/device-queue-empty.png`. These artifacts are ignored by Git. The APK uses preview/debug signing, not Play production signing.

Build repair: Expo's canonical paths and Gradle's Windows SUBST path were normalized onto the same drive. Autolinking paths use forward slashes so CMake does not treat backslashes as escape sequences. Generated autolinking caches were renamed to backups and regenerated; app data was not cleared.

Optional n8n preparation:

- Added a loopback-only authenticated intake bridge using Firebase client SDK operations under existing security rules. It imports published Page posts and prepares tasks for configured groups; it does not publish to Facebook or confirm sharing.
- Added `integrations/n8n/groupposter-intake.json` and setup instructions in `docs/n8n.md`.
- Created an ignored `.env.bridge` with a generated token. Account credentials and Page/group targets remain unconfigured, and no bridge listener was left running.
- All 71 unit/local HTTP tests across 9 files passed. TypeScript including bridge scripts, changed-file ESLint and formatting passed. Starting without private configuration failed closed before serving requests.
- Live n8n/Firebase bridge acceptance was not run. The supplied n8n domain resolved, but HTTPS connections timed out from the development environment; no live n8n workflow was modified. No billing upgrade, Cloud Functions deployment or real Facebook publication occurred.

The workstation uses Node 22.16.0; the repository recommends Node 24.12+. Firestore emulator checks were not rerun for this adapter; its tests use an injected backend and local HTTP server, while database writes reuse the existing backend operations.
