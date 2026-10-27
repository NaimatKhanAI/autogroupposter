import { readFile } from 'node:fs/promises';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { createFreeBackend } from '../src/firebaseOperations.ts';
const require = createRequire(import.meta.url);
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  Timestamp,
} = require('firebase/firestore');
let env, a, b, adb, bdb;
before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-groupposter',
    firestore: { host, port: Number(port), rules: await readFile('firestore.rules', 'utf8') },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    for (const uid of ['alice', 'bob'])
      await setDoc(doc(context.firestore(), 'memberships', uid), {
        trial_started_at: Timestamp.now(),
        approved_free: false,
        subscription_until: null,
        blocked: false,
      });
  });
  adb = env.authenticatedContext('alice', { email_verified: true }).firestore();
  bdb = env.authenticatedContext('bob', { email_verified: true }).firestore();
  a = createFreeBackend(adb, {
    currentUser: { uid: 'alice', emailVerified: true, displayName: 'Alice' },
  });
  b = createFreeBackend(bdb, {
    currentUser: { uid: 'bob', emailVerified: true, displayName: 'Bob' },
  });
  await a.ensureProfile();
  await b.ensureProfile();
});
const page = (backend = a, name = 'Main Page', facebook_page_id = '123') =>
  backend.operation('page.add', { values: { name, facebook_page_id } });
const group = (page_id = null, url = 'https://www.facebook.com/groups/example') =>
  a.operation('group.save', { values: { name: 'Example group', url, page_id } });
async function fixture() {
  const p = await page(),
    g = await group(p.id);
  const post = await a.operation('post.import', {
    values: { page_id: p.id, post_url: 'https://www.facebook.com/posts/123', caption: 'Hello' },
  });
  return { p, g, post };
}
test('free profile, Page configuration and single default Page work without Cloud Functions', async () => {
  assert.equal((await a.ensureProfile()).display_name, 'Alice');
  await a.operation('profile.update', {
    values: {
      display_name: 'Alice Updated',
      timezone: 'UTC',
      appearance: 'dark',
      posting_window_start: '09:00',
      posting_window_end: '18:00',
    },
  });
  assert.equal((await a.ensureProfile()).appearance, 'dark');
  const p = await page(),
    second = await page(a, 'Second Page', '456');
  await a.operation('page.default', { id: p.id });
  await a.operation('page.default', { id: second.id });
  const pages = await a.rows('connected_pages');
  assert.equal(pages.filter((p) => p.is_default).length, 1);
  assert.equal(pages.find((p) => p.is_default).id, second.id);
  await assert.rejects(page());
});
test('groups are unique, editable and isolated from another account', async () => {
  const g = await group();
  await assert.rejects(group());
  await a.operation('group.save', {
    id: g.id,
    values: { name: 'Updated group', url: g.url, enabled: false },
  });
  assert.equal((await a.rows('facebook_groups'))[0].name, 'Updated group');
  const other = await page(b, 'Bob Page', '999');
  await assert.rejects(group(other.id, 'https://www.facebook.com/groups/crossowner'));
  await assertFails(updateDoc(doc(bdb, 'facebook_groups', g.id), { enabled: true }));
  assert.equal((await b.rows('facebook_groups')).length, 0);
});
test('post import and queue creation are idempotent, with transactional confirmation', async () => {
  const { g, post } = await fixture();
  await assert.rejects(
    a.operation('post.import', { values: { page_id: post.page_id, post_url: post.post_url } }),
  );
  await Promise.all([
    a.operation('queue.add', { post_id: post.id, group_ids: [g.id] }),
    a.operation('queue.add', { post_id: post.id, group_ids: [g.id] }),
  ]);
  const tasks = await a.rows('sharing_tasks');
  assert.equal(tasks.length, 1);
  const id = tasks[0].id;
  await assert.rejects(
    a.operation('task.transition', { id, status: 'confirmed_shared', note: 'Done' }),
  );
  await a.operation('task.transition', { id, status: 'awaiting_confirmation' });
  await assert.rejects(a.operation('task.transition', { id, status: 'confirmed_shared' }));
  await a.operation('task.transition', {
    id,
    status: 'confirmed_shared',
    note: 'I shared the post.',
  });
  const completed = (await a.rows('sharing_tasks'))[0];
  assert.equal(completed.confirmation_source, 'user_attestation');
  assert.equal(completed.attempt_count, 1);
  assert.ok(completed.confirmed_at);
  assert.equal((await a.rows('sharing_attempts')).length, 2);
});
test('rules prevent forged confirmations, provider receipts and cross-owner writes', async () => {
  const { g, post } = await fixture();
  await a.operation('queue.add', { post_id: post.id, group_ids: [g.id] });
  const task = (await a.rows('sharing_tasks'))[0],
    r = doc(adb, 'sharing_tasks', task.id);
  await assertFails(
    updateDoc(r, {
      status: 'confirmed_shared',
      version: 1,
      updated_at: serverTimestamp(),
      confirmed_at: serverTimestamp(),
      confirmation_source: 'user_attestation',
      confirmation_note: 'Fake shortcut',
    }),
  );
  await a.operation('task.transition', { id: task.id, status: 'awaiting_confirmation' });
  await assertFails(
    updateDoc(r, {
      status: 'confirmed_shared',
      version: 2,
      updated_at: serverTimestamp(),
      confirmed_at: serverTimestamp(),
      confirmation_source: 'provider_receipt',
      confirmation_note: 'Forged receipt',
    }),
  );
  await assertFails(updateDoc(r, { owner_id: 'bob' }));
  await assertFails(getDoc(doc(bdb, 'sharing_tasks', task.id)));
});
test('scheduled tasks advance only when due and unpaused', async () => {
  const { g, post } = await fixture();
  await a.operation('queue.add', {
    post_id: post.id,
    group_ids: [g.id],
    scheduled_at: new Date(Date.now() + 2500).toISOString(),
  });
  assert.equal((await a.operation('schedule.advance')).advanced, 0);
  await a.operation('queue.pause', { paused: true });
  await delay(2600);
  assert.equal((await a.operation('schedule.advance')).advanced, 0);
  await a.operation('queue.pause', { paused: false });
  assert.equal((await a.operation('schedule.advance')).advanced, 1);
  assert.equal((await a.rows('sharing_tasks'))[0].status, 'ready_for_user');
});
test('CSV upsert, bulk activation and cascading group deletion work on the free backend', async () => {
  await a.operation('group.import', {
    rows: [
      { name: 'Group one', url: 'https://www.facebook.com/groups/one' },
      { name: 'Group two', url: 'https://www.facebook.com/groups/two' },
    ],
  });
  await a.operation('group.import', {
    rows: [{ name: 'Updated one', url: 'https://www.facebook.com/groups/one' }],
  });
  const groups = await a.rows('facebook_groups');
  assert.equal(groups.length, 2);
  await a.operation('group.bulk', { ids: groups.map((g) => g.id), enabled: false });
  assert.equal((await a.rows('facebook_groups')).filter((g) => g.enabled).length, 0);
  const { g, post } = await fixture();
  await a.operation('queue.add', { post_id: post.id, group_ids: [g.id] });
  await a.operation('task.transition', {
    id: (await a.rows('sharing_tasks'))[0].id,
    status: 'awaiting_confirmation',
  });
  await a.operation('group.delete', { id: g.id });
  assert.equal((await a.rows('sharing_tasks')).length, 0);
  assert.equal((await a.rows('sharing_attempts')).length, 0);
});
test('deletion locks permit cleanup but prevent account data from being recreated', async () => {
  const g = await group();
  await assertSucceeds(
    setDoc(doc(adb, 'workspace_locks/alice'), { deleting: true, updated_at: serverTimestamp() }),
  );
  await assert.rejects(a.ensureProfile(), /deletion/);
  await assertFails(updateDoc(doc(adb, 'facebook_groups', g.id), { name: 'Changed' }));
  await assertSucceeds(getDoc(doc(adb, 'facebook_groups', g.id)));
  await assertSucceeds(deleteDoc(doc(adb, 'facebook_groups', g.id)));
  await assertSucceeds(deleteDoc(doc(adb, 'profiles/alice')));
});
