# Self-hosted n8n intake on Spark

The optional local bridge imports already-published Page posts and creates ready tasks for explicitly configured groups. It uses Firebase client authentication and existing Firestore security rules; no Cloud Functions, Admin SDK or Blaze upgrade is used. It does **not** publish to Facebook groups or confirm shares. The mobile app observes imported posts/tasks through its existing subscriptions.

## Run the bridge

Run on the same PC/VPS as n8n using the repository's Node 24.12+ toolchain:

1. Copy `.env.bridge.example` to `.env.bridge`. This file is ignored. Keep Firebase public client configuration in the existing `.env`.
2. Set the verified workspace account's email/password, a randomly generated token with at least 32 characters, the owned Page's Firestore document ID and the desired active group document IDs. These are workspace IDs, not Facebook numeric IDs. Empty group IDs enable import-only mode. Targets are limited to 50 per event.
3. Run `npm run bridge:start` (`npm.cmd` on Windows). The listener binds only to `127.0.0.1:8787`. Login sessions remain in memory; restart requires the private environment. Do not add these credentials to `EXPO_PUBLIC_*` variables or workflow JSON.
4. Import [the n8n sub-workflow](../integrations/n8n/groupposter-intake.json). In its HTTP Request node, choose an **HTTP Header Auth** credential with name `Authorization` and value `Bearer YOUR_PRIVATE_BRIDGE_TOKEN`.
5. Call this sub-workflow from the existing Page poster **only after successful publication**. Map the producer's actual output into the payload below. The workflow remains inactive/unconnected in this repository until imported and configured in your n8n instance.

```json
{
  "event": "page.post.published",
  "event_id": "stable-published-post-event-id",
  "post_url": "https://www.facebook.com/yourpage/posts/your-post-id",
  "caption": "Published caption",
  "media_type": "link"
}
```

The sub-workflow input accepts `event_id` (or `post_id`), `post_url`, `caption` and `media_type`. Page/group selection comes from the bridge's private configuration, never from the incoming event. Source events with another field layout must be mapped first.

## Networking

The n8n worker making the HTTP request must be able to reach the bridge listener. A browser reaching a remote n8n website does not give its VPS access to your PC's loopback. For a VPS deployment, run the bridge on that VPS. For Docker, use an explicitly configured host network or a private tunnel; `127.0.0.1` inside a container refers to the container. Keep the listener private. A remote connection needs a private tunnel or an authenticated HTTPS reverse proxy with appropriate network restrictions.

The supplied project URL is `https://n8n.agentelyx.tech/projects/87YG7zvqFeZRRrh1/workflows`. It could not be reached from the development environment on 2026-10-22; no live workflow was modified and no credentials were extracted from a browser session.

## Behavior and verification

- `POST /v1/posts` requires the bearer token and JSON. Requests above 64 KiB are rejected. Only one delivery is processed at a time; retry a `429` response.
- Ownership, Page association and group availability are checked before import. Firestore rules enforce the authenticated owner's writes.
- Normalized Facebook URLs deduplicate posts; the existing post/group identity deduplicates tasks on retries. A failed multi-group delivery can be retried to finish missing tasks. Existing post captions and task states are preserved.
- The response contains `post_id`, `existing`, `target_groups` and `publication: "requires_user_action"`. `target_groups` counts configured destinations, not newly published shares. An event ID is echoed for correlation; deduplication uses the post URL/task identities.
- Existing client operations retain the legacy `mobile` audit-source value required by current rules. This is not proof of Facebook publication.
- Stop the process or rotate its token to revoke n8n intake. Spark quotas apply; the existing owned-collection reads are intended for a small workspace.
- Start with one real published post and one permitted group, confirm it appears in the app, retry the same event and check that no duplicates appear. Actual group publication remains a separate action. Third-party group membership and posting rules still govern whether you can share there.

Automated tests cover validation, configured target checks, retries/deduplication and the authenticated HTTP boundary. Live Firebase/n8n acceptance still requires private configuration and service access.

The retained optional Cloud Functions webhook is unrelated to this local bridge and remains undeployed.
