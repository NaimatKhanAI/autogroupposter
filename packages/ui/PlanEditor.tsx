import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
export function PlanEditor({
  plans,
  busy,
  execute,
}: {
  plans: Record<string, any>;
  busy: boolean;
  execute: (action: string, input: any) => void;
}) {
  const [selected, setSelected] = useState("free");
  const value = plans?.[selected] || {
    name: "",
    groups: 100,
    posts: 100,
    campaigns: 50,
    devices: 3,
    trialDays: 14,mediaFiles:20,mediaBytes:167772160,
    interval: "month",
    displayPrice: "",
    variantId: "",
    enabled: false,
    scheduling: false,
  };
  return (
    <section className="card">
      <div className="card-heading">
        <div>
          <h2>Plan configuration</h2>
          <p className="muted">
            Set capacity, billing details and feature availability.
          </p>
        </div>
      </div>
      <label htmlFor="edit-plan">Select a plan</label>
      <select
        id="edit-plan"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {Object.keys(plans || {}).map((id) => (
          <option key={id} value={id}>
            {plans[id].name} · {id}
          </option>
        ))}
        <option value="new">Create a new plan</option>
      </select>
      <form
        key={selected + JSON.stringify(value)}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          execute("admin.plan", {
            id: selected === "new" ? String(f.get("id")) : selected,
            plan: {
              name: String(f.get("name")),
              enabled: f.has("enabled"),
              scheduling: f.has("scheduling"),
              groups: Number(f.get("groups")),
              posts: Number(f.get("posts")),
              campaigns: Number(f.get("campaigns")),
              devices: Number(f.get("devices")),
              trialDays: Number(f.get("trialDays")),mediaFiles:Number(f.get("mediaFiles")),mediaBytes:Number(f.get("mediaBytes")),
              interval: String(f.get("interval")),
              displayPrice: String(f.get("displayPrice")),
              variantId: String(f.get("variantId")),
            },
          });
        }}
      >
        <div className="form-grid">
          <div>
            <label htmlFor="plan-name">Plan name</label>
            <input
              id="plan-name"
              name="name"
              defaultValue={value.name}
              required
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="plan-identity">Plan identifier</label>
            <input
              id="plan-identity"
              name="id"
              defaultValue={selected === "new" ? "" : selected}
              disabled={selected !== "new"}
              placeholder="e.g. pro-monthly"
              pattern="[A-Za-z0-9_\-]+"
              maxLength={128}
              required
            />
          </div>
        </div>
        <div className="form-section">
          <h3>Usage limits</h3>
          <div className="form-grid">
            {[
              ["groups", "Saved groups", 10000],
              ["posts", "Saved drafts", 10000],
              ["campaigns", "Active campaigns", 10000],
              ["devices", "Connected browsers", 100],
              ["trialDays", "Trial duration (days)", 90],["mediaFiles","Stored image limit",40000],["mediaBytes","Media budget (bytes)",1099511627776],
            ].map(([key, label, max]) => (
              <div key={key}>
                <label htmlFor={"plan-" + key}>{label}</label>
                <input
                  id={"plan-" + key}
                  type="number"
                  name={String(key)}
                  defaultValue={value[String(key)]??(key==="mediaFiles"?20:key==="mediaBytes"?167772160:0)}
                  min={0}
                  max={Number(max)}
                  required
                />
              </div>
            ))}
          </div>
        </div>
        <div className="form-section">
          <h3>Billing details</h3>
          <div className="form-grid">
            <div>
              <label htmlFor="plan-interval">Billing interval</label>
              <select
                id="plan-interval"
                name="interval"
                defaultValue={value.interval}
              >
                <option value="free">Free / no recurring charge</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div>
              <label htmlFor="plan-price">Price shown to customers</label>
              <input
                id="plan-price"
                name="displayPrice"
                defaultValue={value.displayPrice}
                maxLength={80}
                placeholder="Match your hosted checkout price"
              />
            </div>
            <div className="full">
              <label htmlFor="plan-variant">Payment provider variant ID</label>
              <input
                id="plan-variant"
                name="variantId"
                pattern="[0-9]*"
                defaultValue={value.variantId}
              />
              <small className="field-hint">
                Use the variant for the current merchant environment. Leave
                blank for a free plan.
              </small>
            </div>
          </div>
        </div>
        <div className="form-section">
          <label className="checkbox-row">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={value.enabled}
            />
            <span>
              <strong>Make this plan available</strong>
              <small>
                Customers can see enabled plans in their billing workspace.
              </small>
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              name="scheduling"
              defaultChecked={value.scheduling}
            />
            <span>
              <strong>Scheduled preparation</strong>
              <small>Allow campaigns to be prepared at a future time.</small>
            </span>
          </label>
        </div>
        <div className="actions">
          <button disabled={busy}>
            <Save size={15} />
            Save plan
          </button>
        </div>
      </form>
    </section>
  );
}
