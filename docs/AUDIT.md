# Existing project audit — 2026-10-23

The requested checkout contained only `.git`. The actual app was found at `../GroupPoster`. Its source was copied, excluding secrets and generated artifacts, to `apps/mobile`; no files in the original app were changed.

Actual stack: Expo SDK 57, React Native 0.86.3, React 19.2.3, Expo Router, TypeScript 6, Zustand, TanStack Query, Firebase 13, Zod, Expo Notifications, Secure Store, document picker and sharing. The app expects Node 24.12+ for its current tools, while the commercial package uses Node 22+. Mobile SDK installation and platform builds remain separate.

Screens: authentication/callback, dashboard, groups and group detail, posts and post detail, queue, settings, Page management, CSV/manual import, integrations, activity, analytics, membership and admin. Services cover Firebase client operations, trial membership, reminder advancement, offline detection, notification runtime, workspace locks and deletion. Colors use teal `#137F72`, dark green `#103D37`, pale backgrounds and rounded cards. The commercial clients follow those tokens.

The active mobile backend is client SDK plus strict Firestore rules on Spark; retained Cloud Functions are optional older source. Existing membership uses `memberships`, `app_admins`, and `membership_config`; groups/posts/tasks use `facebook_groups`, `imported_posts`, and `sharing_tasks`. Storage was denied and unused. The commercial backend needs Blaze and uses `agpUsers/{uid}/{groups,posts,campaigns,jobs,devices,activity,support,limits}`, `agpPlans`, `agpSubscriptionEvents`, and `agpAdminAudit` to avoid collisions. Root Firestore rules retain the original rules and add commercial read-only client access.

New mobile screen: `/browser`, linked from Settings, shares the extension's callable API, browser list, drafts, groups, campaign jobs and quotas. Existing manual workspace records are preserved rather than automatically migrated. Legacy memberships and historical data retain their original behavior; commercial subscriptions govern the new browser workspace. This separation must be considered when planning a later unified legacy membership migration.

The repository has no merchant approval, operator legal identity, public domain, Chrome Web Store ID, or privileged production credentials. Public Firebase web configuration is supplied by deployment environment. No secrets were copied from the original project's .env files.
