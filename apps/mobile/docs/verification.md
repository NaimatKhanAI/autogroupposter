# Current verification � 2026-10-17

- App TypeScript/ESLint and 58 unit tests passed.
- Auth emulator: real Firebase SDK signup, verification, login, reset and deletion passed.
- Firestore emulator: all 11 security and free-backend tests passed, including profile/Page/default Page, groups, duplicate queue creation, post import, confirmation, scheduling, CSV/bulk actions, group cascades, cross-account denial and deletion locks.
- Android JavaScript/Hermes export passed (1676 modules). This is not a rebuilt APK or physical-device visual acceptance.
- Original Firebase public config is connected in the ignored `.env`; Analytics was not added.
- Live Firebase signup and password login passed with a disposable QA account that was deleted.
- Free-plan Firestore rules/indexes deployed successfully to groupposter-1f253.
- Live free-backend smoke test passed profile initialization, Page/default Page, group, post, queue, task confirmation and analytics using temporary QA data. Account deletion also passed; the final disposable QA account and its test records were cleaned up.

Cloud Functions deployment was rejected because Blaze was required. The operator explicitly chose Spark, so the active app was changed to direct Firestore operations protected by rules. No billing upgrade was performed. Cloud Functions, automatic n8n imports and remote push are not active. Scheduled tasks advance while the app runs or returns to the foreground.

Auth and all shared screen components have been restyled. Email resend and verified-session refresh are recoverable; password reset validates only visible required fields, existing shorter login passwords are accepted, and errors are readable. Phone acceptance and live email delivery to the user's own mailbox still require device verification. iOS still needs bundle ID/signing setup. Existing APKs must be rebuilt.
