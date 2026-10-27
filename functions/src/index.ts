import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue,FieldPath } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import {
  freePlan,
  planSchema,
  groupSchema,
  postSchema,
  effectivePlan,
  assertQuota,
  assertTransition,
  versionOlder,
} from "../../packages/shared/domain";
import { LemonProvider, verifySignature, eventId,providerState } from "./payments";
import {completeDeletion,cleanupMedia} from './lifecycle';
initializeApp();
const db = getFirestore();
const apiKey = defineSecret("LEMON_API_KEY"),
  webhookSecret = defineSecret("LEMON_WEBHOOK_SECRET");
const root = (uid: string) => db.collection("agpUsers").doc(uid);
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
function provider() {
  return new LemonProvider(
    apiKey.value(),
    process.env.LEMON_STORE_ID || "",
    process.env.LEMON_TEST_MODE !== "false",
    process.env.WEBSITE_URL || "",
  );
}
async function plans() {
  const s = await db.collection("agpPlans").get();
  return {
    free: freePlan,
    ...Object.fromEntries(s.docs.map((d) => [d.id, d.data()])),
  } as Record<string, any>;
}
export const agpApi = onCall(
  { region: "us-central1", secrets: [apiKey], maxInstances: 20 },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    if (!req.auth.token.email_verified)
      throw new HttpsError("permission-denied", "Verify your email first.");
    const uid = req.auth.uid;
    const { action, input = {} } = z
      .object({
        action: z.string().max(80),
        input: z.record(z.string(), z.any()).optional(),
      })
      .parse(req.data);
    const user = root(uid);
    const now = Date.now();
    try {
      const deletion=(await db.doc(`agpDeletionRequests/${uid}`).get()).data();if(deletion&&['processing','completed','needs_attention'].includes(deletion.status))throw new HttpsError('permission-denied','Account deletion is being processed. Contact support.');
      const rateRef = user
        .collection("limits")
        .doc(String(Math.floor(now / 60000)));
      await db.runTransaction(async (tx) => {
        const count = (await tx.get(rateRef)).data()?.count || 0;
        if (count >= 120)
          throw new HttpsError(
            "resource-exhausted",
            "Too many requests. Try again shortly.",
          );
        tx.set(rateRef, {
          count: count + 1,
          expiresAt: new Date(now + 86400000),
        });
      });
      const config = await plans();
      const release = (await db.doc("agpConfig/release").get()).data() || {
        currentVersion: "1.0.0",
        minimumVersion: "1.0.0",
        notes: "Initial assisted publishing release",
        supportUrl: process.env.WEBSITE_URL
          ? process.env.WEBSITE_URL + "/contact"
          : "",
      };
      return await db
        .runTransaction(async (tx) => {
          const userSnap = await tx.get(user);
          const state = userSnap.data() || {};
          if (state.suspended)
            throw new HttpsError(
              "permission-denied",
              "Account suspended. Contact support.",
            );
          if(state.deletionRequested&&!['bootstrap','list','listPage','plans','portal','deleteAccountRequest','support'].includes(action)&&!action.startsWith('admin.'))throw new HttpsError('failed-precondition','Account deletion is pending. New work is disabled.');
          const sub = state.subscription;
          const candidate = config[effectivePlan(sub)];
          const plan = candidate?.enabled ? candidate : config.free || freePlan;
          const usage = state.usage || {};
          const audit = (kind: string, detail: unknown) =>
            tx.create(user.collection("activity").doc(), {
              kind,
              detail,
              at: now,
              uid,
            });
          const finish = (value: unknown) => value;
          if (action === "bootstrap") {
            if (!userSnap.exists) {
              const trial = config.trial;
              const subscription = trial?.enabled
                ? {
                    planId: "trial",
                    status: "trialing",
                    validUntil: now + trial.trialDays * 86400000,
                  }
                : {
                    planId: "free",
                    status: "active",
                    validUntil: now + 315360000000,
                  };
              tx.create(user, {
                createdAt: now,
                email: req.auth!.token.email,
                usage: {},
                subscription,
              });
              return finish({
                subscription,
                plan: trial?.enabled ? trial : config.free,
                admin: req.auth!.token.agpAdmin === true,
                release,
              });
            }
            return finish({
              subscription: sub,
              plan,
              usage,
              admin: req.auth!.token.agpAdmin === true,
              billingAvailable:!!state.providerSubscriptionId,
              deletionRequested:!!state.deletionRequested,
              release,
            });
          }
          if (action === "list"||action==='listPage') {
            const kind = z
              .enum([
                "groups",
                "posts",
                "campaigns",
                "jobs",
                "devices",
                "activity",
                "support",
              ])
              .parse(input.kind);
            const pageSize=z.number().int().min(1).max(500).parse(input.pageSize??500);
            let query:FirebaseFirestore.Query=user.collection(kind).orderBy(FieldPath.documentId());
            if(input.onlyActionable===true){if(kind!=='jobs')throw new Error('Actionable filter is only for jobs');query=query.where('status','in',['prepared','waiting_for_user','failed']);}
            if(input.after)query=query.startAfter(z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).parse(input.after));
            const s = await tx.get(query.limit(pageSize+1));
            const documents=s.docs.slice(0,pageSize);
            const items=documents.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  ...data,
                  ...(kind === "jobs" &&
                  data.expiresAt <= now &&
                  ["prepared", "waiting_for_user", "failed"].includes(
                    data.status,
                  )
                    ? { status: "expired" }
                    : {}),
                };
              });
            return finish(action==='listPage'?{items,nextCursor:s.size>pageSize?documents[documents.length-1].id:null}:items);
          }
          if(action==='reserveMedia'){
            const data=z.object({size:z.number().int().min(1).max(8*1024*1024),contentType:z.enum(['image/png','image/jpeg','image/webp'])}).parse(input);
            assertQuota(usage.mediaFiles||0,plan.mediaFiles??20);if((usage.mediaBytes||0)+data.size>(plan.mediaBytes??167772160))throw new Error('Media storage budget reached. Remove unused images or upgrade.');
            const id=randomUUID(),path=`agpMedia/${uid}/${id}`;
            tx.create(user.collection('mediaUploads').doc(id),{...data,path,createdAt:now,expiresAt:now+15*60000});tx.set(user,{usage:{mediaFiles:(usage.mediaFiles||0)+1,mediaBytes:(usage.mediaBytes||0)+data.size}},{merge:true});return finish({path});
          }
          if (action === "plans")
            return finish(
              Object.entries(config)
                .filter(([, p]) => p.enabled)
                .map(([id, p]) => ({ id, ...p, variantId: undefined })),
            );
          if (action === "saveGroup" || action === "savePost") {
            const kind = action === "saveGroup" ? "groups" : "posts";
            const data =
              kind === "groups"
                ? groupSchema.parse(input)
                : postSchema.parse(input);
            const id = input.id ? identifier.parse(input.id) : randomUUID();
            const ref = user.collection(kind).doc(id);
            const old = await tx.get(ref);
            if (kind === "posts") {
              for (const path of (data as any).media)
                if (!path.startsWith(`agpMedia/${uid}/`))
                  throw new Error("Media ownership mismatch");
              if((data as any).media.length){const records=await tx.getAll(...(data as any).media.map((path:string)=>user.collection('mediaUploads').doc(path.split('/').pop()!)));if(records.some(r=>!r.exists||(r.data() as any)?.deleting))throw new Error('An image is unavailable. Attach it again before saving.');}
            }
            if (!old.exists) assertQuota(usage[kind] || 0, plan[kind]);
            tx.set(ref, { ...data, updatedAt: now });
            if (!old.exists)
              tx.set(
                user,
                { usage: { [kind]: (usage[kind] || 0) + 1 } },
                { merge: true },
              );
            audit(action, { id });
            return finish({ id });
          }
          if (action === "deleteItem") {
            const kind = z.enum(["groups", "posts"]).parse(input.kind),
              id = identifier.parse(input.id);
            const ref = user.collection(kind).doc(id),
              snap = await tx.get(ref);
            if (snap.exists) {
              tx.delete(ref);
              tx.set(
                user,
                { usage: { [kind]: Math.max(0, (usage[kind] || 0) - 1) } },
                { merge: true },
              );
            }
            return finish({ ok: true });
          }
          if (action === "registerDevice") {
            const id = identifier.parse(input.id);
            const ref = user.collection("devices").doc(id);
            const snap = await tx.get(ref);
            if (snap.data()?.revoked)
              throw new Error(
                "Device revoked. Register a new device explicitly.",
              );
            if (!snap.exists) assertQuota(usage.devices || 0, plan.devices);
            tx.set(
              ref,
              {
                name: z.string().min(1).max(80).parse(input.name),
                revoked: false,
                lastSeen: now,
                version:z.string().regex(/^\d+\.\d+\.\d+$/).parse(input.version||'1.0.0'),
              },
              { merge: true },
            );
            if (!snap.exists)
              tx.set(
                user,
                { usage: { devices: (usage.devices || 0) + 1 } },
                { merge: true },
              );
            return finish({ id });
          }
          if (action === "revokeDevice") {
            const ref = user
              .collection("devices")
              .doc(identifier.parse(input.id));
            const s = await tx.get(ref);
            if (s.exists && !s.data()?.revoked) {
              tx.update(ref, { revoked: true });
              tx.set(
                user,
                { usage: { devices: Math.max(0, (usage.devices || 0) - 1) } },
                { merge: true },
              );
            }
            audit(action, { id: input.id });
            return finish({ ok: true });
          }
          if (action === "archiveCampaign") {
            const ref = user
              .collection("campaigns")
              .doc(identifier.parse(input.id));
            const campaign = await tx.get(ref);
            if (!campaign.exists) throw new Error("Campaign missing");
            if (campaign.data()?.archived) return finish({ ok: true });
            const jobs = await tx.get(
              user
                .collection("jobs")
                .where("campaignId", "==", ref.id)
                .limit(100),
            );
            tx.update(ref, { archived: true, archivedAt: now });
            for (const job of jobs.docs)
              if (
                ["prepared", "waiting_for_user", "failed"].includes(
                  job.data().status,
                )
              )
                tx.update(job.ref, { status: "cancelled", updatedAt: now });
            tx.set(
              user,
              { usage: { campaigns: Math.max(0, (usage.campaigns || 0) - 1) } },
              { merge: true },
            );
            audit(action, { id: ref.id });
            return finish({ ok: true });
          }
          if (action === "createCampaign") {
            const data = z
              .object({
                requestId: identifier,
                name: z.string().min(1).max(120),
                postId: identifier,
                groupIds: z.array(identifier).min(1).max(100),
                deviceId: identifier,
                scheduledAt: z.number().finite().optional(),
              })
              .parse(input);
            const campaignRef = user
              .collection("campaigns")
              .doc(data.requestId);
            if ((await tx.get(campaignRef)).exists)
              return finish({ id: data.requestId });
            assertQuota(usage.campaigns || 0, plan.campaigns);
            if (data.scheduledAt && data.scheduledAt > now && !plan.scheduling)
              throw new Error("Scheduling requires an eligible plan");
            const post = await tx.get(
              user.collection("posts").doc(data.postId),
            );
            const device = await tx.get(
              user.collection("devices").doc(data.deviceId),
            );
            const ids = [...new Set(data.groupIds)];
            const groups = await tx.getAll(
              ...ids.map((id) => user.collection("groups").doc(id)),
            );
            if (
              !post.exists ||
              !device.exists ||
              device.data()?.revoked ||
              groups.some((g) => !g.exists)
            )
              throw new Error("Post, destinations or device unavailable");
            const due = Math.max(now, data.scheduledAt || now);
            if (due > now + 90 * 86400000)
              throw new Error("Schedule within 90 days");
            tx.create(campaignRef, {
              name: data.name,
              createdAt: now,
              scheduledAt: due,
              deviceId: data.deviceId,
              postId: data.postId,
            });
            for (const g of groups)
              tx.create(
                user.collection("jobs").doc(
                  createHash("sha256")
                    .update(data.requestId + ":" + g.id)
                    .digest("hex"),
                ),
                {
                  campaignId: data.requestId,
                  deviceId: data.deviceId,
                  group: g.data(),
                  post: post.data(),
                  status: "prepared",
                  dueAt: due,
                  expiresAt: due + 7 * 86400000,
                  createdAt: now,
                  attempts: 0,
                },
              );
            tx.set(
              user,
              { usage: { campaigns: (usage.campaigns || 0) + 1 } },
              { merge: true },
            );
            audit(action, { id: data.requestId });
            return finish({ id: data.requestId });
          }
          if (action === "jobs") {
            const id = identifier.parse(input.deviceId),
              device = user.collection("devices").doc(id);
            const d = await tx.get(device);
            if (!d.exists || d.data()?.revoked)
              throw new Error("Device unavailable");
            const version=z.string().regex(/^\d+\.\d+\.\d+$/).parse(input.version||d.data()?.version||'0.0.0');
            if (
              versionOlder(version, release.minimumVersion)
            )
              throw new Error("Update the extension before receiving jobs.");
            const jobs = await tx.get(
              user.collection("jobs").where("deviceId", "==", id).where('status','in',['prepared','waiting_for_user']).where('dueAt','<=',now).where('expiresAt','>',now).orderBy('dueAt').orderBy('expiresAt').limit(200),
            );
            tx.update(device, { lastSeen: now,version });
            return finish(
              jobs.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter(
                  (j: any) =>
                    j.dueAt <= now &&
                    j.expiresAt > now &&
                    ["prepared", "waiting_for_user"].includes(j.status),
                ),
            );
          }
          if (action === "transitionJob") {
            const ref = user.collection("jobs").doc(identifier.parse(input.id));
            const s = await tx.get(ref);
            if (!s.exists) throw new Error("Job missing");
            const job = s.data()!;
            const d = await tx.get(
              user.collection("devices").doc(job.deviceId),
            );
            if (
              !d.exists ||
              (d.data()?.revoked && input.status !== "cancelled")
            )
              throw new Error("Device revoked");
            if (
              input.status !== "cancelled" &&
              versionOlder(d.data()?.version || "0.0.0", release.minimumVersion)
            )
              throw new Error("Update the extension before processing jobs.");
            if (
              input.status !== "cancelled" &&
              job.dueAt > job.createdAt &&
              !plan.scheduling
            )
              throw new Error(
                "Your current plan does not permit scheduled preparation.",
              );
            if (job.expiresAt <= now && input.status !== "cancelled")
              throw new Error("Job expired");
            if (job.dueAt > now && input.status !== "cancelled")
              throw new Error("This preparation task is not due yet.");
            const status = z
              .enum([
                "prepared",
                "waiting_for_user",
                "user_confirmed",
                "failed",
                "cancelled",
              ])
              .parse(input.status);
            assertTransition(job.status, status);
            if (status === "user_confirmed" && input.confirmed !== true)
              throw new Error("Explicit confirmation required");
            if (status === "prepared" && (job.attempts || 0) >= 3)
              throw new Error("Retry limit reached");
            tx.update(ref, {
              status,
              updatedAt: now,
              attempts: (job.attempts || 0) + (status === "prepared" ? 1 : 0),
              confirmation:
                status === "user_confirmed"
                  ? "User attestation; not platform verified"
                  : null,
            });
            audit(action, { id: s.id, status });
            return finish({ ok: true });
          }
          if (action === "support" || action === "deleteAccountRequest") {
            const id = randomUUID();
            const request = {
              uid,
              kind: action,
              message: z.string().min(1).max(4000).parse(input.message),
              createdAt: now,
              status: "pending",
            };
            tx.create(user.collection("support").doc(id), request);
            tx.create(db.collection("agpSupportQueue").doc(id), request);
            if(action==='deleteAccountRequest'){tx.set(user,{deletionRequested:true},{merge:true});tx.set(db.doc('workspace_locks/'+uid),{deleting:true,updated_at:FieldValue.serverTimestamp()},{merge:true});tx.set(db.doc(`agpDeletionRequests/${uid}`),{uid,status:'pending',requestedAt:now,providerSubscriptionId:state.providerSubscriptionId||null},{merge:true});}
            return finish({ ok: true });
          }
          if (action.startsWith("admin.")) {
            if (req.auth!.token.agpAdmin !== true)
              throw new HttpsError(
                "permission-denied",
                "Administrator access required",
              );
            if(action==='admin.completeDeletion'){const target=identifier.parse(input.uid);if(input.confirmation!==target)throw new Error('Type the exact account ID to confirm deletion.');return finish({external:'deleteAccount',targetUid:target});}
            if (action === "admin.overview") {
              const users = await tx.get(db.collection("agpUsers").limit(200));
              const events = await tx.get(
                db
                  .collection("agpSubscriptionEvents")
                  .orderBy("at", "desc")
                  .limit(30),
              );
              const support = await tx.get(
                db.collection("agpSupportQueue").limit(100),
              );
              const audit = await tx.get(
                db.collection("agpAdminAudit").orderBy("at", "desc").limit(50),
              );
              const payments = await tx.get(
                db.collection("agpPayments").orderBy("at", "desc").limit(100),
              );
              const errors = await tx.get(
                db.collection("agpErrors").orderBy("at", "desc").limit(50),
              );
              return finish({
                users: users.docs.map((d) => ({ id: d.id, ...d.data() })),
                events: events.docs.map((d) => ({ id: d.id, ...d.data() })),
                support: support.docs.map((d) => ({ id: d.id, ...d.data() })),
                audit: audit.docs.map((d) => ({ id: d.id, ...d.data() })),
                payments: payments.docs.map((d) => ({ id: d.id, ...d.data() })),
                errors: errors.docs.map((d) => ({ id: d.id, ...d.data() })),
                plans: config,
                release,
              });
            }
            if (action === "admin.plan") {
              const id = identifier.parse(input.id);
              const p = planSchema.parse(input.plan);
              tx.set(db.collection("agpPlans").doc(id), p);
            } else if (action === "admin.release") {
              const value = z
                .object({
                  currentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
                  minimumVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
                  notes: z.string().max(4000),
                  supportUrl: z
                    .string()
                    .url()
                    .refine((v) => v.startsWith("https://")),
                })
                .parse(input);
              tx.set(db.doc("agpConfig/release"), value);
            } else if (action === "admin.support") {
              const id = identifier.parse(input.id);
              const ref = db.collection("agpSupportQueue").doc(id);
              const item = await tx.get(ref);
              if (!item.exists) throw new Error("Request missing");
              const status = z
                .enum(["pending", "in_progress", "resolved"])
                .parse(input.status);
              tx.update(ref, { status, updatedAt: now });
              tx.update(root(item.data()!.uid).collection("support").doc(id), {
                status,
                updatedAt: now,
              });
            } else if (action === "admin.access") {
              const target = root(identifier.parse(input.uid));
              await tx.get(target);
              const grant = z
                .object({
                  suspended: z.boolean(),
                  planId: identifier,
                  validUntil: z
                    .number()
                    .min(now)
                    .max(now + 366 * 86400000),
                })
                .parse(input);
              if (!config[grant.planId]) throw new Error("Unknown plan");
              tx.set(
                target,
                {
                  suspended: grant.suspended,
                  subscription: {
                    planId: grant.planId,
                    status: "promotional",
                    validUntil: grant.validUntil,
                  },
                },
                { merge: true },
              );
            } else throw new Error("Unknown admin action");
            tx.create(db.collection("agpAdminAudit").doc(), {
              uid,
              action,
              at: now,
              target: input.uid || input.id || "configuration",
            });
            return finish({ ok: true });
          }
          // External calls must never execute inside a retryable transaction.
          if (action === "checkout" && state.providerSubscriptionId&&state.subscription?.status!=='expired')
            throw new Error(
              "This account already has a provider subscription. Use Manage billing to change or resume your plan, or contact support.",
            );
          if (action === "checkout") {
            const selected = config[identifier.parse(input.planId)];
            if (!selected?.enabled || !selected.variantId)
              throw new Error("This plan is not available for checkout");
            if (state.checkoutPendingUntil > now) {
              if (state.checkoutPlanId !== input.planId)
                throw new Error(
                  "A checkout is already pending for another plan. Finish it or try again after it expires.",
                );
              if (state.checkoutUrl) return finish({ url: state.checkoutUrl });
              throw new Error(
                "Checkout is being prepared. Please try again shortly.",
              );
            }
            tx.set(
              user,
              {
                checkoutPlanId: input.planId,
                checkoutPendingUntil: now + 120000,
                checkoutUrl: FieldValue.delete(),
                checkoutIntent:{nonce:randomUUID(),previousSubscriptionId:state.providerSubscriptionId||null,planId:input.planId},
              },
              { merge: true },
            );
          }
          if (action === "checkout" || action === "portal")
            return finish({
              external: action,
              planId: input.planId,
              subscriptionId: state.providerSubscriptionId,
              checkoutIntent:action==='checkout'?null:undefined,
            });
          throw new Error("Unknown action");
        })
        .then(async (result: any) => {
          if(result?.external==='deleteAccount')return completeDeletion(result.targetUid,uid,provider());
          if (result?.external === "checkout") {
            const p = config[identifier.parse(result.planId)];
            if (!p?.enabled || !p.variantId)
              throw new Error("This plan is not available for checkout");
            const url = await provider().checkout(
              uid,
              String(req.auth!.token.email),
              p.variantId,
              (await user.get()).data()?.checkoutIntent?.nonce,
            );
            await user.set(
              {
                checkoutUrl: url,
                checkoutPendingUntil: Date.now() + 30 * 60000,
              },
              { merge: true },
            );
            return { url };
          }
          if (result?.external === "portal") {
            if (!result.subscriptionId)
              throw new Error("No provider subscription found");
            const s = await provider().subscription(result.subscriptionId);
            return { url: s.attributes.urls.customer_portal };
          }
          return result;
        });
    } catch (e) {
      if (!(e instanceof HttpsError && e.code === "resource-exhausted"))
        await db
          .collection("agpErrors")
          .add({
            uid,
            action,
            at: Date.now(),
            code: e instanceof HttpsError ? e.code : "failed-precondition",
          })
          .catch(() => {});
      if (e instanceof HttpsError) throw e;
      throw new HttpsError(
        "failed-precondition",
        e instanceof Error ? e.message : "Request failed",
      );
    }
  },
);
export const agpWebhook = onRequest(
  { secrets: [apiKey, webhookSecret], maxInstances: 10 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.sendStatus(405);
      return;
    }
    if (
      !verifySignature(
        req.rawBody,
        req.get("X-Signature") || "",
        webhookSecret.value(),
      )
    ) {
      res.sendStatus(401);
      return;
    }
    try {
      const payload = req.body;
      const name = String(payload.meta?.event_name || "");
      const id = eventId(req.rawBody);
      const event = db.collection("agpSubscriptionEvents").doc(id);
      if ((await event.get()).exists) {
        res.sendStatus(200);
        return;
      }
      const attrs = payload.data?.attributes || {};
      if (
        Boolean(attrs.test_mode) !==
        (process.env.LEMON_TEST_MODE !== "false")
      )
        throw new Error("Payment environment mismatch");
      const subscriptionId =
        payload.data?.type === "subscriptions"
          ? String(payload.data.id)
          : attrs.subscription_id
            ? String(attrs.subscription_id)
            : null;
      if (!subscriptionId) {
        await event.set({
          name,
          at: Date.now(),
          status: "ignored-non-subscription",
        });
        res.sendStatus(200);
        return;
      }
      // Fetch authoritative state to prevent out-of-order event replay from restoring stale access.
      const current = await provider().subscription(subscriptionId);
      const a = current.attributes;
      if (String(a.store_id) !== process.env.LEMON_STORE_ID)
        throw new Error("Wrong store");
      let uid = payload.meta?.custom_data?.uid;
      const association=await db.doc('agpSubscriptions/'+subscriptionId).get();
      if(association.data()?.retired||association.data()?.deleted){await event.set({name,subscriptionId,at:Date.now(),status:'ignored-retired'});res.sendStatus(200);return;}
      if(association.exists)uid=association.data()!.uid;
      const mapped = await db
        .collection("agpUsers")
        .where("providerSubscriptionId", "==", subscriptionId)
        .limit(1)
        .get();
      if (!mapped.empty) uid = mapped.docs[0].id;
      if (!uid) throw new Error("Subscription owner not mapped");
      identifier.parse(uid);
      const config = await plans();
      const entry = Object.entries(config).find(
        ([, p]) => String(p.variantId) === String(a.variant_id),
      );
      if (!entry) throw new Error("Unknown payment variant");
      await db.runTransaction(async (tx) => {
        if ((await tx.get(event)).exists) return;
        const u = root(uid);
        const state = (await tx.get(u)).data();
        if(state?.deletionRequested){tx.create(event,{uid,name,subscriptionId,at:Date.now(),status:'ignored-deletion-pending'});return;}
        const replacing=!!state?.providerSubscriptionId&&state.providerSubscriptionId!==subscriptionId;
        if (
          replacing&&!(state?.subscription?.status==='expired'&&state?.checkoutIntent?.nonce===payload.meta?.custom_data?.checkoutIntent&&state?.checkoutIntent?.planId===entry[0])
        )
          throw new Error("Subscription conflict requires reconciliation");
        const normalized=providerState(a),end=normalized.validUntil;
        const providerUpdatedAt = Date.parse(a.updated_at || "") || 0;
        if (!replacing&&state?.providerUpdatedAt > providerUpdatedAt) {
          tx.create(event, {
            uid,
            name,
            subscriptionId,
            at: Date.now(),
            status: "ignored-stale",
          });
          return;
        }
        const refunded = name === "subscription_payment_refunded";
        const refundUntil = refunded
          ? Number.isFinite(end)
            ? end
            : Date.now() + 31536000000
          : replacing?0:state?.refundUntil || 0;
        const status =
          refunded ||
          (refundUntil > 0 && Number.isFinite(end) && end <= refundUntil)
            ? "refunded"
            : normalized.status;
        if(replacing)tx.set(db.doc('agpSubscriptions/'+state!.providerSubscriptionId),{uid,retired:true,replacedBy:subscriptionId},{merge:true});
        tx.set(db.doc('agpSubscriptions/'+subscriptionId),{uid,retired:false,updatedAt:Date.now()},{merge:true});
        tx.set(
          u,
          {
            providerSubscriptionId: subscriptionId,
            providerUpdatedAt,
            refundUntil,
            subscription: {
              planId: entry[0],
              status,
              validUntil: Number.isFinite(end) ? end : 0,
            },
            billingUpdatedAt: Date.now(),
            checkoutUrl: FieldValue.delete(),
            checkoutPendingUntil: FieldValue.delete(),
            checkoutPlanId: FieldValue.delete(),
            checkoutIntent:FieldValue.delete(),
          },
          { merge: true },
        );
        tx.create(event, {
          uid,
          name,
          subscriptionId,
          at: Date.now(),
          status: "processed",
          testMode: !!a.test_mode,
        });
        if (payload.data?.type === "subscription-invoices")
          tx.set(db.collection("agpPayments").doc(String(payload.data.id)), {
            uid,
            subscriptionId,
            providerReference: String(payload.data.id),
            status: attrs.status || name,
            total: typeof attrs.total === "number" ? attrs.total : 0,
            currency: String(attrs.currency || ""),
            refunded: !!attrs.refunded,
            testMode: !!attrs.test_mode,
            at: Date.parse(attrs.updated_at || "") || Date.now(),
          });
      });
      res.sendStatus(200);
    } catch {
      await db
        .collection("agpErrors")
        .add({
          action: "webhook",
          at: Date.now(),
          code: "processing-failed",
          eventHash: eventId(req.rawBody),
        })
        .catch(() => {});
      res.status(500).send("Webhook processing failed; retry required");
    }
  },
);
export const agpMaintenance = onSchedule("every 24 hours", async () => {
  const expired = await db
    .collectionGroup("limits")
    .where("expiresAt", "<", new Date())
    .limit(400)
    .get();
  const batch = db.batch();
  expired.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await cleanupMedia();
});
