import React from "react";
import { Save, ShieldCheck, Receipt } from "lucide-react";
import { Empty, Status } from "./Design";
export function AdminExtras({
  section,
  data,
  busy,
  execute,
}: {
  section: string;
  data: any;
  busy: boolean;
  execute: (action: string, input: any) => void;
}) {
  const totals: Record<string, number> = {};
  for (const p of data?.payments || [])
    if (p.status === "paid" && !p.refunded)
      totals[p.currency] = (totals[p.currency] || 0) + p.total;
  return (
    <>
      {section === "Security" && (
        <>
          <section className="card">
            <div className="card-heading">
              <div>
                <h2>Service errors</h2>
                <p className="muted">
                  Recent authorization and processing failures, with private
                  content omitted.
                </p>
              </div>
            </div>
            {data?.errors?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Operation</th>
                      <th>Code</th>
                      <th>Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.errors.map((e: any) => (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.action}</strong>
                        </td>
                        <td>{e.code}</td>
                        <td>{new Date(e.at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No service errors have been recorded.</Empty>
            )}
            <div className="panel-footer">
              Use Firebase Logging for detailed diagnostics and uptime
              investigation.
            </div>
          </section>
          <section className="card">
            <h2>Administrator audit</h2>
            {data?.audit?.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Operation</th>
                      <th>Administrator</th>
                      <th>Target</th>
                      <th>Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((a: any) => (
                      <tr key={a.id}>
                        <td>{a.action}</td>
                        <td>{a.uid}</td>
                        <td>{a.target}</td>
                        <td>{new Date(a.at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Administrative changes will be recorded here.</Empty>
            )}
          </section>
        </>
      )}
      {section === "Releases" && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            execute("admin.release", {
              currentVersion: String(f.get("current")),
              minimumVersion: String(f.get("minimum")),
              notes: String(f.get("notes")),
              supportUrl: String(f.get("support")),
            });
          }}
        >
          <div className="card-heading">
            <div>
              <h2>Extension release</h2>
              <p className="muted">
                Publish compatibility notes and set the minimum supported
                version.
              </p>
            </div>
            <span className="badge">Release settings</span>
          </div>
          <div className="form-grid">
            <div>
              <label htmlFor="release-current">Current version</label>
              <input
                id="release-current"
                name="current"
                pattern="[0-9]+\.[0-9]+\.[0-9]+"
                defaultValue={data?.release?.currentVersion || "1.0.0"}
                required
              />
            </div>
            <div>
              <label htmlFor="release-minimum">Minimum supported version</label>
              <input
                id="release-minimum"
                name="minimum"
                pattern="[0-9]+\.[0-9]+\.[0-9]+"
                defaultValue={data?.release?.minimumVersion || "1.0.0"}
                required
              />
              <small className="field-hint">
                Older versions cannot receive or process new jobs.
              </small>
            </div>
          </div>
          <label htmlFor="release-support">Public support URL</label>
          <input
            id="release-support"
            name="support"
            type="url"
            placeholder="https://your-domain.com/contact"
            defaultValue={data?.release?.supportUrl}
            required
          />
          <label htmlFor="release-notes">Release notes & compatibility</label>
          <textarea
            id="release-notes"
            name="notes"
            placeholder="What changed, and what should customers know?"
            defaultValue={data?.release?.notes}
            maxLength={4000}
          />
          <div className="actions">
            <button disabled={busy}>
              <Save size={15} />
              Save release settings
            </button>
          </div>
        </form>
      )}
      {section === "Payments" && (
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Payment records</h2>
              <p className="muted">
                The latest 100 provider invoices in the current environment.
              </p>
            </div>
            <Receipt size={18} color="var(--muted)" />
          </div>
          {Object.entries(totals).map(([currency, total]) => (
            <div className="invoice-total" key={currency}>
              <small>Paid invoices in this sample</small>
              <strong>
                {currency} {(total / 100).toFixed(2)}
              </strong>
            </div>
          ))}
          {data?.payments?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Environment</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.providerReference}</strong>
                        <small className="table-secondary">{p.uid}</small>
                      </td>
                      <td>
                        {p.currency} {(p.total / 100).toFixed(2)}
                      </td>
                      <td>
                        <Status value={p.refunded ? "refunded" : p.status} />
                      </td>
                      <td>{p.testMode ? "Sandbox" : "Live"}</td>
                      <td>{new Date(p.at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No payment invoices have been received.</Empty>
          )}
          <div className="panel-footer">
            These records are a recent sample, not a lifetime revenue report.
            Full invoice details remain in the merchant dashboard.
          </div>
        </section>
      )}
      {section === "Requests" && (
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Support & deletion requests</h2>
              <p className="muted">
                Keep customer requests moving from review to resolution.
              </p>
            </div>
            <span className="badge">{data?.support?.length || 0} requests</span>
          </div>
          {data?.support?.map((s: any) => (
            <article className="listitem" key={s.id}>
              <div className="row between">
                <h3>
                  {s.kind === "deleteAccountRequest"
                    ? "Account deletion"
                    : "Support request"}
                </h3>
                <Status value={s.status} />
              </div>
              <small>
                {s.uid} · {new Date(s.createdAt).toLocaleString()}
              </small>
              <p className="request-message">{s.message}</p>
              <div className="actions">
                {[
                  ["pending", "Pending"],
                  ["in_progress", "Start review"],
                  ["resolved", "Mark resolved"],
                ].map(([status, label]) => (
                  <button
                    key={status}
                    disabled={busy || s.status === status}
                    className="ghost"
                    onClick={() =>
                      execute("admin.support", { id: s.id, status })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {s.kind === "deleteAccountRequest" && (
                <><button className="danger" disabled={busy} onClick={()=>{const confirmation=prompt('This cancels future billing, removes account data and deletes the login. Type the exact account ID to confirm: '+s.uid);if(confirmation===s.uid)execute('admin.completeDeletion',{uid:s.uid,confirmation});}}>Complete account deletion</button><p className="notice">
                  Mark resolved after billing cancellation, account/data removal
                  and retention review. Updating this status does not delete the
                  account.
                </p></>
              )}
            </article>
          ))}
          {!data?.support?.length && (
            <Empty>No requests are waiting for review.</Empty>
          )}
        </section>
      )}
    </>
  );
}
