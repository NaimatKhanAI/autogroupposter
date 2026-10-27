import React, { useState } from "react";
import {
  Search,
  Users,
  CreditCard,
  Clock,
  Shield,
  Layers,
  LifeBuoy,
  Monitor,
} from "lucide-react";
import { AdminExtras } from "./AdminExtras";
import { PlanEditor } from "./PlanEditor";
import { Empty, Status } from "./Design";
export function Admin({
  data,
  busy,
  execute,
}: {
  data: any;
  busy: boolean;
  execute: (action: string, input: any) => void;
}) {
  const [tab, setTab] = useState("Customers"),
    [search, setSearch] = useState("");
  const users = data?.users || [];
  return (
    <>
      <div className="grid stats-grid">
        {[
          ["Registered accounts", users.length, Users],
          [
            "Active subscribers",
            users.filter(
              (u: any) =>
                u.providerSubscriptionId &&
                ["active", "cancelled"].includes(u.subscription?.status) &&
                u.subscription.validUntil > Date.now(),
            ).length,
            CreditCard,
          ],
          [
            "Trial accounts",
            users.filter(
              (u: any) =>
                u.subscription?.status === "trialing" &&
                u.subscription.validUntil > Date.now(),
            ).length,
            Clock,
          ],
          [
            "Suspended accounts",
            users.filter((u: any) => u.suspended).length,
            Shield,
          ],
        ].map(([title, n, Icon]) => {
          const I = Icon as typeof Users;
          return (
            <div className="card stat-card" key={title as string}>
              <div className="stat-label">
                <span>{title as string}</span>
                <I size={17} />
              </div>
              <div className="stat">{n as number}</div>
              <small>In the first 200 loaded accounts</small>
            </div>
          );
        })}
      </div>
      <nav className="admin-panel-tabs" aria-label="Owner console sections">
        {[
          "Customers",
          "Plans",
          "Payments",
          "Requests",
          "Security",
          "Releases",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "Customers" && (
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Customer access</h2>
              <p className="muted">
                Review subscriptions and grant time-limited promotional access.
              </p>
            </div>
            <span className="badge">{users.length} accounts</span>
          </div>
          <div className="admin-toolbar">
            <label className="sr-only" htmlFor="customer-search">
              Search loaded customers
            </label>
            <input
              id="customer-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or account ID"
            />
          </div>
          {users
            .filter((u: any) =>
              `${u.email} ${u.id}`.toLowerCase().includes(search.toLowerCase()),
            )
            .map((u: any) => (
              <div className="listitem customer-row" key={u.id}>
                <div className="row between">
                  <div className="customer-identity">
                    <span className="avatar">
                      {(u.email || u.id)[0].toUpperCase()}
                    </span>
                    <div>
                      <strong>{u.email || u.id}</strong>
                      <small>{u.id}</small>
                    </div>
                  </div>
                  <div className="row">
                    <span className="badge">
                      {data.plans[u.subscription?.planId]?.name ||
                        u.subscription?.planId ||
                        "No plan"}
                    </span>
                    <Status
                      value={
                        u.suspended
                          ? "suspended"
                          : u.subscription?.status || "unknown"
                      }
                    />
                  </div>
                </div>
                <form
                  className="admin-access-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    execute("admin.access", {
                      uid: u.id,
                      planId: String(f.get("plan")),
                      suspended: f.has("suspended"),
                      validUntil: new Date(String(f.get("until"))).getTime(),
                    });
                  }}
                >
                  <label>
                    <span>Promotional plan</span>
                    <select
                      name="plan"
                      defaultValue={u.subscription?.planId || "free"}
                    >
                      {Object.keys(data.plans).map((p) => (
                        <option key={p} value={p}>
                          {data.plans[p].name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Access end date</span>
                    <input
                      name="until"
                      type="date"
                      min={new Date(Date.now() + 86400000)
                        .toISOString()
                        .slice(0, 10)}
                      required
                    />
                  </label>
                  <label className="suspend-check">
                    <input
                      name="suspended"
                      type="checkbox"
                      defaultChecked={u.suspended}
                    />
                    Suspend account
                  </label>
                  <button disabled={busy}>Update access</button>
                </form>
              </div>
            ))}
          {!users.length && (
            <Empty>
              Customer accounts will appear here after registration.
            </Empty>
          )}
          <div className="panel-footer">
            <Shield size={14} />
            All access changes are authorized by the server and recorded in the
            audit log.
          </div>
        </section>
      )}
      {tab === "Plans" && (
        <PlanEditor plans={data?.plans || {}} busy={busy} execute={execute} />
      )}
      <AdminExtras section={tab} data={data} busy={busy} execute={execute} />
      {tab === "Payments" && (
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Subscription events</h2>
              <p className="muted">
                Recent verified payment-provider notifications.
              </p>
            </div>
          </div>
          {data?.events?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Processing status</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e: any) => (
                    <tr key={e.id}>
                      <td>{e.name.replaceAll("_", " ")}</td>
                      <td>
                        <Status value={e.status} />
                      </td>
                      <td>{new Date(e.at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No subscription events have been recorded.</Empty>
          )}
        </section>
      )}
    </>
  );
}
