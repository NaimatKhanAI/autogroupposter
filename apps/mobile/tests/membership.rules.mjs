import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ensureMembership, updateMembership } from '../src/membershipApi.ts';
const require = createRequire(import.meta.url);
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} = require('firebase/firestore');
let env;
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
});
const dbFor = (uid) =>
  env.authenticatedContext(uid, { email_verified: true, email: `${uid}@example.com` }).firestore();
const initial = (uid) => ({
  uid,
  email: `${uid}@example.com`,
  display_name: uid,
  trial_started_at: serverTimestamp(),
  approved_free: false,
  subscription_until: null,
  blocked: false,
  updated_at: serverTimestamp(),
  updated_by: uid,
});
async function seed(uid, values = {}) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'memberships', uid), { ...initial(uid), ...values });
    await setDoc(doc(context.firestore(), 'facebook_groups', `${uid}-group`), {
      owner_id: uid,
      name: 'Owned group',
    });
  });
}
test('verified owners can start one server-timed trial but cannot self-approve, renew or promote themselves', async () => {
  const db = dbFor('alice'),
    reference = doc(db, 'memberships/alice');
  await assertSucceeds(setDoc(reference, initial('alice')));
  await assertFails(updateDoc(reference, { approved_free: true }));
  await assertFails(
    updateDoc(reference, { subscription_until: Timestamp.fromMillis(Date.now() + 86400000) }),
  );
  await assertFails(
    updateDoc(reference, { trial_started_at: serverTimestamp(), updated_at: serverTimestamp() }),
  );
  await assertFails(deleteDoc(reference));
  await assertFails(setDoc(doc(db, 'app_admins/alice'), { enabled: true }));
  await assertFails(setDoc(doc(db, 'memberships/bob'), initial('bob')));
});
test('trials must start at server time and cannot be created already approved', async () => {
  const db = dbFor('alice');
  await assertFails(
    setDoc(doc(db, 'memberships/alice'), { ...initial('alice'), approved_free: true }),
  );
  await assertFails(
    setDoc(doc(db, 'memberships/alice'), {
      ...initial('alice'),
      trial_started_at: Timestamp.fromMillis(Date.now() + 86400000),
    }),
  );
});
test('server access expires after 14 days, while approved free and valid paid access work', async () => {
  const past = Timestamp.fromMillis(Date.now() - 15 * 86400000),
    db = dbFor('alice');
  await seed('alice', { trial_started_at: past });
  await assertFails(getDoc(doc(db, 'facebook_groups/alice-group')));
  await assertSucceeds(getDoc(doc(db, 'memberships/alice')));
  await seed('alice', { trial_started_at: past, approved_free: true });
  await assertSucceeds(getDoc(doc(db, 'facebook_groups/alice-group')));
  await seed('alice', {
    trial_started_at: past,
    subscription_until: Timestamp.fromMillis(Date.now() + 86400000),
  });
  await assertSucceeds(getDoc(doc(db, 'facebook_groups/alice-group')));
  await seed('alice', {
    trial_started_at: past,
    subscription_until: Timestamp.fromMillis(Date.now() - 1000),
  });
  await assertFails(getDoc(doc(db, 'facebook_groups/alice-group')));
});
test('blocked members are denied even during a trial or with free approval', async () => {
  await seed('alice', { approved_free: true, blocked: true });
  await assertFails(getDoc(doc(dbFor('alice'), 'facebook_groups/alice-group')));
});
test('admins can manage grants and list members but cannot change trial history or read another workspace', async () => {
  await seed('alice');
  await seed('bob');
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), 'app_admins/operator'), { enabled: true }),
  );
  const admin = dbFor('operator'),
    reference = doc(admin, 'memberships/alice');
  await assertSucceeds(getDocs(collection(admin, 'memberships')));
  await assertSucceeds(
    updateDoc(reference, {
      approved_free: true,
      updated_at: serverTimestamp(),
      updated_by: 'operator',
    }),
  );
  await assertFails(
    updateDoc(reference, {
      trial_started_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      updated_by: 'operator',
    }),
  );
  await assertFails(getDoc(doc(admin, 'facebook_groups/alice-group')));
  await assertFails(getDocs(collection(dbFor('alice'), 'memberships')));
  await assertFails(getDoc(doc(dbFor('alice'), 'memberships/bob')));
  await assertFails(updateDoc(doc(dbFor('alice'), 'app_admins/operator'), { enabled: false }));
});
test('expired users can delete their data but cannot recreate a trial after deletion starts', async () => {
  await seed('alice', { trial_started_at: Timestamp.fromMillis(Date.now() - 15 * 86400000) });
  const db = dbFor('alice');
  await assertSucceeds(
    setDoc(doc(db, 'workspace_locks/alice'), { deleting: true, updated_at: serverTimestamp() }),
  );
  await assertSucceeds(getDoc(doc(db, 'facebook_groups/alice-group')));
  await assertSucceeds(deleteDoc(doc(db, 'memberships/alice')));
  await assertFails(setDoc(doc(db, 'memberships/alice'), initial('alice')));
});
test('membership client starts once and admin client can activate, cancel and block paid access', async () => {
  const db = dbFor('alice'),
    user = { uid: 'alice', email: 'alice@example.com', displayName: 'Alice', emailVerified: true };
  await ensureMembership(db, user);
  const started = (await getDoc(doc(db, 'memberships/alice'))).data().trial_started_at.toMillis();
  await ensureMembership(db, user);
  assert.equal(
    (await getDoc(doc(db, 'memberships/alice'))).data().trial_started_at.toMillis(),
    started,
  );
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), 'app_admins/operator'), { enabled: true }),
  );
  const admin = dbFor('operator');
  await updateMembership(admin, 'operator', 'alice', 'subscribe', 30);
  assert.ok(
    (await getDoc(doc(db, 'memberships/alice'))).data().subscription_until.toMillis() > Date.now(),
  );
  await assertFails(updateMembership(db, 'alice', 'alice', 'approve_free'));
  await updateMembership(admin, 'operator', 'alice', 'block');
  assert.equal((await getDoc(doc(db, 'memberships/alice'))).data().blocked, true);
  await updateMembership(admin, 'operator', 'alice', 'cancel_subscription');
  assert.equal((await getDoc(doc(db, 'memberships/alice'))).data().subscription_until, null);
});
test('only admins can set monthly prices and payment instructions', async () => {
  const db = dbFor('alice');
  const plan = {
    monthly_prices: { USDT: '10', PKR: '2800', SAR: '38', AED: '37' },
    contact_email: 'operator@example.com',
    payment_instructions: 'Contact admin to arrange payment.',
    updated_at: serverTimestamp(),
    updated_by: 'alice',
  };
  await assertFails(setDoc(doc(db, 'membership_config/default'), plan));
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), 'app_admins/operator'), { enabled: true }),
  );
  const admin = dbFor('operator');
  await assertSucceeds(
    setDoc(doc(admin, 'membership_config/default'), { ...plan, updated_by: 'operator' }),
  );
  await assertSucceeds(getDoc(doc(db, 'membership_config/default')));
  await assertFails(
    updateDoc(doc(db, 'membership_config/default'), { payment_instructions: 'Tampered' }),
  );
});
