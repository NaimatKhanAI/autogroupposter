import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import test from "node:test";
import assert from "node:assert/strict";
test("register, restore shared account, sign out, reject wrong password and reset", async () => {
  const app = initializeApp({
      apiKey: "demo-key",
      projectId: "demo-autogroupposter",
    }),
    auth = getAuth(app);
  connectAuthEmulator(
    auth,
    "http://" + (process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9195"),
    { disableWarnings: true },
  );
  const email = `test-${Date.now()}@example.com`,
    password = "Test-only-Password-123!";
  const user = (await createUserWithEmailAndPassword(auth, email, password))
    .user;
  assert.equal(user.emailVerified, false);
  const uid = user.uid;
  await signOut(auth);
  assert.equal(auth.currentUser, null);
  const same = await signInWithEmailAndPassword(auth, email, password);
  assert.equal(same.user.uid, uid);
  await signOut(auth);
  await assert.rejects(signInWithEmailAndPassword(auth, email, "incorrect"));
  await sendPasswordResetEmail(auth, email);
  await deleteApp(app);
});
