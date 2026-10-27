# Android release preparation

The local APK is a staging preview verified with debug signing. Production distribution requires owned signing credentials, hosted integration checks and the release gates below.

## Provision and build

1. Install Node 24.12+, JDK and Android SDK for local native builds. Run `npm ci` and `npx expo install --check`.
2. Provision Firebase Authentication (Email/Password) and Firestore, then run `npm run firebase:deploy` to deploy the Spark-compatible rules. The app handles due reminders in the foreground; background automation and push are unavailable in this version. See README.md.
3. Choose an application ID you control in app.config.ts. `com.groupposter.manager` is the initial configuration. Create an EAS project with `eas init`, set its project ID in `.env` / EAS environment and configure public Firebase values for each build environment.
4. Review the included geometric launcher, adaptive icon and native splash configuration with your final brand. Capture real Android screenshots and confirm icon safe-zone rendering.
5. Remote push is unavailable in the current Spark app. Configure FCM/APNs only when a separately approved hosted notification backend is integrated.
6. Publish reviewed privacy/terms and a public account-deletion request webpage. Configure their URLs. EAS environment values must not contain administrative keys.
7. Build:

```sh
npx eas-cli build --platform android --profile development
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

Preview generates APK; production generates signed AAB. EAS manages signing after account configuration. Preserve signing ownership and recovery procedures. Production credentials and Play Console access are external requirements.

For a local standalone phone preview on Windows, authorize USB debugging, generate native files with `npx expo prebuild --platform android --no-install`, then run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/install-android.ps1
```

The script reads process or saved user-level `ANDROID_HOME` and `JAVA_HOME`; explicit `-SdkPath` and `-JavaPath` overrides are also supported. On this workstation the verified portable tools are installed under `%LOCALAPPDATA%/GroupPoster/toolchain`. The script maps the repository's parent directory to an available short drive, keeping the project below a folder rather than at the drive root. This avoids Windows native object path limits and preserves Expo project discovery. The config plugin and `scripts/android-autolink.cjs` keep canonical dependency paths on that same drive, avoiding mixed-drive codegen failures. The mapping is reused for subsequent builds and recreated after restart. On a path change, native CMake and autolinking caches are renamed to backups and regenerated. It builds only the selected device architecture, preserves app data during installation, and copies the APK to `artifacts/GroupPoster-preview.apk`. The command's execution policy applies only to this PowerShell process. This local APK uses the generated debug signing certificate; use the production EAS profile and owned signing credentials for distribution. Keep the project folder name short. Only Firebase client configuration belongs in the public mobile environment.

## Verification checklist

- `npm run check`, formatting check, Expo Doctor, Android Metro bundle.
- Firestore emulator rule tests, Cloud Functions build, backend transition/webhook tests, and authenticated integration tests against staging.
- Fresh registration, email verification, valid/invalid login, password recovery, token refresh, secure logout, account deletion with cascades.
- Cross-account reads and attempted writes; server-side relation ownership checks; no secret keys in the mobile bundle.
- Webhook invalid signature, ±5-minute replay window, payload validation, duplicate event, collision, concurrent retries, unconfigured Page and rate limits.
- Queue duplicates, invalid transitions, explicit attestation, pause/resume, reminder timing across timezone/DST, retry/cancel and device lease conflicts.
- Physical-device notifications with app foreground/background/terminated, deep links, denied permissions, stale tokens and Expo receipt errors. Implement receipt reconciliation before high-volume production use.
- Light/dark mode, TalkBack, large font, keyboard, Android back navigation, smallest supported screens, portrait rotation lock.
- Slow network, airplane mode, API timeout, empty lists and errors. Mutations require connectivity; failed mutations show errors and require deliberate retry. No hidden offline mutation queue.
- CSV errors, 500-row maximum and correct escaping; avoid exporting sensitive notes to unintended recipients.
- Verify the native date/time picker on supported Android devices, including daylight-saving changes. Selections show device-local time and store UTC.
- Firestore lists currently read the owned collection. Add pagination and indexed aggregates before large workspaces; server transactions reject changes above 450 writes.
- `.maestro/smoke.yaml`: run `maestro test -e TEST_EMAIL=... -e TEST_PASSWORD=... .maestro/smoke.yaml` on staging build. Do not commit test credentials. Repeat in both Android themes.

## Play Console

Complete app listing, screenshots from real Android builds, content rating, target audience, independent-product branding and review credentials. Declare notification permission only as used. No AccessibilityService, contacts, microphone, session scraping or unsupported group auto-publishing.

Data Safety checklist: account email/ID; user-supplied profile, links, notes and post metadata; operational activity; device and push identifiers; transmission encryption; processors (Firebase/Google, Expo and media hosts); data sharing purposes; deletion support; retention and backup policy. Declare actual deployed behavior, not this draft. Verify current Play requirements in Console at submission time. Obtain a security/privacy review and satisfy Play testing requirements. Do not submit until all required release gates pass.

Google's [account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111) requires an in-app deletion path and a public web request resource for apps with account creation. The native deletion flow is implemented; the operator must publish that web resource. Use Google's [Data Safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469) when completing declarations for the actual deployed service.
