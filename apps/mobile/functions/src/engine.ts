import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { groupSchema, postSchema, statuses, canTransition, type TaskStatus } from './domain';

export const tables = [
  'connected_pages',
  'facebook_groups',
  'imported_posts',
  'sharing_tasks',
  'sharing_attempts',
  'extension_devices',
  'integrations',
  'integration_events',
  'push_tokens',
  'notifications',
  'audit_logs',
] as const;
export type Table = (typeof tables)[number];
export type Row = Record<string, any> & { id: string };
export type Workspace = Record<Table, Row[]> & { profile: Row };
export const idSchema = z.string().uuid();
export const now = () => new Date().toISOString();
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const defaultProfile = (uid: string): Row => ({
  id: uid,
  display_name: '',
  timezone: 'UTC',
  appearance: 'system',
  notifications_enabled: true,
  posting_window_start: '09:00',
  posting_window_end: '18:00',
  created_at: now(),
});
export function verifySignature(
  secret: string,
  timestamp: string,
  signature: string,
  raw: string,
  time = Date.now(),
) {
  if (
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(time / 1000 - Number(timestamp)) > 300 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac('sha256', secret)
    .update(timestamp + '.' + raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export function owned(w: Workspace, table: Table, id: unknown) {
  const row = w[table].find((r) => r.id === idSchema.parse(id));
  if (!row) throw new Error('Record not found in your workspace');
  return row;
}
function add(w: Workspace, table: Table, data: Record<string, unknown>) {
  const row = { id: randomUUID(), created_at: now(), ...data } as Row;
  w[table].push(row);
  return row;
}
export function notify(w: Workspace, title: string, body: string, route = '/queue') {
  return add(w, 'notifications', {
    title,
    body,
    route,
    sent_at: null,
    attempts: 0,
    next_attempt_at: now(),
    lease_expires_at: null,
  });
}
function audit(w: Workspace, action: string, extra: Record<string, unknown> = {}) {
  add(w, 'audit_logs', { event_type: action, status: 'success', source: 'mobile', ...extra });
}
function schedule(value: unknown) {
  const date = z.string().datetime({ offset: true }).parse(value);
  if (Date.parse(date) <= Date.now()) throw new Error('Schedule must be in the future');
  return date;
}
export function enqueue(w: Workspace, post: Row, groups: Row[], when: string | null) {
  return groups.flatMap((g) => {
    if (w.sharing_tasks.some((t) => t.post_id === post.id && t.group_id === g.id)) return [];
    return [
      add(w, 'sharing_tasks', {
        post_id: post.id,
        group_id: g.id,
        status: when ? 'scheduled' : 'ready_for_user',
        scheduled_at: when,
        paused: false,
        attempt_count: 0,
        last_error: null,
        confirmation_source: null,
        confirmation_note: null,
        confirmed_at: null,
        claimed_by: null,
        claim_expires_at: null,
        version: 0,
        updated_at: now(),
      }),
    ];
  });
}
export function analytics(w: Workspace) {
  const confirmed = w.sharing_tasks.filter((t) => t.status === 'confirmed_shared');
  const recent = w.audit_logs.filter((l) => Date.parse(l.created_at) >= Date.now() - 30 * 86400000);
  const days = new Map<string, number>();
  for (const l of recent) {
    const day = l.created_at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  return {
    posts: w.imported_posts.length,
    groups: w.facebook_groups.length,
    pages: w.connected_pages.length,
    tasks: w.sharing_tasks.length,
    confirmed: confirmed.length,
    pending: w.sharing_tasks.filter((t) =>
      ['pending', 'scheduled', 'ready_for_user', 'awaiting_confirmation'].includes(t.status),
    ).length,
    failed: w.sharing_tasks.filter((t) => t.status === 'failed').length,
    week: recent.filter((l) => Date.parse(l.created_at) >= Date.now() - 7 * 86400000).length,
    month: recent.length,
    daily: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, total]) => ({ day, total })),
    per_group: w.facebook_groups.map((g) => ({
      name: g.name,
      tasks: w.sharing_tasks.filter((t) => t.group_id === g.id).length,
      confirmed: confirmed.filter((t) => t.group_id === g.id).length,
    })),
    per_page: w.connected_pages.map((p) => ({
      name: p.name,
      posts: w.imported_posts.filter((i) => i.page_id === p.id).length,
    })),
  };
}
const profileSchema = z.object({
  display_name: z.string().max(120),
  timezone: z.string().max(100),
  appearance: z.enum(['system', 'light', 'dark']),
  notifications_enabled: z.boolean().optional(),
  posting_window_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  posting_window_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export function apply(w: Workspace, body: Record<string, any>, projectId: string): any {
  let result: any = { ok: true };
  switch (body.action) {
    case 'profile.ensure':
      if (!w.profile.display_name && body.display_name)
        w.profile.display_name = z.string().trim().max(120).parse(body.display_name);
      return w.profile;
    case 'profile.update': {
      const v = profileSchema.parse(body.values);
      new Intl.DateTimeFormat('en', { timeZone: v.timezone });
      Object.assign(w.profile, v);
      break;
    }
    case 'analytics':
      return analytics(w);
    case 'group.save': {
      const v = groupSchema.parse(body.values);
      if (v.page_id) owned(w, 'connected_pages', v.page_id);
      if (w.facebook_groups.some((g) => g.url === v.url && g.id !== body.id))
        throw new Error('Group already exists');
      result = body.id
        ? Object.assign(owned(w, 'facebook_groups', body.id), v)
        : add(w, 'facebook_groups', { ...v, last_shared_at: null });
      break;
    }
    case 'group.delete': {
      const g = owned(w, 'facebook_groups', body.id);
      const removed = new Set(w.sharing_tasks.filter((t) => t.group_id === g.id).map((t) => t.id));
      w.facebook_groups = w.facebook_groups.filter((r) => r.id !== g.id);
      w.sharing_tasks = w.sharing_tasks.filter((t) => !removed.has(t.id));
      w.sharing_attempts = w.sharing_attempts.filter((t) => !removed.has(t.task_id));
      break;
    }
    case 'group.bulk': {
      const ids = z.array(idSchema).min(1).max(500).parse(body.ids);
      const enabled = z.boolean().parse(body.enabled);
      ids.forEach((id) => {
        owned(w, 'facebook_groups', id).enabled = enabled;
      });
      break;
    }
    case 'group.import': {
      const rows = z.array(groupSchema).max(500).parse(body.rows);
      result = rows.map((v) => {
        if (v.page_id) owned(w, 'connected_pages', v.page_id);
        const existing = w.facebook_groups.find((g) => g.url === v.url);
        return existing
          ? Object.assign(existing, v)
          : add(w, 'facebook_groups', { ...v, last_shared_at: null });
      });
      break;
    }
    case 'page.add': {
      const v = z
        .object({
          name: z.string().trim().min(2).max(120),
          facebook_page_id: z.string().regex(/^\d{1,30}$/),
        })
        .parse(body.values);
      if (w.connected_pages.some((p) => p.facebook_page_id === v.facebook_page_id))
        throw new Error('Page already exists');
      result = add(w, 'connected_pages', { ...v, is_default: false, connection_status: 'manual' });
      break;
    }
    case 'page.default': {
      const p = owned(w, 'connected_pages', body.id);
      w.connected_pages.forEach((row) => {
        row.is_default = row.id === p.id;
      });
      break;
    }
    case 'page.disconnect':
      owned(w, 'connected_pages', body.id).connection_status = 'manual';
      w.integrations.forEach((i) => {
        i.enabled = false;
      });
      break;
    case 'post.import': {
      const v = postSchema.parse(body.values);
      owned(w, 'connected_pages', v.page_id);
      if (w.imported_posts.some((p) => p.post_url === v.post_url))
        throw new Error('Post already imported');
      result = add(w, 'imported_posts', {
        ...v,
        image_url: null,
        facebook_post_id: null,
        published_at: now(),
      });
      break;
    }
    case 'queue.add': {
      const p = owned(w, 'imported_posts', body.post_id);
      const ids = z.array(idSchema).min(1).max(500).parse(body.group_ids);
      const groups = [...new Set(ids)].map((id) => owned(w, 'facebook_groups', id));
      if (groups.some((g) => !g.enabled)) throw new Error('Select enabled groups');
      result = enqueue(w, p, groups, body.scheduled_at ? schedule(body.scheduled_at) : null);
      break;
    }
    case 'task.transition': {
      const t = owned(w, 'sharing_tasks', body.id);
      const status = z.enum(statuses).parse(body.status);
      const note = z
        .string()
        .max(1000)
        .nullable()
        .parse(body.note ?? null);
      if (Date.parse(t.claim_expires_at ?? '') > Date.now())
        throw new Error('Task is claimed by a device');
      if (!canTransition(t.status as TaskStatus, status))
        throw new Error('Invalid task transition');
      if (status === 'confirmed_shared' && (!note || note.trim().length < 3))
        throw new Error('Confirmation requires your attestation');
      if (status === 'scheduled') t.scheduled_at = schedule(body.scheduled_at);
      Object.assign(t, {
        status,
        attempt_count: t.attempt_count + (status === 'awaiting_confirmation' ? 1 : 0),
        last_error: status === 'failed' ? note : null,
        confirmation_source: status === 'confirmed_shared' ? 'user_attestation' : null,
        confirmation_note: status === 'confirmed_shared' ? note : null,
        confirmed_at: status === 'confirmed_shared' ? now() : null,
        version: t.version + 1,
        updated_at: now(),
      });
      if (status === 'confirmed_shared')
        owned(w, 'facebook_groups', t.group_id).last_shared_at = now();
      add(w, 'sharing_attempts', { task_id: t.id, source: 'mobile', result: status });
      if (['failed', 'confirmed_shared'].includes(status))
        notify(
          w,
          status === 'failed' ? 'Sharing task needs attention' : 'Share confirmed by you',
          'Review your sharing queue.',
        );
      result = t;
      break;
    }
    case 'queue.pause': {
      const paused = z.boolean().parse(body.paused);
      w.sharing_tasks
        .filter((t) => ['pending', 'scheduled', 'ready_for_user'].includes(t.status))
        .forEach((t) => {
          t.paused = paused;
        });
      break;
    }
    case 'integration.status':
      return w.integrations.map(({ id, name, enabled, last_event_at, created_at }) => ({
        id,
        name,
        enabled,
        last_event_at,
        created_at,
      }));
    case 'integration.rotate': {
      w.integrations.forEach((i) => {
        i.enabled = false;
      });
      const secret = randomBytes(32).toString('hex');
      const row = add(w, 'integrations', {
        secret,
        enabled: true,
        name: 'n8n',
        last_event_at: null,
      });
      result = {
        id: row.id,
        secret,
        url: 'https://us-central1-' + projectId + '.cloudfunctions.net/n8nWebhook',
      };
      break;
    }
    case 'device.revoke':
      owned(w, 'extension_devices', body.id).revoked_at = now();
      break;
    case 'push.register': {
      const token = z
        .string()
        .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
        .parse(body.token);
      if (!w.push_tokens.some((t) => t.token === token)) add(w, 'push_tokens', { token });
      break;
    }
    case 'push.remove':
      w.push_tokens = w.push_tokens.filter((t) => t.token !== z.string().parse(body.token));
      break;
    default:
      throw new Error('Unknown action');
  }
  audit(w, body.action);
  return result;
}
export function advance(w: Workspace) {
  let count = 0;
  for (const t of w.sharing_tasks) {
    if (t.status !== 'scheduled' || t.paused || Date.parse(t.scheduled_at) > Date.now()) continue;
    Object.assign(t, { status: 'ready_for_user', updated_at: now(), version: t.version + 1 });
    notify(w, 'Sharing reminder', 'A scheduled task is ready for your action.');
    audit(w, 'task.ready', { source: 'scheduler', post_id: t.post_id, group_id: t.group_id });
    count++;
    if (count >= 100) break;
  }
  return count;
}
export function ingest(
  w: Workspace,
  integrationId: string,
  raw: string,
  payload: Record<string, any>,
) {
  const integration = owned(w, 'integrations', integrationId);
  if (!integration.enabled) throw new Error('Integration unavailable');
  const previous = w.integration_events.find(
    (e) => e.integration_id === integrationId && e.event_id === payload.event_id,
  );
  const payloadHash = hash(raw);
  if (previous) {
    if (previous.payload_hash !== payloadHash)
      throw new Error('Event ID reused with different payload');
    return { duplicate: true };
  }
  const page = w.connected_pages.find((p) => p.facebook_page_id === payload.page_id);
  if (!page) throw new Error('Page is not configured for this integration');
  let post = w.imported_posts.find((p) => p.post_url === payload.post_url);
  if (!post)
    post = add(w, 'imported_posts', {
      page_id: page.id,
      facebook_post_id: payload.post_id,
      post_url: payload.post_url,
      caption: payload.caption,
      image_url: payload.image_url ?? null,
      media_type: payload.media_type,
      published_at: payload.published_at,
    });
  add(w, 'integration_events', {
    integration_id: integrationId,
    event_id: payload.event_id,
    payload_hash: payloadHash,
  });
  enqueue(
    w,
    post,
    w.facebook_groups.filter((g) => g.enabled && (!g.page_id || g.page_id === page.id)),
    null,
  );
  integration.last_event_at = now();
  page.connection_status = 'n8n';
  audit(w, 'post.imported', { source: 'n8n', post_id: post.id });
  notify(w, 'New Page post', 'Review your sharing tasks.', '/post/' + post.id);
  return { post_id: post.id, duplicate: false };
}
