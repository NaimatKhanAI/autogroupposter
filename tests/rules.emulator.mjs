import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import test from "node:test";
const env = await initializeTestEnvironment({
  projectId: "demo-autogroupposter",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});
test.after(async () => env.cleanup());
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "agpUsers/alice"), {
    subscription: { planId: "pro", status: "active" },
  });
  await setDoc(doc(db, "agpUsers/alice/groups/a"), { name: "Private group" });
  await setDoc(doc(db, "agpPlans/free"), { groups: 3 });
});
test("owner can read shared extension and mobile records", async () => {
  const db = env
    .authenticatedContext("alice", { email_verified: true })
    .firestore();
  await assertSucceeds(getDoc(doc(db, "agpUsers/alice/groups/a")));
  await assertSucceeds(getDocs(collection(db, "agpUsers/alice/groups")));
});
test("another account cannot read shared records", async () => {
  const db = env
    .authenticatedContext("bob", { email_verified: true })
    .firestore();
  await assertFails(getDoc(doc(db, "agpUsers/alice/groups/a")));
});
test("unverified and anonymous accounts cannot read", async () => {
  await assertFails(
    getDoc(
      doc(
        env
          .authenticatedContext("alice", { email_verified: false })
          .firestore(),
        "agpUsers/alice",
      ),
    ),
  );
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), "agpPlans/free")),
  );
});
test("modified clients cannot grant subscriptions, roles or usage", async () => {
  const db = env
    .authenticatedContext("alice", { email_verified: true })
    .firestore();
  await assertFails(
    setDoc(doc(db, "agpUsers/alice"), {
      subscription: { planId: "business" },
      role: "admin",
      usage: {},
    }),
  );
});
test("modified clients cannot bypass campaign or device authorization", async () => {
  const db = env
    .authenticatedContext("alice", { email_verified: true })
    .firestore();
  for (const kind of [
    "groups",
    "posts",
    "campaigns",
    "jobs",
    "devices",
    "activity",
  ])
    await assertFails(
      setDoc(doc(db, `agpUsers/alice/${kind}/injected`), {
        status: "platform_confirmed",
      }),
    );
});
test("clients including admin cannot modify payment events or plans directly", async () => {
  const db = env
    .authenticatedContext("alice", { email_verified: true, agpAdmin: true })
    .firestore();
  for (const p of [
    "agpPlans/pro",
    "agpSubscriptionEvents/fake",
    "agpAdminAudit/fake",
  ])
    await assertFails(setDoc(doc(db, p), { active: true }));
});
