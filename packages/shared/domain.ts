import { z } from "zod";
export function versionOlder(version: string, minimum: string) {
  const a = version.split(".").map(Number),
    b = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  }
  return false;
}
export const groupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().transform(normalizeGroupUrl),
  category: z.string().trim().max(80).default("General"),
});
export function normalizeGroupUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    !["facebook.com", "www.facebook.com", "m.facebook.com"].includes(
      u.hostname,
    ) ||
    u.username ||
    u.password ||
    u.port ||
    !/^\/groups\/[A-Za-z0-9._-]+\/?$/.test(u.pathname)
  )
    throw new Error("Use an HTTPS Facebook group URL, without extra paths.");
  return "https://www.facebook.com" + u.pathname.replace(/\/$/, "");
}
export const postSchema = z.object({
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(20000),
  media: z.array(z.string().max(400)).max(4).default([]),
  template: z.boolean().default(false),
});
export const planSchema = z.object({
  name: z.string().min(1).max(80),
  enabled: z.boolean(),
  groups: z.number().int().min(0).max(10000),
  posts: z.number().int().min(0).max(10000),
  campaigns: z.number().int().min(0).max(10000),
  devices: z.number().int().min(0).max(100),
  trialDays: z.number().int().min(0).max(90),
  scheduling: z.boolean(),
  variantId: z.string().regex(/^\d*$/),
  displayPrice: z.string().max(80),
  interval: z.enum(["free", "month", "year"]),
  mediaFiles:z.number().int().min(0).max(40000).default(20),
  mediaBytes:z.number().int().min(0).max(1099511627776).default(167772160),
});
export type Plan = z.infer<typeof planSchema>;
export type Subscription = {
  planId: string;
  status: string;
  validUntil: number;
  trialUntil?: number;
};
export function entitled(s: Subscription | undefined, now = Date.now()) {
  return (
    !!s &&
    ["active", "cancelled", "trialing", "promotional"].includes(s.status) &&
    s.validUntil > now
  );
}
export function effectivePlan(s: Subscription | undefined, now = Date.now()) {
  return entitled(s, now) ? s!.planId : "free";
}
export function assertQuota(used: number, limit: number) {
  if (used >= limit)
    throw new Error("Plan limit reached. Upgrade or remove an existing item.");
}
export const transitions: Record<string, string[]> = {
  prepared: ["waiting_for_user", "cancelled", "failed"],
  waiting_for_user: ["user_confirmed", "cancelled", "failed"],
  failed: ["prepared", "cancelled"],
  user_confirmed: [],
  platform_confirmed: [],
  cancelled: [],
};
export function assertTransition(from: string, to: string) {
  if (!transitions[from]?.includes(to))
    throw new Error("Invalid job transition");
}
export const freePlan: Plan = {
  name: "Free",
  enabled: true,
  groups: 3,
  posts: 5,
  campaigns: 2,
  devices: 1,
  trialDays: 14,
  scheduling: false,
  variantId: "",
  displayPrice: "Free",
  interval: "free",
  mediaFiles:20,
  mediaBytes:167772160,
};
