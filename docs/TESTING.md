# Verification record

Release verification on 2026-10-24 uses Node 24.12.0. The commercial toolchain requires Node 24.12+. Production Functions target Node 22 independently; frontend SDKs are bundled for Chrome. No real payment was charged and no production Firebase data was changed by the tests.

| Check | Result | What it establishes |
| --- | --- | --- |
| Commercial TypeScript and Functions compilation | Passed | Shared domain, React clients, extension worker and server types compile |
| Domain and cryptographic unit tests | 33 passed | Destination URL restrictions, plan boundaries/expiry, honest job transitions, content limits, HMAC verification, deterministic event identity |
| Auth, Firestore, Storage and handler integration | 15 passed | Registration/login/reset; ownership; rejected direct subscription/role/job writes; quotas; idempotent campaigns; device revocation; persisted queue recovery; confirmations; trial expiry; admin plans/access; support requests; release configuration; private image create/read/delete and overwrite rejection; monthly/yearly webhook state, cancellation, refund, payment failure/recovery; pending checkout reuse |
| Preserved mobile test suite | 77 passed across 10 files | Existing mobile behavior, including existing authentication, membership, UI, workspace and notification policies |
| Mobile TypeScript | Passed | Additive `/browser` screen and existing app compile |
| Production builds | Passed | Customer website, popup, side panel and bundled service worker |
| Extension artifact test | 1 passed | MV3 manifest, minimal permissions, local scripts/styles, PNG icons, ZIP existence |
| Website HTTP smoke checks | 8 routes returned 200 | `/`, `/login`, `/app`, `/admin`, `/privacy`, `/terms`, `/refunds`, `/contact` resolve through the SPA fallback |
| npm audit, commercial root and Functions | 0 reported vulnerabilities | Installed commercial dependency trees checked after upgrading vulnerable dependencies |

There are 126 automated test cases in the recorded unit, integration, mobile and artifact runs. The mobile suite initially hit a worker-start timeout under parallel system load; rerunning with one threads worker passed all 77 cases. This was an infrastructure failure, not a silently omitted test. The original mobile dependency lockfile is preserved; the commercial dependency audit does not certify that separate legacy mobile dependency tree.

The integration suite uses real local Firebase Auth, Firestore and Storage emulators with `demo-autogroupposter`. It invokes the exported callable handler with authenticated test fixtures. That checks server authorization and database transactions, but does not test the deployed callable HTTP token-verification middleware. Webhook signatures and transactions are real; the provider API is replaced by deterministic fixtures. A test named “sandbox webhook” means test-mode fixture payloads, not a completed checkout against a merchant sandbox account.

Worker recovery is checked by repeated polling against persisted jobs, not by executing an actual suspended Chrome worker. Browser runtime, UI rendering, accessibility and user-gesture behavior have not been independently exercised by a browser automation tool in this environment. HTTP smoke checks confirm routing, not rendered interaction correctness.

## Reproduce

```sh
npm ci
npm run release
npm run test:emulators
# mobile uses its own package and dependency lockfile
cd apps/mobile
npm ci
npm run typecheck
npx vitest run --maxWorkers=1 --pool=threads
```

The emulator wrapper can reuse the adjacent GroupPoster Node/Java/Firebase CLI installations. On a fresh machine install Firebase CLI and Java 21+; the wrapper prefers a local Firebase CLI when present. Tests use ports Auth 9195, Firestore 8185 and Storage 9295 to avoid other local services. Local Functions debugging uses 5105. Configure `.secret.local` only with sandbox values, and keep it out of Git.

## Required external acceptance

1. Deploy the reviewed rules, commercial Functions codebase and customer site to staging; verify email registration and reset flows from the final extension origin and website domain.
2. Load the ZIP's unpacked contents in Chrome. Register a browser, create a group/draft/campaign, review and open a destination, manually finish publishing, and record a user confirmation. Check popup → side panel user gesture, badge updates, offline handling, worker termination and full browser restart.
3. Build the updated Expo app, sign in to the same account, assign a mobile preparation campaign and observe its real state updates in both clients. Check device revocation while tasks are pending.
4. Use an approved merchant's test account to complete monthly/yearly checkout and portal plan changes, replay webhooks, fail/recover a renewal, cancel, expire and refund. Confirm actual provider receipts, amounts/currencies and entitlement dates. No live cards in automated tests.
5. Finalize operator identity, support contact, legal terms, retention, merchant approval, support/deletion procedures and the other launch gaps in REPORT.md. Capture honest screenshots and complete Chrome Web Store reviewer testing.

Passing local checks is not certification of production readiness, merchant approval or Chrome Web Store acceptance.

## Local interactive run ? 2026-10-24

The website was started on http://127.0.0.1:5173 with all clients pointed at local emulators. Auth, Functions, Firestore and Storage are running on the documented local ports. A local-only verified owner was seeded and a real HTTP login/token round trip successfully invoked `agpApi` bootstrap (admin=true, Free plan) and `admin.overview`. This verifies the local callable transport as well as the earlier direct-handler tests; production HTTPS and merchant sandbox testing remain separate. `dist/chrome-extension-local` was built for the same local backend without replacing the production ZIP. Automatic desktop browser opening was rejected by the execution environment policy; the user receives the local link for manual opening.

## Interface refresh verification

See DESIGN.md for the redesigned web and extension surfaces. Headless Chrome has now exercised the web interface on desktop and mobile widths: 42 captures, authenticated navigation across every workspace screen and owner-console tab, horizontal overflow checks, live composer preview, draft edit/save, and structured plan form submission all passed against local emulators. This supersedes the original note that no rendered browser interaction had been checked. Actual installed-extension worker/gesture checks and merchant sandbox acceptance remain separate.
