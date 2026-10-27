# Deployment and configuration

## Local builds

Run `npm ci`. Copy `.env.example` to `.env` and supply the public Firebase web app API key/app ID from project `groupposter-1f253`. Configure email/password in Firebase Auth, authorized customer website domains, password policy, verification/reset email templates, and abuse protections. The extension uses Firebase's dedicated `firebase/auth/web-extension` entry and IndexedDB persistence, shared by its popup, panel and worker origin. Google OAuth is not enabled: no unsupported popup flow or OAuth secrets are shipped.

Run `npm run release`. This runs type checks, domain/security tests and production builds. Run `npm run test:emulators` separately (Firebase CLI and Java 21+ required); the wrapper can reuse the adjacent existing project's installed tooling. Emulator project IDs start with `demo-` and tests do not charge money. Never point emulator tests at production.

## Firebase

Cloud Functions and Storage require an appropriately billed Firebase project. Upgrading Spark is an owner action; do not deploy until the owner has reviewed billing and rules compatibility.

1. `npm --prefix functions install` then `npm --prefix functions run build`.
2. Use Firebase CLI authenticated to the intended account/project. Root `firebase.json` declares a separate `commercial` functions codebase, preserving other codebases. Review CLI deletion prompts carefully; the retained mobile functions must not be deployed accidentally.
3. Set `LEMON_API_KEY` and `LEMON_WEBHOOK_SECRET` with `firebase functions:secrets:set`. For emulators only, put sandbox values in ignored `functions/.secret.local`.
4. Create `functions/.env.groupposter-1f253`: `LEMON_STORE_ID`, `LEMON_TEST_MODE=true`, `WEBSITE_URL=https://your-domain`. Use a real HTTPS domain. Never put those secrets in VITE_ or EXPO_PUBLIC_ variables.
5. Review existing production rules against root `firestore.rules`. Deploy `functions:commercial,firestore,storage,hosting` only after emulator and staging review. The website expects Firebase Hosting SPA rewrites.
6. With Application Default Credentials owned by the operator, run `node scripts/admin.mjs FIREBASE_UID`. This grants the secure `agpAdmin` custom claim. Sign out/in to refresh. No public email comparison grants administration. To revoke, append `revoke` and revoke sessions if immediate removal is required.
7. Owner console: sign in, click Owner console, configure `free`, optional `trial`, `pro-monthly`, `pro-yearly`, and `business` plans. Paid plans need provider variant IDs. Prices shown to customers must match provider checkout. No public paid price or paid entitlement is pre-enabled.

## Lemon Squeezy setup

Lemon Squeezy's supported countries explicitly include Pakistan for bank payouts. Paddle's unsupported supplier list does not list Pakistan. Both still require merchant onboarding, product approval, identity and payout verification; country availability is not account approval. Lemon Squeezy was selected because supported bank payouts and hosted subscription APIs fit this product. No merchant account was available for verification.

Create approved subscription products/variants for monthly, annual and Business billing. Use TEST mode and configure matching variant IDs and store ID. Point a provider webhook to `https://us-central1-groupposter-1f253.cloudfunctions.net/agpWebhook`; enable subscription created/updated/cancelled/resumed/expired/paused/unpaused and subscription payment success/failed/recovered/refunded events. Webhook signing uses raw-body SHA-256 HMAC, fixed-length timing-safe comparison, environment/store checks and atomic event deduplication. Authoritative subscription state is fetched to reduce stale delivery effects. Refunded payments revoke access conservatively.

Hosted checkout receives server-selected variant and authenticated UID in custom metadata. The return page does not grant access. Provider customer portal supplies invoices, payment updates and cancellation/plan changes configured in the merchant dashboard. Validate the portal's available upgrade/downgrade options in sandbox. `past_due`, unpaid, paused, expired and refunded states fall back to free; cancelled access lasts only through its paid-through date. No unconfigured grace period is assumed.

Before live mode, exercise successful and failed checkout, renewal, cancellation, expiration, refund, replay, out-of-order events, recovery, and plan change with your merchant account. Confirm amount/currency reports in the provider dashboard. Switching to live requires live API key, live signing secret, matching store/variants and `LEMON_TEST_MODE=false`.

## Mobile

The portable Expo source lives in `apps/mobile`. Configure its existing public Firebase environment, use Node 24.12+, `npm ci`, then `npx expo start`. Browser workspace is additive; the existing manual queue is preserved. Build new signed mobile artifacts after validating `/browser`. No existing Android APK was replaced. A unified migration of historical drafts/groups and legacy memberships is not performed automatically.

## Operations

Use Firebase Logging/Error Reporting, provider webhook delivery logs and provider transaction reports. Scheduled maintenance removes bounded rate-limit records; configure TTL on `agpUsers/*/limits.expiresAt`. Backup Firestore, set billing alerts, document incident response and retention, and test recovery before production. Pending jobs use persisted Firestore state; alarms resynchronize when Chrome is running, not while it is closed. Revoked devices cannot poll or advance jobs. No DOM content scripts or social host access are needed.

Deletion and support requests are durable and visible in the owner console, including review status. Actual account/data deletion still requires an operator procedure through Firebase Console. Review/cancel subscriptions, remove Auth account and owned Firestore/Storage data, and retain only legally required payment audit references. Automated deletion execution, complete lifetime revenue/uptime analytics and automated reconciliation are outstanding operational features; do not advertise them as complete.

Sources checked 2026-10-23:

- https://docs.lemonsqueezy.com/help/getting-started/supported-countries
- https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
- https://docs.lemonsqueezy.com/help/webhooks/signing-requests
- https://docs.lemonsqueezy.com/guides/developer-guide/webhooks
- https://firebase.google.com/docs/auth/web/chrome-extension
- https://developer.chrome.com/docs/extensions/reference/api/sidePanel

For fully local UI debugging, set VITE_EMULATOR=true and run Auth (9195), Functions (5105), Firestore (8185) and Storage (9295) emulators with project demo-autogroupposter. This mode uses only the demo Auth/project and never intentionally falls back to production authentication. The automated tests invoke the callable handler directly against emulator data; they do not replace a deployed HTTPS smoke test.
