# Implementation scope

The current app runs on Firebase Spark using Auth and direct Firestore reads/writes under security rules. It includes React Native/Expo Router screens, shared TypeScript validation, recoverable email verification, groups/CSV, manual Pages/posts, transactional task transitions, foreground reminders, analytics and recent-login account deletion.

No Cloud Functions, signed webhooks, background schedule worker, remote push or Storage uploads are used by the active app. The retained functions/ source is optional for a future billing-enabled backend and is not deployed by the free command. Adding it back requires explicit feature integration and deployment tests.

The auth UI, overview, tabs, cards, fields, buttons, filters, empty/error states and settings were updated. Native Android/iOS acceptance, store signing and operator legal URLs remain release work.

Workspace continuation (2026-10-21): group summary cards, collection filters, alphabetical/least-recently-shared sorting and visible-group bulk selection are connected. Queue summaries distinguish ready, confirmation, scheduled and paused work, with priority/newest sorting and a paused filter. Post assignment uses searchable choice cards, preserves selections across searches and excludes inactive, other-Page and already-assigned groups. Assignment waits for group/history reads to succeed. Paused schedules are excluded from the overview's upcoming reminders. These changes require a fresh native build and device acceptance before delivery.

Optional n8n intake (2026-10-22): a loopback-only authenticated Node bridge and importable n8n sub-workflow can import published Page posts and prepare explicit group tasks through the existing client backend. This remains a separately configured self-hosted process, not a deployed Cloud Function or Facebook group publisher. Live n8n/Firebase acceptance is pending private configuration and access to the operator's n8n host. See docs/n8n.md.

Membership (2026-10-22): 14-day server-timed trials, administrator-approved ongoing free access, manually activated paid periods, account pause/restore, protected administrator roles and configurable USDT/PKR/SAR/AED prices are implemented. The verified operator account was provisioned as admin, tested access rules deployed and the updated Android preview installed. All 77 unit tests and 19 Firestore emulator tests passed. Automatic payment processing is not enabled. See docs/membership.md.
