import React from "react";
import {
  Layers,
  ArrowUpRight,
  Plus,
  FileText,
  Users,
  Monitor,
  Check,
  ChevronRight,
  Inbox,
  ShieldCheck,
} from "lucide-react";
export function Brand() {
  return (
    <div className="brand">
      <span className="mark">
        <Layers size={20} strokeWidth={1.8} />
      </span>
      <span>
        AutoGroup<span className="brand-light">Poster</span>
      </span>
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Inbox size={23} strokeWidth={1.5} />
      </span>
      <strong>Nothing here yet</strong>
      <p>{children}</p>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    prepared: "Prepared",
    waiting_for_user: "Needs review",
    user_confirmed: "User confirmed",
    platform_confirmed: "Platform confirmed",
    past_due: "Payment overdue",
    trialing: "Trial",
    promotional: "Promotional access",
    in_progress: "In progress",
  };
  return (
    <span className="badge status" data-status={value}>
      <i />
      {labels[value] || value.replaceAll("_", " ")}
    </span>
  );
}
export const pageMeta: Record<string, [string, string]> = {
  Dashboard: [
    "Overview",
    "Your groups, drafts and upcoming work in one place.",
  ],
  Groups: [
    "Group library",
    "Keep your destinations organized and easy to find.",
  ],
  Composer: ["Write a post", "Prepare a draft you can review before sharing."],
  Drafts: [
    "Saved drafts",
    "Pick up where you left off, or reuse an existing post.",
  ],
  Campaigns: [
    "Campaigns",
    "Bring a draft, its destinations and a browser together.",
  ],
  Schedules: [
    "Scheduled preparation",
    "Plan when your campaigns should be ready for review.",
  ],
  Assistant: [
    "Posting assistant",
    "Review the content and destination for each task.",
  ],
  History: [
    "Activity history",
    "A clear record of preparation and user-confirmed publication.",
  ],
  Billing: [
    "Plan & billing",
    "Review your usage, subscription and billing details.",
  ],
  Devices: [
    "Browser devices",
    "Manage the browsers connected to your account.",
  ],
  Support: [
    "Help & account",
    "Manage your profile and get help with your workspace.",
  ],
  Admin: [
    "Owner console",
    "Customer access, subscriptions and service operations.",
  ],
};
export function AuthFrame({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`auth-layout ${compact ? "auth-compact" : ""}`}>
      <aside className="auth-aside">
        <a href="/" aria-label="AutoGroupPoster home">
          <Brand />
        </a>
        <div className="auth-story">
          <span className="section-label">
            A WORKSPACE FOR YOUR COMMUNITIES
          </span>
          <h2>
            A little preparation.
            <br />A better way to post.
          </h2>
          <p>
            Organize your groups, keep your drafts close, and review every post
            before it goes out.
          </p>
          <div className="auth-flow">
            {[
              [Users, "Your groups", "Keep your destinations together"],
              [FileText, "Your drafts", "Write once and refine at your pace"],
              [Check, "Your decision", "Review and complete each publication"],
            ].map(([Icon, title, description], i) => {
              const I = Icon as typeof Users;
              return (
                <div key={i}>
                  <span>
                    <I size={19} />
                  </span>
                  <div>
                    <strong>{title as string}</strong>
                    <small>{description as string}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="auth-aside-footer">
          <ShieldCheck size={15} />
          Your account works across browser and mobile.
        </div>
      </aside>
      <div className="auth-main">
        {children}
        <div className="auth-footnote">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/contact">Contact support</a>
        </div>
      </div>
    </div>
  );
}
export function Dashboard({
  groups,
  posts,
  jobs,
  campaigns,
  devices,
  change,
}: {
  groups: any[];
  posts: any[];
  jobs: any[];
  campaigns: any[];
  devices: any[];
  change: (page: string) => void;
}) {
  const pending = jobs.filter((j) =>
    ["prepared", "waiting_for_user"].includes(j.status),
  );
  return (
    <>
      <div className="overview-banner">
        <div>
          <span className="section-label">YOUR NEXT POST STARTS HERE</span>
          <h2>Keep your posting routine in order.</h2>
          <p>
            Start with a draft, choose your groups, and review each destination.
          </p>
          <button onClick={() => change("Composer")}>
            <Plus size={16} />
            Create a draft
          </button>
        </div>
        <div className="banner-steps" aria-hidden="true">
          <span>
            <FileText size={18} />
            Draft
          </span>
          <ChevronRight size={15} />
          <span>
            <Users size={18} />
            Groups
          </span>
          <ChevronRight size={15} />
          <span className="current">
            <Check size={18} />
            Review
          </span>
        </div>
      </div>
      <div className="grid stats-grid">
        {[
          [Users, "Saved groups", groups.length, "Groups"],
          [FileText, "Saved drafts", posts.length, "Drafts"],
          [
            Layers,
            "Active campaigns",
            campaigns.filter((c) => !c.archived).length,
            "Campaigns",
          ],
          [Inbox, "Awaiting review", pending.length, "Assistant"],
        ].map(([Icon, label, count, page]) => {
          const I = Icon as typeof Users;
          return (
            <button
              className="card stat-card"
              key={label as string}
              onClick={() => change(page as string)}
            >
              <div className="stat-label">
                <span>{label as string}</span>
                <I size={17} />
              </div>
              <div className="stat">{count as number}</div>
              <span className="stat-link">
                View {String(label).toLowerCase()}
                <ArrowUpRight size={13} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="overview-columns">
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Ready for your attention</h2>
              <p className="muted">
                Preparation tasks waiting for a personal review.
              </p>
            </div>
            <button className="text-button" onClick={() => change("Assistant")}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          {pending.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Destination</th>
                    <th>Draft</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.slice(0, 5).map((j) => (
                    <tr key={j.id}>
                      <td>
                        <strong>{j.group.name}</strong>
                      </td>
                      <td>{j.post.title}</td>
                      <td>
                        <Status value={j.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Create a campaign to prepare your first posting task.</Empty>
          )}
          <div className="panel-footer">
            <ShieldCheck size={15} />
            You review and complete publication on the group page.
          </div>
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Workspace setup</h2>
              <p className="muted">Three steps to your first campaign.</p>
            </div>
          </div>
          {[
            [
              groups.length > 0,
              Users,
              "Save your first group",
              "Add a destination you are authorized to post in.",
              "Groups",
            ],
            [
              posts.length > 0,
              FileText,
              "Prepare a draft",
              "Keep your message and images together.",
              "Composer",
            ],
            [
              devices.some((d) => !d.revoked),
              Monitor,
              "Connect a browser",
              "Register it from the Chrome extension.",
              "Devices",
            ],
          ].map(([done, Icon, title, description, page], i) => {
            const I = Icon as typeof Users;
            return (
              <button
                key={i}
                className="setup-step"
                onClick={() => change(page as string)}
              >
                <span className={`step-icon ${done ? "done" : ""}`}>
                  {done ? <Check size={17} /> : <I size={17} />}
                </span>
                <span>
                  <strong>{title as string}</strong>
                  <small>{description as string}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </section>
      </div>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Recent drafts</h2>
            <p className="muted">Your latest ideas, ready to pick up again.</p>
          </div>
          <button className="text-button" onClick={() => change("Drafts")}>
            Open library
            <ChevronRight size={14} />
          </button>
        </div>
        {posts.length ? (
          <div className="draft-strip">
            {[...posts]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 3)
              .map((p) => (
                <button
                  className="draft-tile"
                  key={p.id}
                  onClick={() => change("Drafts")}
                >
                  <FileText size={18} />
                  <strong>{p.title}</strong>
                  <p>{p.text}</p>
                  <small>
                    {p.template ? "Reusable template" : "Saved draft"}
                    <ArrowUpRight size={14} />
                  </small>
                </button>
              ))}
          </div>
        ) : (
          <Empty>Save a draft in the composer and it will appear here.</Empty>
        )}
      </section>
    </>
  );
}
