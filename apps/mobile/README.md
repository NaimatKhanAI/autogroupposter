# GroupPoster

A React Native + Expo + TypeScript mobile app for organizing Facebook Page posts and manual group sharing. The active backend uses Firebase Authentication and Cloud Firestore on the Spark free plan. It does not require Cloud Functions or a billing upgrade.

## Run

Use Node 24.12+ for development tools, then:

```sh
npm ci
npx expo start --go --clear
```

On Windows PowerShell use `npm.cmd` and `npx.cmd` if `.ps1` scripts are blocked. Scan the QR in Expo Go with your phone and PC on the same network. Original Firebase public client configuration is already saved locally in the ignored `.env`. For a fresh checkout, copy `.env.example` and fill the three Firebase values from Project settings > Your apps > Web app. No Analytics initialization is included. Never put Admin SDK credentials in EXPO_PUBLIC variables.

Project: `groupposter-1f253`. Expo owner: `naimatdevs-team`. EAS project ID: `b4b088f5-0ed9-439a-a11f-b35efe331f38`. Android package: `com.groupposter.manager`.

## Account and workspace

Create an account, open the Firebase verification email, then tap **I've verified my email**. The app retains an unverified session so email delivery can be retried. Existing accounts can sign in or request a password reset without creating another account.

Core features: saved groups and CSV imports, manual Page configuration, manual post import, unique sharing tasks, explicit user confirmations, pause/resume, scheduled task readiness, analytics, preferences, and account/data deletion. Confirmations are user attestations; they do not establish Meta verification.

Membership: verified accounts receive one server-timed 14-day trial. After expiry, access requires an admin-approved free grant or a valid paid period. Administrators manage approvals, manual subscription activation and USDT/PKR/SAR/AED monthly prices under **Settings > Admin console**; members see **Settings > Trial & subscription**. Automatic charging is not enabled. See [membership setup and verification](docs/membership.md). The updated APK is required to initialize membership; security rules enforce access for every client, including the optional n8n bridge.

Scheduled tasks become ready while the app is open or when it returns to the foreground. Hosted n8n webhooks, remote push, background schedule processing and media uploads are unavailable in this free version. An optional [self-hosted n8n intake bridge](docs/n8n.md) can import published Page posts and prepare sharing tasks using Firebase client authentication on Spark. It requires private setup on the n8n host and does not publish to Facebook groups or confirm shares. The app does not claim an active automation connection before that setup.

## Deploy free-plan rules

```sh
npx firebase login
npm run firebase:deploy
```

This command deploys Firestore rules/indexes only. The current free rules are deployed. They validate ownership, fields, related records, unique document identities, task transitions and user-attestation confirmations. Business writes go directly through the Firebase client SDK under these rules. Accounts require verified email.

The old `functions/` server implementation is retained as optional source for a future hosted backend; the app does not call it and the normal deployment command excludes it. Deploying those functions requires Blaze and a separate integration change. Storage is initialized but unused; `storage.rules` denies access.

## Checks

```sh
npm run check
npm run test:auth
npm run test:backend
npm run format:check
```

`test:auth` checks the real Auth SDK against the Auth emulator. `test:backend` (also `test:db`) checks security rules and actual free-backend operations against the Firestore emulator. These commands use `demo-groupposter`, never production; Node 24.12+ is required and Firestore also needs Java 21+. The wrapper reuses the ignored local Java runtime if present.

See [verification](docs/verification.md) for executed checks. Existing APKs must be rebuilt for these changes. iOS bundle ID, signing and device testing remain separate release setup.
