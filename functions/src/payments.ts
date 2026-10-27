import { createHmac, timingSafeEqual, createHash } from "node:crypto";
export function verifySignature(
  raw: Buffer,
  signature: string,
  secret: string,
) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function eventId(raw: Buffer) {
  return createHash("sha256").update(raw).digest("hex");
}
export interface PaymentProvider {
  checkout(uid: string, email: string, variant: string, intent?:string): Promise<string>;
  subscription(id: string): Promise<any>;
  cancelSubscription(id:string):Promise<any>;
}
export function providerState(a:any){const status=a.status==='on_trial'?'trialing':String(a.status);const end=Date.parse(status==='trialing'?a.trial_ends_at||a.renews_at||'':a.ends_at||a.renews_at||'');return {status,validUntil:Number.isFinite(end)?end:0};}
export class LemonProvider implements PaymentProvider {
  constructor(
    private key: string,
    private store: string,
    private test: boolean,
    private website: string,
  ) {}
  async request(path: string, method = "GET", body?: unknown) {
    const res = await fetch("https://api.lemonsqueezy.com/v1/" + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.key}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error("Payment provider temporarily unavailable");
    return ((await res.json()) as any).data;
  }
  async checkout(uid: string, email: string, variant: string, intent?:string) {
    const d = await this.request("checkouts", "POST", {
      data: {
        type: "checkouts",
        attributes: {
          test_mode: this.test,
          checkout_data: { email, custom: { uid,...(intent?{checkoutIntent:intent}:{}) } },
          expires_at:new Date(Date.now()+30*60000).toISOString(),
          product_options: { redirect_url: this.website + "/payment-success" },
        },
        relationships: {
          store: { data: { type: "stores", id: this.store } },
          variant: { data: { type: "variants", id: variant } },
        },
      },
    });
    return d.attributes.url;
  }
  async subscription(id: string) {
    return this.request("subscriptions/" + encodeURIComponent(id));
  }
  async cancelSubscription(id:string){return this.request('subscriptions/'+encodeURIComponent(id),'DELETE');}
}
