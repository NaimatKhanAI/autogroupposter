import { describe, it, expect } from "vitest";
import {
  normalizeGroupUrl,
  assertQuota,
  effectivePlan,
  assertTransition,
  groupSchema,
  postSchema,
  planSchema,
  freePlan,
} from "../packages/shared/domain";
import { verifySignature, eventId } from "../functions/src/payments";
import { createHmac } from "node:crypto";
describe("destination authorization", () => {
  it("canonicalizes groups", () =>
    expect(
      normalizeGroupUrl("https://m.facebook.com/groups/123/?ref=share"),
    ).toBe("https://www.facebook.com/groups/123"));
  it.each([
    "http://facebook.com/groups/1",
    "https://facebook.com.evil.com/groups/1",
    "https://facebook.com@evil.com/groups/1",
    "https://www.facebook.com/groups/1/posts/2",
    "https://www.facebook.com:444/groups/1",
    "javascript:alert(1)",
  ])("rejects unsafe destination %s", (u) =>
    expect(() => normalizeGroupUrl(u)).toThrow(),
  );
  it("validates group names", () =>
    expect(() =>
      groupSchema.parse({ name: "", url: "https://facebook.com/groups/1" }),
    ).toThrow());
});
describe("backend entitlement policy", () => {
  it("enforces exact quota boundary", () => {
    expect(() => assertQuota(2, 3)).not.toThrow();
    expect(() => assertQuota(3, 3)).toThrow();
    expect(() => assertQuota(0, 0)).toThrow();
  });
  it.each(["expired", "past_due", "unpaid", "paused", "refunded"])(
    "restricts %s subscriptions",
    (status) =>
      expect(
        effectivePlan({ status, planId: "pro", validUntil: 200 }, 100),
      ).toBe("free"),
  );
  it("expires trials", () =>
    expect(
      effectivePlan(
        { status: "trialing", planId: "trial", validUntil: 100 },
        100,
      ),
    ).toBe("free"));
  it("allows cancelled paid-through period", () =>
    expect(
      effectivePlan(
        { status: "cancelled", planId: "pro", validUntil: 200 },
        100,
      ),
    ).toBe("pro"));
  it("allows recovery after payment", () =>
    expect(
      effectivePlan({ status: "active", planId: "pro", validUntil: 200 }, 100),
    ).toBe("pro"));
  it("validates configurable plans", () => {
    expect(planSchema.parse(freePlan)).toEqual(freePlan);
    expect(() => planSchema.parse({ ...freePlan, devices: -1 })).toThrow();
  });
});
describe("honest assistant lifecycle", () => {
  it("requires waiting before user confirmation", () =>
    expect(() => assertTransition("prepared", "user_confirmed")).toThrow());
  it("prevents fabricated platform confirmation", () =>
    expect(() =>
      assertTransition("waiting_for_user", "platform_confirmed"),
    ).toThrow());
  it("allows review and confirmation", () => {
    assertTransition("prepared", "waiting_for_user");
    assertTransition("waiting_for_user", "user_confirmed");
  });
  it("does not replay a completed job", () =>
    expect(() => assertTransition("user_confirmed", "prepared")).toThrow());
  it("allows cancellation and controlled retry", () => {
    assertTransition("prepared", "cancelled");
    assertTransition("failed", "prepared");
  });
});
describe("cryptographic payment ingress", () => {
  const raw = Buffer.from('{"data":"test"}'),
    secret = "sandbox-test-secret";
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  it("accepts signed raw bytes", () =>
    expect(verifySignature(raw, sig, secret)).toBe(true));
  it("rejects tampering", () =>
    expect(verifySignature(Buffer.from("tampered"), sig, secret)).toBe(false));
  it.each(["", "x", "a".repeat(62), "g".repeat(64)])(
    "rejects malformed signature %s",
    (s) => expect(verifySignature(raw, s, secret)).toBe(false),
  );
  it("rejects incorrect key", () =>
    expect(verifySignature(raw, sig, "wrong")).toBe(false));
  it("gives retries the same event identity", () =>
    expect(eventId(raw)).toBe(eventId(Buffer.from(raw))));
});
describe("content validation", () => {
  it("rejects empty posts", () =>
    expect(() => postSchema.parse({ title: "Hello", text: "" })).toThrow());
  it("limits image count", () =>
    expect(() =>
      postSchema.parse({ title: "Hi", text: "Hi", media: Array(5).fill("x") }),
    ).toThrow());
});
