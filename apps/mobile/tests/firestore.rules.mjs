import { readFile } from 'node:fs/promises';
import { test, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
let env;
before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
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
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await Promise.all([
      setDoc(doc(db, 'profiles/alice'), { display_name: 'Alice' }),
      setDoc(doc(db, 'memberships/alice'), {
        trial_started_at: Timestamp.now(),
        approved_free: false,
        subscription_until: null,
        blocked: false,
      }),
      setDoc(doc(db, 'facebook_groups/a'), { owner_id: 'alice', name: 'Alice group' }),
      setDoc(doc(db, 'facebook_groups/b'), { owner_id: 'bob', name: 'Bob group' }),
      setDoc(doc(db, 'integrations/secret'), { owner_id: 'alice', secret: 'never-visible' }),
      setDoc(doc(db, 'push_tokens/token'), { owner_id: 'alice', token: 'private' }),
    ]);
  });
});
const alice = () => env.authenticatedContext('alice', { email_verified: true }).firestore();
test('verified user can query only their owned records', async () => {
  const db = alice();
  await assertSucceeds(
    getDocs(query(collection(db, 'facebook_groups'), where('owner_id', '==', 'alice'))),
  );
  await assertFails(getDocs(collection(db, 'facebook_groups')));
  await assertFails(getDoc(doc(db, 'facebook_groups/b')));
  await assertSucceeds(getDoc(doc(db, 'profiles/alice')));
  await assertFails(getDoc(doc(db, 'profiles/bob')));
});
test('anonymous and unverified users cannot read application data', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'facebook_groups/a')));
  await assertFails(
    getDoc(
      doc(
        env.authenticatedContext('alice', { email_verified: false }).firestore(),
        'facebook_groups/a',
      ),
    ),
  );
});
test('clients cannot write profiles, forge tasks or read server secrets', async () => {
  const db = alice();
  await assertFails(setDoc(doc(db, 'profiles/alice'), { display_name: 'Forged' }));
  await assertFails(
    setDoc(doc(db, 'sharing_tasks/forged'), { owner_id: 'alice', status: 'confirmed_shared' }),
  );
  for (const path of ['integrations/secret', 'push_tokens/token', 'integration_events/event'])
    await assertFails(getDoc(doc(db, path)));
});
test('deletion tombstone allows owner cleanup reads but blocks malformed writes', async () => {
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), 'workspace_locks/alice'), { deleting: true }),
  );
  await assertSucceeds(getDoc(doc(alice(), 'facebook_groups/a')));
  await assertSucceeds(getDoc(doc(alice(), 'profiles/alice')));
  await assertFails(setDoc(doc(alice(), 'profiles/alice'), { display_name: 'Changed' }));
});
