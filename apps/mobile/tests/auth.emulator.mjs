import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  applyActionCode,
  reload,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  deleteUser,
} from 'firebase/auth';
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host) throw new Error('Run with npm run test:auth. This suite must use the Auth emulator.');
test('signup, verification, login, reset and deletion work with the real Auth SDK', async () => {
  const app = initializeApp(
    { apiKey: 'emulator-only', projectId: 'demo-groupposter' },
    randomUUID(),
  );
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, 'http://' + host, { disableWarnings: true });
  const email = `qa-${randomUUID()}@example.com`;
  const password = 'Test-password!2026';
  const codes = async () => {
    const r = await fetch(`http://${host}/emulator/v1/projects/demo-groupposter/oobCodes`);
    assert.equal(r.status, 200);
    return (await r.json()).oobCodes.filter((c) => c.email === email);
  };
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    assert.equal(user.emailVerified, false);
    await sendEmailVerification(user);
    const verification = (await codes()).find((c) => c.requestType === 'VERIFY_EMAIL');
    assert.ok(verification?.oobCode);
    await applyActionCode(auth, verification.oobCode);
    await reload(user);
    assert.equal(user.emailVerified, true);
    const uid = user.uid;
    await signOut(auth);
    await assert.rejects(signInWithEmailAndPassword(auth, email, 'wrong-password'));
    const signed = await signInWithEmailAndPassword(auth, email, password);
    assert.equal(signed.user.uid, uid);
    assert.equal(signed.user.emailVerified, true);
    await signOut(auth);
    await sendPasswordResetEmail(auth, email);
    const reset = (await codes()).find((c) => c.requestType === 'PASSWORD_RESET');
    assert.ok(reset?.oobCode);
    await confirmPasswordReset(auth, reset.oobCode, 'New-test-password!2026');
    const recovered = await signInWithEmailAndPassword(auth, email, 'New-test-password!2026');
    assert.equal(recovered.user.uid, uid);
    await deleteUser(recovered.user);
    await assert.rejects(signInWithEmailAndPassword(auth, email, 'New-test-password!2026'));
  } finally {
    if (auth.currentUser) await deleteUser(auth.currentUser).catch(() => {});
    await deleteApp(app);
  }
});
