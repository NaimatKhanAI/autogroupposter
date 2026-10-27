import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { type Auth } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';
import { groupSchema, postSchema, statuses, canTransition, type TaskStatus } from './domain';

export const freeCollections = [
  'connected_pages',
  'facebook_groups',
  'imported_posts',
  'sharing_tasks',
  'sharing_attempts',
  'audit_logs',
  'notifications',
  'extension_devices',
] as const;
const hash = (value: string) => bytesToHex(sha256(new TextEncoder().encode(value)));
export function recordKey(owner: string, kind: string, value: string) {
  return hash(`${owner}:${kind}:${value}`);
}
export function normalize(value: unknown): any {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, normalize(v)]));
  return value;
}
const profileSchema = z.object({
  display_name: z.string().trim().max(120),
  timezone: z.string().max(100),
  appearance: z.enum(['system', 'light', 'dark']),
  notifications_enabled: z.literal(false).optional(),
  posting_window_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  posting_window_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
const idSchema = z.string().regex(/^[a-f0-9]{64}$/);
function future(value: unknown) {
  const time = z.string().datetime({ offset: true }).parse(value);
  if (Date.parse(time) <= Date.now()) throw new Error('Choose a reminder time in the future.');
  return Timestamp.fromDate(new Date(time));
}
export function createFreeBackend(db: Firestore, auth: Auth, requestDeletion?:()=>Promise<unknown>) {
  const user = () => {
    const u = auth.currentUser;
    if (!u || !u.emailVerified) throw new Error('Verify your email and sign in to continue.');
    return u;
  };
  const uid = () => user().uid;
  const ref = (table: string, id: string) => doc(db, table, id);
  async function rows(table: string): Promise<(Record<string, any> & { id: string })[]> {
    const snapshot = await getDocs(query(collection(db, table), where('owner_id', '==', uid())));
    return snapshot.docs
      .map((d) => ({ ...normalize(d.data()), id: d.id }))
      .sort((a: any, b: any) =>
        String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
      );
  }
  const owned = (snapshot: { exists(): boolean; data(): DocumentData | undefined }) => {
    if (!snapshot.exists() || snapshot.data()?.owner_id !== uid())
      throw new Error('This record was not found in your workspace.');
    return snapshot.data()!;
  };
  async function ensureProfile() {
    const u = user();
    const p = await runTransaction(db, async (tx) => {
      const [existing, lock] = await Promise.all([
        tx.get(ref('profiles', u.uid)),
        tx.get(ref('workspace_locks', u.uid)),
      ]);
      if (lock.data()?.deleting)
        throw new Error(
          'Account deletion is in progress. Finish deleting your account to continue.',
        );
      if (existing.exists()) return existing.data();
      const value = {
        id: u.uid,
        display_name: u.displayName ?? '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        appearance: 'system',
        notifications_enabled: false,
        posting_window_start: '09:00',
        posting_window_end: '18:00',
        default_page_id: null,
        created_at: serverTimestamp(),
      };
      tx.set(ref('profiles', u.uid), value);
      return value;
    });
    return normalize(p);
  }
  async function log(action: string, detail = '') {
    const logRef = doc(collection(db, 'audit_logs'));
    const batch = writeBatch(db);
    batch.set(logRef, {
      id: logRef.id,
      owner_id: uid(),
      event_type: action,
      source: 'mobile',
      status: 'success',
      detail,
      created_at: serverTimestamp(),
    });
    // Logging is supplementary; a successful business write must not be reported as failed.
    await batch.commit().catch(() => {});
  }
  async function saveGroup(values: unknown, existingId?: string) {
    const v = groupSchema.parse(values);
    const id = recordKey(uid(), 'group', v.url);
    if (existingId && existingId !== id)
      throw new Error('A group address cannot be changed. Add the new group separately.');
    const groupRef = ref('facebook_groups', id);
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(groupRef);
      if (existing.exists()) owned(existing);
      if (v.page_id) owned(await tx.get(ref('connected_pages', v.page_id)));
      if (!existingId && existing.exists())
        throw new Error('This group is already in your workspace.');
      tx.set(groupRef, {
        ...v,
        id,
        owner_id: uid(),
        last_shared_at: existing.data()?.last_shared_at ?? null,
        created_at: existing.data()?.created_at ?? serverTimestamp(),
      });
    });
    return { ...v, id };
  }
  async function bulkUpdate(
    table: string,
    data: Record<string, any>[],
    update: Record<string, unknown>,
  ) {
    for (let i = 0; i < data.length; i += 10) {
      const batch = writeBatch(db);
      for (const row of data.slice(i, i + 10)) batch.update(ref(table, row.id), update);
      await batch.commit();
    }
  }
  async function removeRows(table: string, data: { id: string }[]) {
    for (let i = 0; i < data.length; i += 100) {
      const batch = writeBatch(db);
      data.slice(i, i + 100).forEach((d) => batch.delete(ref(table, d.id)));
      await batch.commit();
    }
  }
  async function analytics() {
    const [posts, groups, pages, tasks, logs] = await Promise.all([
      rows('imported_posts'),
      rows('facebook_groups'),
      rows('connected_pages'),
      rows('sharing_tasks'),
      rows('audit_logs'),
    ]);
    const confirmed = tasks.filter((t) => t.status === 'confirmed_shared');
    const recent = logs.filter((l) => Date.parse(l.created_at) >= Date.now() - 30 * 86400000);
    const days = new Map<string, number>();
    recent.forEach((l) => {
      const day = l.created_at.slice(0, 10);
      days.set(day, (days.get(day) ?? 0) + 1);
    });
    return {
      posts: posts.length,
      groups: groups.length,
      pages: pages.length,
      tasks: tasks.length,
      confirmed: confirmed.length,
      pending: tasks.filter((t) =>
        ['pending', 'scheduled', 'ready_for_user', 'awaiting_confirmation'].includes(t.status),
      ).length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      week: recent.filter((l) => Date.parse(l.created_at) >= Date.now() - 7 * 86400000).length,
      month: recent.length,
      daily: [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, total]) => ({ day, total })),
      per_group: groups.map((g) => ({
        name: g.name,
        tasks: tasks.filter((t) => t.group_id === g.id).length,
        confirmed: confirmed.filter((t) => t.group_id === g.id).length,
      })),
      per_page: pages.map((p) => ({
        name: p.name,
        posts: posts.filter((i) => i.page_id === p.id).length,
      })),
    };
  }
  async function operation(action: string, body: Record<string, any> = {}): Promise<any> {
    const owner = uid();
    let result: any = { ok: true };
    switch (action) {
      case 'profile.ensure':
        return ensureProfile();
      case 'profile.update': {
        const values = profileSchema.parse(body.values);
        new Intl.DateTimeFormat('en', { timeZone: values.timezone });
        const batch = writeBatch(db);
        batch.update(ref('profiles', owner), values);
        await batch.commit();
        return result;
      }
      case 'analytics':
        return analytics();
      case 'integration.status':
        return [];
      case 'integration.rotate':
      case 'push.register':
        throw new Error(
          'Automated imports and push notifications are not available in this version.',
        );
      case 'push.remove':
        return { ok: true };
      case 'group.save':
        result = await saveGroup(body.values, body.id);
        break;
      case 'group.import': {
        const values = z.array(groupSchema).max(500).parse(body.rows);
        let count = 0;
        try {
          for (const v of values) {
            const id = recordKey(owner, 'group', v.url);
            await saveGroup(
              v,
              (await getDoc(ref('facebook_groups', id))).exists() ? id : undefined,
            );
            count++;
          }
        } catch (e) {
          throw new Error(
            `${count} groups were imported before an error. You can safely retry the same file. ${e instanceof Error ? e.message : ''}`,
          );
        }
        result = { imported: count };
        break;
      }
      case 'group.bulk': {
        const ids = z.array(idSchema).max(500).parse(body.ids);
        const enabled = z.boolean().parse(body.enabled);
        await bulkUpdate(
          'facebook_groups',
          ids.map((id) => ({ id })),
          { enabled },
        );
        break;
      }
      case 'group.delete': {
        const id = idSchema.parse(body.id);
        owned(await getDoc(ref('facebook_groups', id)));
        const disable = writeBatch(db);
        disable.update(ref('facebook_groups', id), { enabled: false });
        await disable.commit();
        const tasks = (await rows('sharing_tasks')).filter((t) => t.group_id === id);
        const taskIds = new Set(tasks.map((t) => t.id));
        await removeRows(
          'sharing_attempts',
          (await rows('sharing_attempts')).filter((t) => taskIds.has(t.task_id)),
        );
        await removeRows('sharing_tasks', tasks);
        await removeRows('facebook_groups', [{ id }]);
        break;
      }
      case 'page.add': {
        const values = z
          .object({
            name: z.string().trim().min(2).max(120),
            facebook_page_id: z.string().regex(/^\d{1,30}$/),
          })
          .parse(body.values);
        const id = recordKey(owner, 'page', values.facebook_page_id);
        await runTransaction(db, async (tx) => {
          const existing = await tx.get(ref('connected_pages', id));
          if (existing.exists()) throw new Error('This Page is already configured.');
          tx.set(ref('connected_pages', id), {
            ...values,
            id,
            owner_id: owner,
            is_default: false,
            connection_status: 'manual',
            created_at: serverTimestamp(),
          });
        });
        result = { ...values, id };
        break;
      }
      case 'page.default': {
        const id = idSchema.parse(body.id);
        await runTransaction(db, async (tx) => {
          const [page, profile] = await Promise.all([
            tx.get(ref('connected_pages', id)),
            tx.get(ref('profiles', owner)),
          ]);
          owned(page);
          const previous = profile.data()?.default_page_id;
          const old =
            previous && previous !== id ? await tx.get(ref('connected_pages', previous)) : null;
          if (old?.exists()) tx.update(old.ref, { is_default: false });
          tx.update(page.ref, { is_default: true });
          tx.update(ref('profiles', owner), { default_page_id: id });
        });
        break;
      }
      case 'page.disconnect': {
        const batch = writeBatch(db);
        batch.update(ref('connected_pages', idSchema.parse(body.id)), {
          connection_status: 'manual',
        });
        await batch.commit();
        break;
      }
      case 'post.import': {
        const values = postSchema.parse(body.values);
        const id = recordKey(owner, 'post', values.post_url);
        await runTransaction(db, async (tx) => {
          const [existing, page] = await Promise.all([
            tx.get(ref('imported_posts', id)),
            tx.get(ref('connected_pages', values.page_id)),
          ]);
          owned(page);
          if (existing.exists()) throw new Error('This post is already imported.');
          tx.set(ref('imported_posts', id), {
            ...values,
            id,
            owner_id: owner,
            facebook_post_id: null,
            image_url: null,
            published_at: serverTimestamp(),
            created_at: serverTimestamp(),
          });
        });
        result = { ...values, id };
        break;
      }
      case 'queue.add': {
        const postId = idSchema.parse(body.post_id),
          ids = [...new Set(z.array(idSchema).min(1).max(500).parse(body.group_ids))];
        const scheduled = body.scheduled_at ? future(body.scheduled_at) : null;
        let count = 0;
        for (const groupId of ids) {
          const id = recordKey(owner, 'task', postId + ':' + groupId);
          await runTransaction(db, async (tx) => {
            const [post, group, existing] = await Promise.all([
              tx.get(ref('imported_posts', postId)),
              tx.get(ref('facebook_groups', groupId)),
              tx.get(ref('sharing_tasks', id)),
            ]);
            owned(post);
            const g = owned(group);
            if (!g.enabled) throw new Error('Select enabled groups from your workspace.');
            if (existing.exists()) return;
            tx.set(ref('sharing_tasks', id), {
              id,
              owner_id: owner,
              post_id: postId,
              group_id: groupId,
              status: scheduled ? 'scheduled' : 'ready_for_user',
              scheduled_at: scheduled,
              paused: false,
              attempt_count: 0,
              last_error: null,
              confirmation_source: null,
              confirmation_note: null,
              confirmed_at: null,
              version: 0,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
            });
          });
          count++;
        }
        result = { queued: count };
        break;
      }
      case 'task.transition': {
        const id = idSchema.parse(body.id),
          status = z.enum(statuses).parse(body.status),
          note = z
            .string()
            .max(1000)
            .nullable()
            .parse(body.note ?? null);
        await runTransaction(db, async (tx) => {
          const snapshot = await tx.get(ref('sharing_tasks', id)),
            task = owned(snapshot);
          if (!canTransition(task.status as TaskStatus, status))
            throw new Error('This task changed. Refresh and try again.');
          if (status === 'confirmed_shared' && (!note || note.trim().length < 3))
            throw new Error('Confirm that you completed sharing this post.');
          const group =
            status === 'confirmed_shared'
              ? await tx.get(ref('facebook_groups', task.group_id))
              : null;
          if (group) owned(group);
          tx.update(snapshot.ref, {
            status,
            scheduled_at: status === 'scheduled' ? future(body.scheduled_at) : task.scheduled_at,
            attempt_count: task.attempt_count + (status === 'awaiting_confirmation' ? 1 : 0),
            last_error: status === 'failed' ? note : null,
            confirmation_source: status === 'confirmed_shared' ? 'user_attestation' : null,
            confirmation_note: status === 'confirmed_shared' ? note : null,
            confirmed_at: status === 'confirmed_shared' ? serverTimestamp() : null,
            version: task.version + 1,
            updated_at: serverTimestamp(),
          });
          if (group) tx.update(group.ref, { last_shared_at: serverTimestamp() });
          const attempt = doc(collection(db, 'sharing_attempts'));
          tx.set(attempt, {
            id: attempt.id,
            owner_id: owner,
            task_id: id,
            source: 'mobile',
            result: status,
            created_at: serverTimestamp(),
          });
        });
        break;
      }
      case 'queue.pause': {
        const paused = z.boolean().parse(body.paused),
          tasks = (await rows('sharing_tasks')).filter((t) =>
            ['pending', 'scheduled', 'ready_for_user'].includes(t.status),
          );
        // Read each version inside a transaction to avoid overwriting a simultaneous transition.
        for (const task of tasks)
          await runTransaction(db, async (tx) => {
            const s = await tx.get(ref('sharing_tasks', task.id)),
              v = owned(s);
            if (['pending', 'scheduled', 'ready_for_user'].includes(v.status))
              tx.update(s.ref, { paused, version: v.version + 1, updated_at: serverTimestamp() });
          });
        break;
      }
      case 'schedule.advance': {
        const due = (await rows('sharing_tasks')).filter(
          (t) => t.status === 'scheduled' && !t.paused && Date.parse(t.scheduled_at) <= Date.now(),
        );
        for (const task of due)
          await runTransaction(db, async (tx) => {
            const s = await tx.get(ref('sharing_tasks', task.id)),
              v = owned(s);
            if (v.status === 'scheduled' && !v.paused && v.scheduled_at.toMillis() <= Date.now())
              tx.update(s.ref, {
                status: 'ready_for_user',
                version: v.version + 1,
                updated_at: serverTimestamp(),
              });
          });
        return { advanced: due.length };
      }
      case 'device.revoke': {
        const batch = writeBatch(db);
        batch.update(ref('extension_devices', idSchema.parse(body.id)), {
          revoked_at: serverTimestamp(),
        });
        await batch.commit();
        break;
      }
      case 'account.delete': {
        if (body.confirmation !== 'DELETE') throw new Error('Type DELETE to confirm.');
        user();
        if(!requestDeletion)throw new Error('Secure account deletion service is required. No account data was deleted.');
        await requestDeletion();
        return {ok:true,pending:true};
      }
      default:
        throw new Error('This feature is not available in this version.');
    }
    await log(action);
    return result;
  }
  return { operation, rows, ensureProfile };
}
