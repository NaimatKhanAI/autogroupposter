import { createHmac, randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  apply,
  advance,
  ingest,
  defaultProfile,
  tables,
  verifySignature,
  type Workspace,
} from '../functions/src/engine';
const page = randomUUID();
const group = randomUUID();
const post = randomUUID();
function fixture(): Workspace {
  const w = Object.fromEntries(tables.map((t) => [t, []])) as unknown as Workspace;
  w.profile = defaultProfile('owner-a');
  w.connected_pages.push({ id: page, name: 'Page', facebook_page_id: '123', is_default: false });
  w.facebook_groups.push({
    id: group,
    name: 'Group',
    enabled: true,
    page_id: null,
    url: 'https://www.facebook.com/groups/example',
  });
  w.imported_posts.push({ id: post, page_id: page, post_url: 'https://www.facebook.com/posts/1' });
  return w;
}
const run = (w: Workspace, action: string, payload = {}) =>
  apply(w, { action, ...payload }, 'test-project');
describe('Firebase workspace business rules', () => {
  it('checks ownership for referenced groups, Pages and posts', () => {
    const w = fixture();
    expect(() => run(w, 'queue.add', { post_id: randomUUID(), group_ids: [group] })).toThrow(
      'workspace',
    );
    expect(() =>
      run(w, 'group.save', {
        values: {
          name: 'New group',
          url: 'https://www.facebook.com/groups/new',
          page_id: randomUUID(),
        },
      }),
    ).toThrow('workspace');
    expect(() => run(w, 'group.bulk', { ids: [randomUUID()], enabled: false })).toThrow(
      'workspace',
    );
  });
  it('deduplicates queue entries and rejects disabled groups', () => {
    const w = fixture();
    run(w, 'queue.add', { post_id: post, group_ids: [group, group] });
    run(w, 'queue.add', { post_id: post, group_ids: [group] });
    expect(w.sharing_tasks).toHaveLength(1);
    w.facebook_groups[0]!.enabled = false;
    expect(() => run(w, 'queue.add', { post_id: post, group_ids: [group] })).toThrow('enabled');
  });
  it('requires the sharing flow and explicit attestation for confirmation', () => {
    const w = fixture();
    run(w, 'queue.add', { post_id: post, group_ids: [group] });
    const id = w.sharing_tasks[0]!.id;
    expect(() =>
      run(w, 'task.transition', { id, status: 'confirmed_shared', note: 'Done' }),
    ).toThrow('transition');
    run(w, 'task.transition', { id, status: 'awaiting_confirmation' });
    expect(() => run(w, 'task.transition', { id, status: 'confirmed_shared' })).toThrow(
      'attestation',
    );
    run(w, 'task.transition', { id, status: 'confirmed_shared', note: 'Shared by me' });
    expect(w.sharing_tasks[0]).toMatchObject({
      confirmation_source: 'user_attestation',
      attempt_count: 1,
      version: 2,
    });
    expect(w.facebook_groups[0]!.last_shared_at).toBeTruthy();
  });
  it('promotes due tasks once, preserves paused and future tasks', () => {
    const w = fixture();
    run(w, 'queue.add', {
      post_id: post,
      group_ids: [group],
      scheduled_at: new Date(Date.now() + 60000).toISOString(),
    });
    expect(advance(w)).toBe(0);
    w.sharing_tasks[0]!.scheduled_at = new Date(Date.now() - 1000).toISOString();
    w.sharing_tasks[0]!.paused = true;
    expect(advance(w)).toBe(0);
    w.sharing_tasks[0]!.paused = false;
    expect(advance(w)).toBe(1);
    expect(advance(w)).toBe(0);
    expect(w.notifications).toHaveLength(1);
  });
  it('cascades task and attempt deletion when removing a group', () => {
    const w = fixture();
    run(w, 'queue.add', { post_id: post, group_ids: [group] });
    run(w, 'task.transition', { id: w.sharing_tasks[0]!.id, status: 'awaiting_confirmation' });
    run(w, 'group.delete', { id: group });
    expect(w.sharing_tasks).toHaveLength(0);
    expect(w.sharing_attempts).toHaveLength(0);
  });
  it('allows only one default Page and hides integration secrets', () => {
    const w = fixture();
    const second = run(w, 'page.add', { values: { name: 'Second', facebook_page_id: '456' } });
    run(w, 'page.default', { id: page });
    run(w, 'page.default', { id: second.id });
    expect(w.connected_pages.filter((p) => p.is_default)).toHaveLength(1);
    const old = run(w, 'integration.rotate');
    const fresh = run(w, 'integration.rotate');
    expect(w.integrations.find((i) => i.id === old.id)?.enabled).toBe(false);
    expect(fresh.url).toBe('https://us-central1-test-project.cloudfunctions.net/n8nWebhook');
    expect(JSON.stringify(run(w, 'integration.status'))).not.toContain(fresh.secret);
  });
  it('validates profile fields without accepting arbitrary data', () => {
    const w = fixture();
    expect(() =>
      run(w, 'profile.update', { values: { ...w.profile, timezone: 'Invalid/Timezone' } }),
    ).toThrow();
    run(w, 'profile.update', {
      values: { ...w.profile, display_name: 'Name', owner_id: 'intruder' },
    });
    expect(w.profile.owner_id).toBeUndefined();
    expect(w.profile.display_name).toBe('Name');
  });
});
describe('Firebase webhook integrity', () => {
  it('verifies exact bytes and five-minute timestamp boundaries', () => {
    const secret = 'test-secret',
      timestamp = '1800000000',
      raw = '{"a":1}';
    const sig = createHmac('sha256', secret)
      .update(timestamp + '.' + raw)
      .digest('hex');
    expect(verifySignature(secret, timestamp, sig, raw, 1800000300000)).toBe(true);
    expect(verifySignature(secret, timestamp, sig, raw, 1800000301000)).toBe(false);
    expect(verifySignature(secret, timestamp, sig, raw + ' ', 1800000000000)).toBe(false);
    expect(verifySignature(secret, timestamp, 'invalid', raw, 1800000000000)).toBe(false);
  });
  it('deduplicates events and tasks, rejects body collisions and unconfigured Pages', () => {
    const w = fixture();
    const integration = run(w, 'integration.rotate');
    const payload = {
      event_id: 'evt',
      page_id: '123',
      post_id: '456',
      post_url: 'https://www.facebook.com/posts/456',
      caption: 'Hello',
      media_type: 'text',
      published_at: new Date().toISOString(),
    };
    const raw = JSON.stringify(payload);
    expect(ingest(w, integration.id, raw, payload).duplicate).toBe(false);
    expect(ingest(w, integration.id, raw, payload).duplicate).toBe(true);
    expect(w.sharing_tasks).toHaveLength(1);
    expect(() => ingest(w, integration.id, raw + ' ', payload)).toThrow('different payload');
    expect(() =>
      ingest(w, integration.id, 'other', { ...payload, event_id: 'other', page_id: '999' }),
    ).toThrow('not configured');
  });
});
