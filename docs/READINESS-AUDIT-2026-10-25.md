# Readiness audit — 2026-10-25

Verdict: the repository contains a buildable local product candidate. It is **not ready for a paid public launch**. A passing build and the earlier web design review do not establish installed-extension or production-payment readiness.

This review does not patch the application defects below. It adds reproducible audit probes and records current evidence. Test fixtures run in a separate set of emulator ports (Auth 9395, Firestore 8385, Storage 9495) so they do not change the interactive local app's data.

## Release blockers

### Expected production API is unavailable

An unauthenticated, read-only-in-effect POST to `https://us-central1-groupposter-1f253.cloudfunctions.net/agpApi` returned HTTP **404**. This is the default project's expected callable URL. A deployed callable would reject a missing authenticated session rather than return a missing endpoint. Until the commercial backend is reachable, production extension group/draft/campaign operations cannot be certified as working. This observation does not assert that no other deployment exists elsewhere.

Public Firebase client values are present, but no public website URL is configured in the checked local environment and `functions/.env.groupposter-1f253` is absent. Cloud Secret Manager/account configuration was not inspected; merchant approval or live credentials must not be inferred from local placeholder files.

### P1: provider trial status is rejected

`packages/shared/domain.ts:59` accepts `trialing` but not Lemon Squeezy's `on_trial`. The webhook copies `a.status` directly into the subscription record (`functions/src/index.ts:736`). A valid provider trial therefore resolves to the Free plan instead of its purchased plan. The internal trial fixture uses `trialing`, which is why existing tests miss this provider-specific case.

The provider's official subscription-object documentation lists `on_trial`: https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object

Required correction: normalize provider states and dates at the adapter boundary, then test real provider trial payloads separately from internal promotional/trial records.

### P1: pending jobs can disappear behind history

The queue query limits results to 200 documents **before** filtering status, due date and expiry (`functions/src/index.ts:368`). Completed jobs can consume all those results. The general jobs list also has a fixed 500-record cap without a continuation cursor (`functions/src/index.ts:148`). A pending job outside both document-order windows is invisible to the worker and workspace, despite being valid and due.

Audit reproduction: seed 500 completed documents ordered before one pending document. Polling returns zero pending jobs, and the 500-item list omits the pending job. Required correction: query actionable jobs server-side with appropriate indexes and paginate history separately.

### P1: Storage bypasses account suspension and total upload controls

`storage.rules:6` checks authenticated ownership, verified email, MIME type and individual file size, but does not consult suspended account state or any upload reservation/total usage budget. A suspended verified account can create another owned image directly using the Storage SDK, even though the callable API denies its operations. This is a write/cost-control gap, not evidence that one customer can read another customer's images.

Required correction: server-authorized upload reservations or an equivalent enforced upload budget, suspension checks, and orphan-media cleanup. Per-file limits and client-side checks alone do not enforce a total upload policy.

### P1: legacy mobile deletion leaves commercial billing/data behind

`apps/mobile/src/firebaseOperations.ts:479` deletes the old manual-workspace collections, then removes `profiles`, `memberships` and the Auth user. It does not remove `agpUsers`, commercial Storage media, support queue references, or cancel an existing payment-provider subscription. The same Auth account is used by the commercial extension, so a subscribed user could delete login access while billing remains active and commercial data remains orphaned.

The website's newer deletion action is explicitly a review request, which is safer but still requires an operator procedure. Required correction: one coordinated deletion flow across both interfaces, including billing cancellation/confirmation, owned data/media cleanup, and defined retention of legally required billing records. No real account was deleted during this audit.

### P2: expired subscribers cannot start a new checkout

The checkout guard rejects any stored `providerSubscriptionId`, regardless of expiration (`functions/src/index.ts:554`). The webhook also rejects a replacement subscription ID (`functions/src/index.ts:710`). There is no implemented reconciliation operation to complete that replacement. Returning customers can be stuck unless an operator manually edits the mapping.

Required correction: explicitly handle terminal subscriptions and new checkout ownership mappings, while retaining historical subscription references and rejecting stale old-subscription updates. Verify the flow with the merchant's actual customer portal and sandbox.

### P2: version management does not record the actual client version

Every registration is stamped as `1.0.0` by the server (`functions/src/index.ts:227`). Minimum-version checks use that stored value. Raising the minimum version can therefore block updated browsers, while a backend-only constant update can mislabel old clients. Required correction: transmit/validate client version for compatibility and refresh device metadata during normal synchronization; do not treat a client-reported version as a security credential.

## Other missing acceptance evidence

- Actual merchant sandbox checkout, plan changes, invoices, renewals, refunds and failure recovery are not verified against a merchant account. Existing webhook tests use real signatures and emulator transactions but mock the external provider API.
- An isolated automated attempt with installed Chrome 155 did not expose a side-loaded extension service worker. This is a verification limitation, not proof of an extension defect. Load-unpacked login, popup → side-panel user gesture, browser restart, suspension/recovery, revocation, and real local-extension/mobile synchronization still require installed-runtime acceptance.
- Existing mobile manual-workspace data and membership remain separate from the commercial browser workspace. The new `/browser` screen uses the shared commercial API; historical data and legacy entitlement migration are not complete.
- The owner console is bounded to loaded samples (for example, 200 customers and 100 requests). There is no global customer pagination/search, complete lifetime revenue reporting or automated provider reconciliation.
- Privacy/terms/refund pages still identify unfinished operator details. Public support contact, domain, refund terms, retention and deletion procedures must be finalized before accepting customers or submitting to the store.
- Current browser polling does not clear an existing badge on sign-out and does not surface stored `syncError` in the workspace; stale status needs refinement.

## Verification and scope

Fresh release checks compile the TypeScript clients/backend, run the 33 policy/cryptographic unit tests, build the website and all extension entrypoints, and pass the MV3 artifact test. Production dependency audits for the commercial root and Functions report no known vulnerabilities at the time checked; this does not certify business logic or the preserved mobile dependency tree.

`scripts/audit-isolated.mjs` runs the existing 15 emulator integration cases, followed by `tests/readiness-probes.mjs`. The probes assert the **current defective behavior** for provider trials, expired checkout, queue starvation and suspended uploads. They must not be counted as passing product acceptance tests. The build ZIP remains an installation/deployment candidate, not a verified published product.

Observed output: 33 unit tests, 15 emulator cases and 1 artifact test passed; all four defect reproductions logged `CONFIRMED`. The outer redirected PowerShell invocation of the isolated runner reported a nonzero status while the emulator log records its child script exiting successfully; a nonfatal Google metadata lookup warning was also written to stderr. The child results are recorded separately rather than representing that wrapper invocation as an entirely clean run. The release runner itself exited successfully.

The previous 42-view web design review and 77 mobile tests are historical evidence and were not all rerun as part of this audit. Public automatic Facebook Group publishing is not implemented or claimed: the extension prepares content and the user completes publication.

## Suggested repair sequence

1. Correct provider-state mapping, terminal-subscription checkout/reconciliation, and queue query/pagination; add regression tests that fail on the current defects.
2. Coordinate mobile/web account deletion and enforce media upload authorization/budgets.
3. Fix client version reporting and stale/offline status; complete installed-extension and mobile-device acceptance.
4. Configure and deploy the production backend/website, run merchant sandbox acceptance, finalize operator policies/support, and then prepare the store submission.
