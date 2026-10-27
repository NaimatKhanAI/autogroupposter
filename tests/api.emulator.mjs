import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { agpApi } = require("../functions/lib/functions/src/index.js");
const functionRequire = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { getFirestore } = functionRequire("firebase-admin/firestore");
const db = getFirestore();
const uid = "api-test-user";
const auth = { uid, token: { email: "api@example.com", email_verified: true } };
const call = (action, input = {}, identity = auth) =>
  agpApi.run({ auth: identity, data: { action, input } });
test("server authorized standalone and shared-account campaign lifecycle", async () => {
  await db.recursiveDelete(db.doc("agpUsers/" + uid));
  await assert.rejects(call("bootstrap", {}, null));
  await assert.rejects(
    call("bootstrap", {}, { uid, token: { email_verified: false } }),
  );
  const first = await call("bootstrap");
  assert.equal(first.plan.groups, 3);
  await assert.rejects(call("admin.overview"));
  const g = await call("saveGroup", {
    name: "A",
    url: "https://facebook.com/groups/example",
    category: "Test",
  });
  await call("saveGroup", {
    name: "B",
    url: "https://facebook.com/groups/example2",
  });
  await call("saveGroup", {
    name: "C",
    url: "https://facebook.com/groups/example3",
  });
  await assert.rejects(
    call("saveGroup", {
      name: "D",
      url: "https://facebook.com/groups/example4",
    }),
  );
  const post = await call("savePost", {
    title: "Shared draft",
    text: "Prepared from mobile",
  });
  await call("registerDevice", { id: "browser-1", name: "Test browser" });
  await assert.rejects(
    call("registerDevice", { id: "browser-2", name: "Second browser" }),
  );
  const campaign = {
    requestId: "request-1",
    name: "Mobile to extension",
    postId: post.id,
    groupIds: [g.id, g.id],
    deviceId: "browser-1",
  };
  await call("createCampaign", campaign);
  await call("createCampaign", campaign);
  let jobs = await call("jobs", { deviceId: "browser-1" });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].post.text, "Prepared from mobile");
  // Repeated polling models a fresh worker recovering server state.
  assert.equal(
    (await call("jobs", { deviceId: "browser-1" }))[0].id,
    jobs[0].id,
  );
  await assert.rejects(
    call("transitionJob", { id: jobs[0].id, status: "platform_confirmed" }),
  );
  await assert.rejects(
    call("transitionJob", {
      id: jobs[0].id,
      status: "user_confirmed",
      confirmed: true,
    }),
  );
  await call("transitionJob", { id: jobs[0].id, status: "waiting_for_user" });
  await assert.rejects(
    call("transitionJob", { id: jobs[0].id, status: "user_confirmed" }),
  );
  await call("transitionJob", {
    id: jobs[0].id,
    status: "user_confirmed",
    confirmed: true,
  });
  assert.equal((await call("jobs", { deviceId: "browser-1" })).length, 0);
  await call("revokeDevice", { id: "browser-1" });
  await assert.rejects(call("jobs", { deviceId: "browser-1" }));
  await assert.rejects(
    call("registerDevice", {
      id: "browser-1",
      name: "Reconnect revoked identity",
    }),
  );
  assert.equal((await call("list", { kind: "campaigns" })).length, 1);
  await call("archiveCampaign", { id: "request-1" });
  await call("archiveCampaign", { id: "request-1" });
  assert.equal((await call("bootstrap")).usage.campaigns, 0);
  assert.equal(
    (await call("list", { kind: "jobs" }))[0].status,
    "user_confirmed",
  );
  const alternate = {
    uid: "other-user",
    token: { email: "other@example.com", email_verified: true },
  };
  await call("bootstrap", {}, alternate);
  assert.equal((await call("list", { kind: "posts" }, alternate)).length, 0);
});
test("trial expiry and admin plan configuration are server enforced", async () => {
  const owner = {
    uid: "owner-test",
    token: { email: "owner@example.com", email_verified: true, agpAdmin: true },
  };
  await call(
    "admin.plan",
    {
      id: "trial",
      plan: {
        name: "Trial",
        enabled: true,
        groups: 20,
        posts: 20,
        campaigns: 10,
        devices: 2,
        trialDays: 2,
        scheduling: true,
        variantId: "",
        displayPrice: "Trial",
        interval: "free",
      },
    },
    owner,
  );
  const trialAuth = {
    uid: "trial-test",
    token: { email: "trial@example.com", email_verified: true },
  };
  await db.recursiveDelete(db.doc("agpUsers/trial-test"));
  let t = await call("bootstrap", {}, trialAuth);
  assert.equal(t.subscription.status, "trialing");
  assert.equal(t.plan.groups, 20);
  await db
    .doc("agpUsers/trial-test")
    .update({ "subscription.validUntil": Date.now() - 1000 });
  t = await call("bootstrap", {}, trialAuth);
  assert.equal(t.plan.groups, 3);
  await call(
    "admin.access",
    {
      uid: "trial-test",
      planId: "trial",
      validUntil: Date.now() + 86400000,
      suspended: false,
    },
    owner,
  );
  assert.equal(
    (await call("bootstrap", {}, trialAuth)).subscription.status,
    "promotional",
  );
  await call(
    "admin.access",
    {
      uid: "trial-test",
      planId: "trial",
      validUntil: Date.now() + 86400000,
      suspended: true,
    },
    owner,
  );
  await assert.rejects(call("bootstrap", {}, trialAuth));
});
test("support requests and release changes require owner authorization", async () => {
  const owner = {
    uid: "owner-test",
    token: { email: "owner@example.com", email_verified: true, agpAdmin: true },
  };
  await call("support", { message: "Please help with device registration." });
  await call("deleteAccountRequest", { message: "Please delete my account." });
  await assert.rejects(
    call("admin.release", {
      currentVersion: "1.0.0",
      minimumVersion: "1.0.0",
      notes: "Test",
      supportUrl: "https://example.com/help",
    }),
  );
  await call(
    "admin.release",
    {
      currentVersion: "1.0.1",
      minimumVersion: "1.0.0",
      notes: "Test release",
      supportUrl: "https://example.com/help",
    },
    owner,
  );
  const overview = await call("admin.overview", {}, owner);
  assert.ok(overview.support.length >= 2);
  assert.equal(overview.release.currentVersion, "1.0.1");
  await call(
    "admin.support",
    { id: overview.support[0].id, status: "in_progress" },
    owner,
  );
  const request = await db
    .doc("agpUsers/" + uid + "/support/" + overview.support[0].id)
    .get();
  assert.equal(request.data().status, "in_progress");
});
test("signed sandbox webhook activation, duplicate handling, failure, recovery, cancellation and refund", async () => {
  const { createHmac } = await import("node:crypto");
  const { agpWebhook } = require("../functions/lib/functions/src/index.js");
  const {
    LemonProvider,
  } = require("../functions/lib/functions/src/payments.js");
  process.env.LEMON_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.LEMON_STORE_ID = "test-store";
  process.env.LEMON_TEST_MODE = "true";
  await db.doc("agpPlans/pro-monthly").set({
    name: "Pro",
    enabled: true,
    variantId: "123",
    groups: 100,
    posts: 100,
    campaigns: 100,
    devices: 3,
  });
  await db.doc("agpUsers/paid-user").set({
    email: "paid@example.com",
    usage: {},
    subscription: { planId: "free", status: "active", validUntil: 0 },
  });
  let a = {
    store_id: "test-store",
    variant_id: 123,
    status: "active",
    test_mode: true,
    renews_at: new Date(Date.now() + 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  const original = LemonProvider.prototype.subscription;
  LemonProvider.prototype.subscription = async () => ({
    id: "sub-test",
    attributes: a,
  });
  async function deliver(name, signatureOverride) {
    const body = {
        meta: { event_name: name, custom_data: { uid: "paid-user" } },
        data: { type: "subscriptions", id: "sub-test", attributes: { ...a } },
      },
      rawBody = Buffer.from(JSON.stringify(body));
    let status = 0;
    const req = {
      method: "POST",
      body,
      rawBody,
      get: () =>
        signatureOverride ||
        createHmac("sha256", process.env.LEMON_WEBHOOK_SECRET)
          .update(rawBody)
          .digest("hex"),
    };
    const res = {
      sendStatus(s) {
        status = s;
        return this;
      },
      status(s) {
        status = s;
        return this;
      },
      send() {
        return this;
      },
    };
    await agpWebhook(req, res);
    return status;
  }
  try {
    assert.equal(await deliver("subscription_created", "bad-signature"), 401);
    assert.equal(await deliver("subscription_created"), 200);
    assert.equal(
      (await db.doc("agpUsers/paid-user").get()).data().subscription.planId,
      "pro-monthly",
    );
    const before = (await db.collection("agpSubscriptionEvents").get()).size;
    assert.equal(await deliver("subscription_created"), 200);
    assert.equal(
      (await db.collection("agpSubscriptionEvents").get()).size,
      before,
    );
    a = {
      ...a,
      status: "past_due",
      updated_at: new Date(Date.now() + 1000).toISOString(),
    };
    assert.equal(await deliver("subscription_payment_failed"), 200);
    assert.equal(
      (await db.doc("agpUsers/paid-user").get()).data().subscription.status,
      "past_due",
    );
    a = {
      ...a,
      status: "active",
      updated_at: new Date(Date.now() + 2000).toISOString(),
    };
    assert.equal(await deliver("subscription_payment_recovered"), 200);
    assert.equal(
      (await db.doc("agpUsers/paid-user").get()).data().subscription.status,
      "active",
    );
    a = {
      ...a,
      status: "cancelled",
      updated_at: new Date(Date.now() + 3000).toISOString(),
    };
    assert.equal(await deliver("subscription_cancelled"), 200);
    assert.equal(
      (await db.doc("agpUsers/paid-user").get()).data().subscription.status,
      "cancelled",
    );
    assert.equal(await deliver("subscription_payment_refunded"), 200);
    assert.equal(
      (await db.doc("agpUsers/paid-user").get()).data().subscription.status,
      "refunded",
    );
    a = {
      ...a,
      status: "active",
      updated_at: new Date(Date.now() + 4000).toISOString(),
    };
    assert.equal(await deliver("subscription_updated"), 200);
    assert.equal(
      (await db.doc("agpUsers/paid-user").get()).data().subscription.status,
      "refunded",
    );
    await db.doc("agpPlans/pro-yearly").set({
      name: "Yearly",
      enabled: true,
      variantId: "456",
      groups: 100,
      posts: 100,
      campaigns: 100,
      devices: 3,
    });
    a = {
      ...a,
      variant_id: 456,
      renews_at: new Date(Date.now() + 365 * 86400000).toISOString(),
      updated_at: new Date(Date.now() + 5000).toISOString(),
    };
    assert.equal(await deliver("subscription_updated"), 200);
    assert.equal(
      (await db.doc("agpUsers/paid-user").get()).data().subscription.planId,
      "pro-yearly",
    );
    assert.equal(
      (await db.doc("agpUsers/paid-user").get()).data().subscription.status,
      "active",
    );
    a = {
      ...a,
      status: "expired",
      ends_at: new Date(Date.now() - 1000).toISOString(),
      updated_at: new Date(Date.now() + 6000).toISOString(),
    };
    assert.equal(await deliver("subscription_expired"), 200);
    const expired = await call(
      "bootstrap",
      {},
      {
        uid: "paid-user",
        token: { email: "paid@example.com", email_verified: true },
      },
    );
    assert.equal(expired.plan.name, "Free");
  } finally {
    LemonProvider.prototype.subscription = original;
  }
});
test("checkout selects server plan and reuses a pending hosted session", async () => {
  const {
    LemonProvider,
  } = require("../functions/lib/functions/src/payments.js");
  const old = LemonProvider.prototype.checkout;
  let count = 0;
  const customer = {
    uid: "checkout-user",
    token: { email: "checkout@example.com", email_verified: true },
  };
  await db.recursiveDelete(db.doc("agpUsers/checkout-user"));
  await call("bootstrap", {}, customer);
  LemonProvider.prototype.checkout = async (actualUid, email, variant) => {
    count++;
    assert.equal(actualUid, "checkout-user");
    assert.equal(email, "checkout@example.com");
    assert.equal(variant, "123");
    return "https://example.lemonsqueezy.com/checkout/test-only";
  };
  try {
    const a = await call(
      "checkout",
      { planId: "pro-monthly", uid: "another-user" },
      customer,
    );
    const b = await call("checkout", { planId: "pro-monthly" }, customer);
    assert.equal(a.url, b.url);
    assert.equal(count, 1);
    await assert.rejects(
      call("checkout", { planId: "unknown-plan" }, customer),
    );
  } finally {
    LemonProvider.prototype.checkout = old;
  }
});
