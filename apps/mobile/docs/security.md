# Spark backend security

Firebase Auth uses AsyncStorage persistence. Business writes run through the Firebase SDK and deployed Firestore rules; there is no client Admin SDK or service credential. Mutation attempts require a verified user and network connectivity.

Rules restrict document reads to owners, except a verified user's probe of a nonexistent public business document needed for transactional creation. Profiles and deletion markers are readable only by their own user. Integrations, push tokens, replay records and other server-only collections remain inaccessible.

Rules validate allowed fields, immutable ownership, server timestamps, parent-record ownership and task transitions. SHA-256 document identities enforce uniqueness of owner/group URL, owner/Page ID, owner/post URL and post/group tasks. Creating a task directly in confirmed state, bypassing the sharing transition, rewriting ownership or claiming a provider receipt is denied. Confirmations are user attestations; they never prove that an external Facebook publication occurred.

Clients can edit their own profile allowlist and groups. A group's URL is fixed after creation; add a new group to use another URL. Audit entries describe user-controlled activity and are not an independent provider record. Lists/analytics currently read full owned collections; pagination and indexed aggregates are needed for large workspaces. CSV imports execute per-record transactions and report partial progress safely on failure.

Schedules advance in the foreground; there is no background service, signed webhook, remote push or secret integration credential in the active free backend. Storage denies all access. Firebase Spark quotas still apply, but no billing upgrade or paid deployment is performed.

Deletion checks for recent authentication, writes a deletion marker, removes owned application records and the profile, then deletes the Auth user. Rules block new business writes during cleanup. Interrupted deletion can be resumed from the workspace recovery screen after sign-in. A minimal uid/timestamp deletion marker remains to prevent stale writes. No Facebook content is deleted by this app.
