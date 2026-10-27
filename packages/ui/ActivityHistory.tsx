import React, { useState } from "react";
import { Empty, Status } from "./Design";
export function ActivityHistory({ jobs }: { jobs: any[] }) {
  const [filter, setFilter] = useState("all");
  const rows = jobs
    .filter((j) => filter === "all" || j.status === filter)
    .sort(
      (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
    );
  return (
    <section className="card">
      <div className="activity-toolbar">
        <div>
          <h2 style={{ marginBottom: 4 }}>Posting activity</h2>
          <small>
            {jobs.length} tasks recorded ·{" "}
            {jobs.filter((j) => j.status === "user_confirmed").length}{" "}
            personally confirmed
          </small>
        </div>
        <div>
          <label htmlFor="history-filter" className="sr-only">
            Filter activity by status
          </label>
          <select
            id="history-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {[
              ["prepared", "Prepared"],
              ["waiting_for_user", "Needs review"],
              ["user_confirmed", "User confirmed"],
              ["failed", "Failed"],
              ["cancelled", "Cancelled"],
              ["expired", "Expired"],
            ].map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Destination</th>
                <th>Draft</th>
                <th>Status</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id}>
                  <td>
                    <strong>{j.group.name}</strong>
                    <a
                      className="table-secondary"
                      href={j.group.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open group ↗
                    </a>
                  </td>
                  <td>{j.post.title}</td>
                  <td>
                    <Status value={j.status} />
                  </td>
                  <td>
                    {new Date(j.updatedAt || j.createdAt).toLocaleDateString()}
                    <small className="table-secondary">
                      {new Date(j.updatedAt || j.createdAt).toLocaleTimeString(
                        [],
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>
          {filter === "all"
            ? "Preparation activity will appear here after you create a campaign."
            : "No tasks match this status. Try another filter."}
        </Empty>
      )}
      <div className="panel-footer">
        User confirmed means you recorded completion. It does not mean the
        platform verified publication.
      </div>
    </section>
  );
}
