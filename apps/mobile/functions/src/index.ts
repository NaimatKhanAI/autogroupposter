import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import { z } from 'zod';
import { webhookSchema, facebookUrl } from './domain';
import {
  tables,
  defaultProfile,
  apply,
  advance,
  ingest,
  verifySignature,
  hash,
  now,
  type Workspace,
  type Row,
  type Table,
} from './engine';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
const db = getFirestore();
const projectId = process.env.GCLOUD_PROJECT || 'groupposter-1f253';

// All mutations for an owner touch this lock, including webhooks and scheduled work.
// Firestore retries conflicting transactions, preserving uniqueness and task transitions.
async function workspace<T>(
  uid: string,
  run: (w: Workspace) => T,
  rateLimit = false,
  token?: string,
): Promise<T> {
  return db.runTransaction(async (tx) => {
    const lockRef = db.doc('workspace_locks/' + uid);
    const profileRef = db.doc('profiles/' + uid);
    const [lock, profile, ...snapshots] = await Promise.all([
      tx.get(lockRef),
      tx.get(profileRef),
      ...tables.map((table) => tx.get(db.collection(table).where('owner_id', '==', uid))),
    ]);
    if (lock.data()?.deleting)
      throw new HttpsError('failed-precondition', 'Account deletion is in progress');
    let rate = lock.data()?.rate ?? { start: Date.now(), count: 0 };
    if (rateLimit) {
      if (Date.now() - rate.start >= 60000) rate = { start: Date.now(), count: 0 };
      if (rate.count >= 120)
        throw new HttpsError('resource-exhausted', 'Too many requests. Try again in a minute.');
      rate.count++;
    }
    if (token) {
      const existing = await tx.get(db.doc('push_tokens/' + hash(token)));
      if (existing.exists && existing.data()?.owner_id !== uid)
        throw new Error('Token belongs to another session');
    }
    const w = {
      profile: profile.exists ? { ...profile.data(), id: uid } : defaultProfile(uid),
    } as Workspace;
    const previous = new Map<Table, Map<string, string>>();
    tables.forEach((table, i) => {
      const snapshot = snapshots[i] as FirebaseFirestore.QuerySnapshot;
      w[table] = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      previous.set(table, new Map(w[table].map((row) => [row.id, JSON.stringify(row)])));
    });
    const oldProfile = profile.exists ? JSON.stringify(w.profile) : null;
    const result = run(w);
    const writes: (() => void)[] = [];
    if (JSON.stringify(w.profile) !== oldProfile) writes.push(() => tx.set(profileRef, w.profile));
    for (const table of tables) {
      const before = previous.get(table)!;
      const ids = new Set(w[table].map((row) => row.id));
      for (const row of w[table]) {
        if (before.get(row.id) === JSON.stringify(row)) continue;
        writes.push(() => tx.set(db.doc(table + '/' + row.id), { ...row, owner_id: uid }));
      }
      for (const id of before.keys())
        if (!ids.has(id)) writes.push(() => tx.delete(db.doc(table + '/' + id)));
    }
    if (writes.length > 450)
      throw new HttpsError(
        'resource-exhausted',
        'This operation is too large. Use smaller batches (up to 200 groups).',
      );
    writes.forEach((write) => write());
    tx.set(lockRef, { updated_at: now(), rate }, { merge: true });
    return result;
  });
}
function failure(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof z.ZodError)
    throw new HttpsError('invalid-argument', error.issues.map((i) => i.message).join('; '));
  if (error instanceof Error && !('code' in error))
    throw new HttpsError('failed-precondition', error.message);
  logger.error('Firebase operation failed', error);
  throw new HttpsError('internal', 'The operation could not be completed. Please retry.');
}
async function deleteAccount(uid: string) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc('workspace_locks/' + uid);
    await tx.get(ref);
    tx.set(ref, { deleting: true, updated_at: now() }, { merge: true });
  });
  // Retain the tombstone until a trusted operator removes it, preventing in-flight writes.
  await getAuth().updateUser(uid, { disabled: true });
  await getAuth().revokeRefreshTokens(uid);
  for (const table of tables) {
    let page;
    do {
      page = await db.collection(table).where('owner_id', '==', uid).limit(400).get();
      if (page.empty) break;
      const batch = db.batch();
      page.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } while (!page.empty);
  }
  await db.doc('profiles/' + uid).delete();
  await getAuth().deleteUser(uid);
}
export const manage = onCall({ timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue');
  if (request.auth.token.email_verified !== true)
    throw new HttpsError('permission-denied', 'Verify your email before continuing');
  try {
    const uid = request.auth.uid;
    const body = z.record(z.string(), z.unknown()).parse(request.data);
    if (Buffer.byteLength(JSON.stringify(body)) > 1100000)
      throw new HttpsError('invalid-argument', 'Request too large');
    if (body.action === 'account.delete') {
      if (body.confirmation !== 'DELETE')
        throw new HttpsError('invalid-argument', 'Type DELETE to confirm');
      if (Date.now() / 1000 - Number(request.auth.token.auth_time) > 300)
        throw new HttpsError(
          'failed-precondition',
          'Sign out and sign in again before deleting your account',
        );
      await deleteAccount(uid);
      return { ok: true };
    }
    const token = body.action === 'push.register' ? z.string().parse(body.token) : undefined;
    return await workspace(
      uid,
      (w) => {
        const result = apply(w, body, projectId);
        if (token) {
          const row = w.push_tokens.find((t) => t.token === token)!;
          row.id = hash(token);
        }
        return result;
      },
      true,
      token,
    );
  } catch (error) {
    return failure(error);
  }
});

export const n8nWebhook = onRequest({ timeoutSeconds: 120 }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const raw = req.rawBody.toString('utf8');
  if (req.rawBody.length > 64000) {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }
  const id = req.get('x-integration-id') ?? '';
  const timestamp = req.get('x-webhook-timestamp') ?? '';
  const signature = req.get('x-webhook-signature') ?? '';
  if (!z.string().uuid().safeParse(id).success) {
    res.status(401).json({ error: 'Invalid webhook authentication' });
    return;
  }
  try {
    const snapshot = await db.doc('integrations/' + id).get();
    const integration = snapshot.data();
    if (!integration?.enabled || !verifySignature(integration.secret, timestamp, signature, raw)) {
      res.status(401).json({ error: 'Invalid webhook authentication' });
      return;
    }
    const payload = webhookSchema.parse(JSON.parse(raw));
    payload.post_url = facebookUrl(payload.post_url);
    if (payload.image_url && new URL(payload.image_url).protocol !== 'https:')
      throw new Error('Media must use HTTPS');
    const result = await workspace(
      integration.owner_id,
      (w) => {
        const current = w.integrations.find((i) => i.id === id);
        if (!current?.enabled || !verifySignature(current.secret, timestamp, signature, raw))
          throw new HttpsError('unauthenticated', 'Invalid webhook authentication');
        return ingest(w, id, raw, payload);
      },
      true,
    );
    res.json(result);
  } catch (error) {
    if (error instanceof HttpsError) {
      res
        .status(
          error.code === 'resource-exhausted' ? 429 : error.code === 'unauthenticated' ? 401 : 400,
        )
        .json({ error: error.message });
    } else if (
      error instanceof z.ZodError ||
      error instanceof SyntaxError ||
      (error instanceof Error && !('code' in error))
    ) {
      res.status(400).json({
        error: error instanceof z.ZodError ? 'Invalid event payload' : (error as Error).message,
      });
    } else {
      logger.error('Webhook failed', error);
      res.status(500).json({ error: 'Import unavailable. Retry later.' });
    }
  }
});

async function deliverNotification(ref: FirebaseFirestore.DocumentReference) {
  const claimed = await db.runTransaction(async (tx: Transaction) => {
    const snapshot = await tx.get(ref);
    const n = snapshot.data();
    if (
      !n ||
      n.sent_at ||
      n.attempts >= 8 ||
      Date.parse(n.next_attempt_at ?? '') > Date.now() ||
      Date.parse(n.lease_expires_at ?? '') > Date.now()
    )
      return null;
    const lease = new Date(Date.now() + 5 * 60000).toISOString();
    tx.update(ref, { attempts: n.attempts + 1, lease_expires_at: lease, next_attempt_at: lease });
    return { ...n, id: ref.id, attempts: n.attempts + 1, lease_expires_at: lease } as Row;
  });
  if (!claimed) return;
  try {
    const profile = await db.doc('profiles/' + claimed.owner_id).get();
    const tokens = profile.data()?.notifications_enabled
      ? await db.collection('push_tokens').where('owner_id', '==', claimed.owner_id).get()
      : null;
    const docs = tokens?.docs ?? [];
    for (let offset = 0; offset < docs.length; offset += 100) {
      const chunk = docs.slice(offset, offset + 100);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          chunk.map((t) => ({
            to: t.data().token,
            title: claimed.title,
            body: claimed.body,
            data: { route: claimed.route },
            channelId: 'sharing',
            sound: 'default',
          })),
        ),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Push unavailable');
      const result = (await response.json()) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      if (!Array.isArray(result.data) || result.data.length !== chunk.length)
        throw new Error('Invalid push response');
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i];
        if (ticket.status !== 'error') continue;
        if (ticket.details?.error === 'DeviceNotRegistered') await chunk[i].ref.delete();
        else throw new Error('Push temporarily rejected');
      }
    }
    await finishNotification(ref, claimed, true);
  } catch {
    await finishNotification(ref, claimed, false);
  }
}
async function finishNotification(
  ref: FirebaseFirestore.DocumentReference,
  claimed: Row,
  sent: boolean,
) {
  await db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists || current.data()?.lease_expires_at !== claimed.lease_expires_at) return;
    tx.update(ref, {
      sent_at: sent ? now() : null,
      lease_expires_at: null,
      next_attempt_at:
        sent || claimed.attempts >= 8
          ? null
          : new Date(Date.now() + Math.min(3600000, 60000 * 2 ** claimed.attempts)).toISOString(),
    });
  });
}
export const scheduler = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 540, maxInstances: 1 },
  async () => {
    const due = await db.collection('sharing_tasks').where('status', '==', 'scheduled').get();
    const owners = new Set(
      due.docs
        .filter((d) => !d.data().paused && Date.parse(d.data().scheduled_at) <= Date.now())
        .map((d) => d.data().owner_id as string),
    );
    for (const uid of owners) {
      try {
        await workspace(uid, advance);
      } catch (error) {
        logger.error('Schedule advancement failed', { uid, error });
      }
    }
    const notifications = await db
      .collection('notifications')
      .where('next_attempt_at', '<=', now())
      .limit(100)
      .get();
    for (const n of notifications.docs) await deliverNotification(n.ref);
  },
);
