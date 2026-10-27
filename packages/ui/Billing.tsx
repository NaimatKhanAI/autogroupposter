import React from "react";
import { Check, ArrowUpRight } from "lucide-react";
import { Status } from "./Design";
export function Billing({
  workspace,
  groups,
  posts,
  campaigns,
  plans,
  busy,
  open,
}: {
  workspace: any;
  groups: any[];
  posts: any[];
  campaigns: any[];
  plans: any[];
  busy: boolean;
  open: (action: "portal" | "checkout", id?: string) => void;
}) {
  const s = workspace?.subscription,
    hasPortal =
      (workspace?.billingAvailable??(s &&
      s.planId !== "free" &&
      !["trialing", "promotional"].includes(s.status)));
  return (
    <>
      <section className="card billing-summary">
        <div>
          <span className="section-label">CURRENT PLAN</span>
          <div className="row">
            <h2 style={{ margin: 0, fontSize: 22 }}>
              {workspace?.plan?.name || "Loading plan"}
            </h2>
            <Status value={s?.status || "loading"} />
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 11 }}>
            {s?.planId==='free'?'Core workspace access, within your free plan limits.':<>{s?.status === "trialing" ? "Trial ends" : "Access period ends"}{' '}{s?.validUntil ? new Date(s.validUntil).toLocaleDateString() : ""}</>}
          </p>
          <button
            className="ghost"
            disabled={busy || !hasPortal}
            onClick={() => open("portal")}
          >
            Manage billing & invoices
            <ArrowUpRight size={14} />
          </button>
          {!hasPortal && (
            <small className="field-hint">
              A billing portal is available after a subscription purchase.
            </small>
          )}
        </div>
        <div className="billing-usage">
          {[
            ["Groups", groups.length, workspace?.plan?.groups],
            ["Drafts", posts.length, workspace?.plan?.posts],
            [
              "Campaigns",
              campaigns.filter((c) => !c.archived).length,
              workspace?.plan?.campaigns,
            ],
          ].map(([label, count, limit]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>
                {count}{" "}
                <span
                  className="muted"
                  style={{ fontSize: 12, fontWeight: 400 }}
                >
                  / {limit}
                </span>
              </strong>
            </div>
          ))}
        </div>
      </section>
      <div className="card-heading">
        <div>
          <h2>Available plans</h2>
          <p className="muted">Choose the capacity that fits your routine.</p>
        </div>
      </div>
      <div className="grid">
        {plans.map((p) => (
          <section className="card plan-card" key={p.id}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{p.name}</h2>
              {s?.planId === p.id && (
                <span className="badge">Current plan</span>
              )}
            </div>
            <div className="stat">
              {p.displayPrice || "See hosted checkout"}
            </div>
            <small>
              {p.interval === "month"
                ? "Monthly billing"
                : p.interval === "year"
                  ? "Yearly billing"
                  : "Core workspace access"}
            </small>
            <ul className="plan-features">
              {[
                `${p.groups} saved groups`,
                `${p.posts} saved drafts`,
                `${p.campaigns} active campaigns`,
                `${p.devices} connected browsers`,
                p.scheduling
                  ? "Scheduled preparation"
                  : "On-demand preparation",
              ].map((feature) => (
                <li key={feature}>
                  <Check size={14} />
                  {feature}
                </li>
              ))}
            </ul>
            {p.interval !== "free" ? (
              <button disabled={busy} onClick={() => open("checkout", p.id)}>
                Choose {p.name}
                <ArrowUpRight size={14} />
              </button>
            ) : (
              <span className="panel-footer">Included core features</span>
            )}
          </section>
        ))}
      </div>
      <div className="notice">
        Paid plans renew at the interval and price shown at hosted checkout.
        Cancel future renewals in the provider billing portal. Paid access is
        activated only after verified provider confirmation.
      </div>
    </>
  );
}
