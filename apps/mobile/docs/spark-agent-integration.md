# Agent connection without Blaze

The workspace must remain on Firebase Spark. The current mobile client uses Firebase Authentication and owner-scoped Firestore operations; no Cloud Functions deployment is needed for those operations. No browser companion or producer connection is currently installed.

## Prepared connection

An authenticated desktop companion can receive a successfully published Page post from the existing posting agent, then use the same Firebase client operations as the app:

1. Receive the published Facebook post URL, caption and the configured workspace Page ID. A draft caption alone is not a published post.
2. Sign in to the owner's verified Firebase account using client authentication. Keep session credentials local; never put Admin SDK credentials, passwords or Facebook cookies into mobile code or messages.
3. Validate the Facebook URL and Page ownership, then import the post. Use the existing normalized-URL identity to handle retries without duplicate imports.
4. Create unique post/group tasks for the owner's explicitly selected active groups. Respect the Page association and preserve existing tasks.
5. The mobile app observes the records through its existing Firestore subscriptions. A scheduled task becomes ready when the mobile app opens or returns to the foreground.

The local Node bridge and n8n sub-workflow are implemented in scripts/agent-bridge.ts and integrations/n8n/groupposter-intake.json. Unit and local HTTP tests cover validation, retries and the authentication boundary. Private configuration, deployment beside n8n, producer-output mapping and live end-to-end acceptance remain pending. It is not a deployed webhook or an active integration. Spark quotas still apply; the bridge must be running to receive events. See docs/n8n.md for setup.

## Group publication is a separate capability

Importing a post and creating queue tasks do not publish anything to Facebook. The current app opens Facebook and records explicit user confirmations. A paid Firebase plan does not grant Facebook publishing permissions.

The Meta Groups API and its `publish_to_groups` permission were retired. An extension claiming automatic group publication must be inspected for its actual interface and behavior before integration; do not present task creation or a browser launch as a successful share. Do not mark tasks confirmed based only on an agent's Page-post event.

## Required producer details

- The existing Page-posting agent is described as "FB Auto Poster" in self-hosted n8n at n8n.agentelyx.tech. Its workflow export/output schema and any separate browser extension's exact link are still needed.
- Its supported output: webhook, local command, API, extension messages or exported records.
- Whether target groups are owned/administered by the user or are third-party groups, and which account/Page is authorized to post.
- Whether the producer provides a published post URL and a stable event ID.

After those details are available, select the adapter and test a single post/group workflow before enabling a recurring connection. Keep the existing manual-sharing workflow available.
