import { Billing } from "./Billing";
import { ActivityHistory } from "./ActivityHistory";
import { MediaPreview } from "./MediaPreview";
import { Brand, Empty, AuthFrame, Dashboard, Status, pageMeta } from "./Design";
import { Landing, Info } from "./PublicPages";
import { Admin } from "./AdminDashboard";
import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, updateProfile } from "firebase/auth/web-extension";
import {
  LayoutDashboard,
  Users,
  FileText,
  Layers,
  Clock,
  Send,
  History,
  CreditCard,
  Monitor,
  LifeBuoy,
  Shield,
  ArrowUpRight,
  Plus,
  LogOut,
  Check,
  Copy,
  Trash2,
  RefreshCw,
  Link as LinkIcon,
  Menu,
} from "lucide-react";
import {
  api,
  auth,
  configured,
  login,
  logout,
  reset,
  verify,
  upload,
  mediaUrl,
} from "../client";
const menus = [
  ["Dashboard", LayoutDashboard],
  ["Groups", Users],
  ["Composer", FileText],
  ["Drafts", Layers],
  ["Campaigns", Send],
  ["Schedules", Clock],
  ["Assistant", ArrowUpRight],
  ["History", History],
  ["Billing", CreditCard],
  ["Devices", Monitor],
  ["Support", LifeBuoy],
] as const;
function field(f: FormData, key: string) {
  return String(f.get(key) || "");
}
export function App({
  extension = false,
  popup = false,
}: {
  extension?: boolean;
  popup?: boolean;
}) {
  const [user, setUser] = useState(auth.currentUser),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("Dashboard"),
    [workspace, setWorkspace] = useState<any>(null),
    [items, setItems] = useState<Record<string, any[]>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [deviceId, setDeviceId] = useState(""),
    [search, setSearch] = useState(""),
    [media, setMedia] = useState<string[]>([]),
    [editing, setEditing] = useState<any>(null),
    [previewTitle, setPreviewTitle] = useState(""),
    [previewText, setPreviewText] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [admin, setAdmin] = useState<any>(null),
    [plans, setPlans] = useState<any[]>([]),
    [cursors,setCursors]=useState<Record<string,string|null>>({}),
    [syncIssue,setSyncIssue]=useState(''),
    [register, setRegister] = useState(location.pathname === "/signup");
  const pageDepth=useRef<Record<string,number>>({});
  const [navigationOpen, setNavigationOpen] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
        setItems({});pageDepth.current={};setCursors({});
        setWorkspace(null);
      }),
    [],
  );
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const owner = auth.currentUser?.uid;
    const w = await api("bootstrap");
    if (!owner || auth.currentUser?.uid !== owner) return;
    setWorkspace(w);
    const kinds = [
      "groups",
      "posts",
      "campaigns",
      "jobs",
      "devices",
      "activity",
    ];
    const values = await Promise.all(
      kinds.map((kind) => readPages(kind)),
    );
    const activeJobs=await readPages('jobs',true);
    const currentPlans = await api("plans");
    if (auth.currentUser?.uid !== owner) return;
    const next=Object.fromEntries(kinds.map((k,i)=>[k,values[i].items]));next.jobs=[...new Map([...next.jobs,...activeJobs.items].map((j:any)=>[j.id,j])).values()];setItems(next);
    setCursors({...Object.fromEntries(kinds.map((k,i)=>[k,values[i].nextCursor])),actionableJobs:activeJobs.nextCursor});
    setPlans(currentPlans);
  }
  async function readPages(kind:string,onlyActionable=false){const key=onlyActionable?'actionableJobs':kind;let after:string|null=null;const items:any[]=[];for(let i=0;i<(pageDepth.current[key]||1);i++){const result=await api('listPage',{kind,onlyActionable,...(after?{after}:{})});items.push(...result.items);after=result.nextCursor;if(!after)break;}return {items,nextCursor:after};}
  async function loadMore(kind:string){if(!cursors[kind])return;const owner=auth.currentUser?.uid;const result=await api('listPage',{kind:kind==='actionableJobs'?'jobs':kind,after:cursors[kind],onlyActionable:kind==='actionableJobs'});if(!owner||auth.currentUser?.uid!==owner)return;pageDepth.current[kind]=(pageDepth.current[kind]||1)+1;const key=kind==='actionableJobs'?'jobs':kind;setItems(current=>({...current,[key]:[...new Map([...(current[key]||[]),...result.items].map((item:any)=>[item.id,item])).values()]}));setCursors(current=>({...current,[kind]:result.nextCursor}));}
  useEffect(() => {
    if (user?.emailVerified) void run(refresh);
  }, [user?.uid, user?.emailVerified]);
  useEffect(() => {
    if (!user?.emailVerified) return;
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [user?.uid, user?.emailVerified]);
  useEffect(() => {
    if (extension)
      void chrome.storage.local
        .get("deviceId")
        .then((r) => setDeviceId(r.deviceId || ""));
    if(!extension)return;const listener=(changes:Record<string,chrome.storage.StorageChange>)=>{if(changes.syncError)setSyncIssue(changes.syncError.newValue||'');};chrome.storage.onChanged.addListener(listener);void chrome.storage.local.get('syncError').then(r=>setSyncIssue(r.syncError||''));return()=>chrome.storage.onChanged.removeListener(listener);
  }, [extension]);
  async function registerBrowser() {
    const id = crypto.randomUUID();
    await api("registerDevice", { id, name: `Chrome · ${navigator.platform}`,version:chrome.runtime.getManifest().version });
    await chrome.storage.local.set({ deviceId: id });
    setDeviceId(id);
    await refresh();
    setNotice("Browser connected. Use this account in the mobile app.");
  }
  async function command(action: string, input: Record<string, unknown> = {}) {
    await api(action, input);
    await refresh();
  }
  const path = location.pathname;
  if (
    !extension &&
    [
      "/privacy",
      "/terms",
      "/refunds",
      "/contact",
      "/delete-account",
      "/payment-success",
      "/payment-cancelled",
    ].includes(path)
  )
    return <Info path={path} />;
  if (
    !extension &&
    !user &&
    !["/login", "/signup", "/app", "/admin", "/billing"].includes(path)
  )
    return <Landing />;
  if (!ready) return <div className="auth">Loading your account…</div>;
  if (!user)
    return (
      <AuthFrame compact={extension}>
        <div className="auth card">
          <Brand />
          <div className="section-label">YOUR WORKSPACE</div>
          <h1>{register ? "Create your workspace" : "Welcome back"}</h1>
          <p className="muted">
            Sign in to manage your groups, drafts and campaigns.
          </p>
          {!configured && (
            <p className="notice">
              Firebase is not configured. Follow docs/DEPLOYMENT.md before
              signing in.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await login(field(f, "email"), field(f, "password"), register);
              });
            }}
          >
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            <button disabled={busy || !configured}>
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
              <ArrowUpRight size={16} />
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => setRegister(!register)}
            >
              {register ? "I have an account" : "Create an account"}
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() =>
                void run(async () => {
                  const email = (
                    document.getElementById("email") as HTMLInputElement
                  ).value;
                  if (!email) throw new Error("Enter your email first");
                  await reset(email);
                  setNotice("Password reset requested. Check your inbox.");
                })
              }
            >
              Reset password
            </button>
          </form>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {workspace?.release?.notes && (
            <details style={{ marginBottom: 16 }}>
              <summary className="muted">
                Release {workspace.release.currentVersion} · Compatibility &
                support
              </summary>
              <p>{workspace.release.notes}</p>
              {workspace.release.supportUrl && (
                <a
                  href={workspace.release.supportUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contact support ↗
                </a>
              )}
            </details>
          )}
          <small>
            By creating an account, you agree to the Terms of Service and
            Privacy Policy.
          </small>
        </div>
      </AuthFrame>
    );
  if (!user.emailVerified)
    return (
      <AuthFrame compact={extension}>
        <div className="auth card">
          <Brand />
          <h1>Verify your email</h1>
          <p>Open the verification link sent to {user.email}.</p>
          <button
            onClick={() =>
              void run(async () => {
                await user.reload();
                await user.getIdToken(true);
                setUser(auth.currentUser);
                setReady(false);
                location.reload();
              })
            }
          >
            I've verified my email
          </button>
          <button
            className="ghost"
            onClick={() =>
              void run(async () => {
                await verify();
                setNotice("Verification email sent.");
              })
            }
          >
            Resend email
          </button>
          <button className="ghost" onClick={() => void logout()}>
            Sign out
          </button>
          {error && <p role="alert">{error}</p>}
          {notice && <p>{notice}</p>}
        </div>
      </AuthFrame>
    );
  const groups = items.groups || [],
    posts = items.posts || [],
    jobs = items.jobs || [],
    devices = items.devices || [];
  const change = (p: string) => {
    setNavigationOpen(false);
    if (p === "Composer") {
      setEditing(null);
      setMedia([]);
      setPreviewTitle("");
      setPreviewText("");
    }
    setPage(p);
    setError("");
    setNotice("");
  };
  return (
    <div className={`shell ${popup ? "popup" : ""}`}>
      {!popup && (
        <aside className={`sidebar ${navigationOpen ? "menu-open" : ""}`}>
          <Brand />
          <button
            className="mobile-menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={navigationOpen}
            onClick={() => setNavigationOpen(!navigationOpen)}
          >
            <Menu size={19} />
          </button>
          <div className="workspace-name">
            <span className="workspace-avatar">P</span>
            <span>
              Personal workspace<small>Private account</small>
            </span>
          </div>
          <nav className="workspace-nav" aria-label="Workspace navigation">
            <small>WORKSPACE</small>
            {menus.map(([name, Icon], index) => (
              <React.Fragment key={name}>
                {index === 8 && <small>ACCOUNT</small>}
                <button
                  key={name}
                  className={`nav-item ${page === name ? "active" : ""}`}
                  aria-current={page === name ? "page" : undefined}
                  onClick={() => change(name)}
                >
                  <Icon size={17} />
                  <span>{name}</span>
                </button>
              </React.Fragment>
            ))}
            {workspace?.admin && (
              <button
                className={page === "Admin" ? "active" : ""}
                onClick={() => {
                  change("Admin");
                  void run(async () => setAdmin(await api("admin.overview")));
                }}
              >
                <Shield size={17} />
                Owner console
              </button>
            )}
          </nav>
          <div className="sidebar-plan">
            <span className="section-label">YOUR PLAN</span>
            <strong>{workspace?.plan?.name || "Connecting"}</strong>
            <button onClick={() => change("Billing")}>
              Manage plan <ArrowUpRight size={14} />
            </button>
          </div>
          <button onClick={() => void logout()}>
            <LogOut size={16} />
            Sign out
          </button>
        </aside>
      )}
      <main className={`main page-${page.toLowerCase()}`}>
        {popup && (
          <div className="popup-brand">
            <Brand />
            <span className="badge">Chrome</span>
          </div>
        )}
        <div className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{pageMeta[page]?.[0] || page}</strong>
          </div>
          <div className="account">
            <span className="badge">
              {workspace?.plan?.name || "Connecting…"}
            </span>
            <span className="email">{user.email}</span>
            <span className="avatar">{user.email?.[0].toUpperCase()}</span>
          </div>
        </div>
        <div className="heading">
          <div>
            <h1>{pageMeta[page]?.[0] || page}</h1>
            <p className="page-description">{pageMeta[page]?.[1]}</p>
          </div>
          <button
            className="ghost"
            disabled={busy}
            aria-label="Refresh workspace"
            onClick={() => void run(refresh)}
          >
            <RefreshCw size={15} className={busy ? "spinning" : ""} />
            <span>Refresh</span>
          </button>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {syncIssue&&<div className="notice" role="status">{syncIssue}</div>}
        {workspace?.deletionRequested&&<div className="notice" role="status">Account deletion has been requested. New work is disabled while billing and data removal are reviewed.</div>}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {busy && (
          <p role="status" className="muted">
            Working…
          </p>
        )}
        {popup ? (
          <>
            <div className="hero">
              <h2>Your workspace, one click away.</h2>
              <p>
                {
                  jobs.filter((j) =>
                    ["prepared", "waiting_for_user"].includes(j.status),
                  ).length
                }{" "}
                tasks awaiting your review.
              </p>
              <button
                onClick={() => {
                  void chrome.windows
                    .getCurrent()
                    .then((w) => chrome.sidePanel.open({ windowId: w.id! }));
                }}
              >
                Open workspace <ArrowUpRight size={16} />
              </button>
            </div>
            <p className="muted">
              {devices.some((d) => d.id === deviceId && !d.revoked)
                ? "Browser connected to your account"
                : "Connect this browser in Workspace → Devices."}
            </p>
            <p>
              Plan: {workspace?.plan?.name}{" "}
              {workspace?.subscription?.status === "trialing" &&
                `· Trial ends ${new Date(workspace.subscription.validUntil).toLocaleDateString()}`}
            </p>
            <button className="ghost" onClick={() => void logout()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            {page === "Dashboard" && (
              <Dashboard
                groups={groups}
                posts={posts}
                jobs={jobs}
                campaigns={items.campaigns || []}
                devices={devices}
                change={change}
              />
            )}
            {page === "Groups" && (
              <>
                <div className="grid two">
                  <form
                    className="card"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget),
                        form = e.currentTarget;
                      void run(async () => {
                        await command("saveGroup", {
                          name: field(f, "name"),
                          url: field(f, "url"),
                          category: field(f, "category"),
                        });
                        form.reset();
                        setNotice("Group saved.");
                      });
                    }}
                  >
                    <h2>Add a group</h2>
                    <label htmlFor="group-name">Group name</label>
                    <input
                      id="group-name"
                      name="name"
                      required
                      maxLength={120}
                    />
                    <label htmlFor="group-url">Facebook group URL</label>
                    <input
                      id="group-url"
                      name="url"
                      type="url"
                      placeholder="https://www.facebook.com/groups/your-group"
                      required
                    />
                    <label htmlFor="category">Category</label>
                    <input
                      id="category"
                      name="category"
                      defaultValue="General"
                      maxLength={80}
                    />
                    <div className="actions">
                      <button disabled={busy}>
                        <Plus size={16} />
                        Save group
                      </button>
                    </div>
                  </form>
                  <div className="card">
                    <h2>
                      Saved destinations{" "}
                      <span className="badge">{groups.length}</span>
                    </h2>
                    <label htmlFor="search">Search name or category</label>
                    <input
                      id="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {groups
                      .filter((g) =>
                        `${g.name} ${g.category}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((g) => (
                        <div className="listitem" key={g.id}>
                          <div className="row between">
                            <strong>{g.name}</strong>
                            <button
                              className="danger"
                              aria-label={`Delete ${g.name}`}
                              onClick={() => {
                                if (confirm("Remove this saved group?"))
                                  void run(() =>
                                    command("deleteItem", {
                                      kind: "groups",
                                      id: g.id,
                                    }),
                                  );
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <small>{g.category}</small>
                          <p>
                            <a href={g.url} target="_blank" rel="noreferrer">
                              Open group ↗
                            </a>
                          </p>
                        </div>
                      ))}
                    {!groups.length && (
                      <Empty>Your group collection starts here.</Empty>
                    )}
                  </div>
                </div>
              </>
            )}
            {page === "Composer" && (
              <div className="grid two">
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      await command("savePost", {
                        ...(editing ? { id: editing.id } : {}),
                        title: field(f, "title"),
                        text: field(f, "text"),
                        media,
                        template: f.has("template"),
                      });
                      setMedia([]);
                      setEditing(null);
                      change("Drafts");
                      setNotice("Draft saved.");
                    });
                  }}
                >
                  <h2>Post details</h2>
                  <label htmlFor="post-title">Draft title</label>
                  <input
                    onChange={(e) => setPreviewTitle(e.target.value)}
                    id="post-title"
                    name="title"
                    maxLength={160}
                    defaultValue={editing?.title || ""}
                    required
                  />
                  <label htmlFor="post-text">Your message</label>
                  <textarea
                    onChange={(e) => setPreviewText(e.target.value)}
                    id="post-text"
                    name="text"
                    maxLength={20000}
                    required
                    placeholder="What would you like to share with your community?"
                    defaultValue={editing?.text || ""}
                  />
                  <label htmlFor="post-media">
                    Images · up to 4, 8 MB each
                  </label>
                  <input
                    id="post-media"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={media.length >= 4 || busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void run(async () =>
                          setMedia([...media, await upload(file)]),
                        );
                    }}
                  />
                  <span className="field-hint">
                    PNG, JPEG or WebP. Up to 8 MB per image.
                  </span>
                  <div className="media-chips">
                    {media.map((path, i) => (
                      <button
                        type="button"
                        className="ghost"
                        key={path}
                        onClick={() =>
                          setMedia(media.filter((p) => p !== path))
                        }
                      >
                        Image {i + 1}{" "}
                        <span aria-label="Remove image">&#215;</span>
                      </button>
                    ))}
                  </div>
                  <label>
                    <input
                      type="checkbox"
                      name="template"
                      defaultChecked={editing?.template || false}
                    />
                    Save as a reusable template
                  </label>
                  <button disabled={busy}>Save draft</button>
                  {editing && (
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setMedia([]);
                        change("Drafts");
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </form>
                <aside className="card composer-preview">
                  <div className="card-heading">
                    <div>
                      <h2>Draft preview</h2>
                      <p className="muted">
                        A quick look at the content you are preparing.
                      </p>
                    </div>
                    <span className="badge">Preview</span>
                  </div>
                  <div className="preview-post">
                    <div className="preview-post-top">
                      <span className="avatar">
                        {user.email?.[0].toUpperCase()}
                      </span>
                      <div>
                        <strong>{user.displayName || "Your account"}</strong>
                        <small>{previewTitle || "Untitled draft"}</small>
                      </div>
                    </div>
                    <div className="preview-post-body">
                      {previewText || (
                        <span className="muted">
                          Your message will appear here as you write.
                        </span>
                      )}
                    </div>
                    <MediaPreview paths={media} />
                    <div className="preview-post-footer">
                      <Shield size={13} />
                      Saved privately until you choose to share it.
                    </div>
                  </div>
                  <span className="char-count">
                    {previewText.length.toLocaleString()} / 20,000 characters
                  </span>
                  <div className="notice">
                    This is a content preview. The final appearance is
                    determined by the group page where you publish.
                  </div>
                </aside>
              </div>
            )}
            {page === "Drafts" && (
              <div className="card">
                <div className="row between">
                  <h2>Draft library</h2>
                  <button onClick={() => change("Composer")}>
                    <Plus size={16} />
                    New draft
                  </button>
                </div>
                {posts.map((p) => (
                  <div className="listitem" key={p.id}>
                    <h3>
                      {p.title}{" "}
                      {p.template && <span className="badge">Template</span>}
                    </h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>{p.text}</p>
                    <div className="row">
                      <small>{p.media.length} images</small>
                      <button
                        className="ghost"
                        onClick={() => {
                          setEditing(p);
                          setMedia(p.media || []);
                          setPreviewTitle(p.title);
                          setPreviewText(p.text);
                          setPage("Composer");
                          setError("");
                        }}
                      >
                        Edit draft
                      </button>
                      <button
                        className="ghost"
                        onClick={() =>
                          void run(async () => {
                            await navigator.clipboard.writeText(p.text);
                            setNotice("Text copied.");
                          })
                        }
                      >
                        <Copy size={14} />
                        Copy text
                      </button>
                      <button
                        className="ghost"
                        onClick={() =>
                          void run(() =>
                            command("savePost", {
                              ...p,
                              id: undefined,
                              title: p.title + " (copy)",
                            }),
                          )
                        }
                      >
                        Duplicate
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (confirm("Delete this draft?"))
                            void run(() =>
                              command("deleteItem", {
                                kind: "posts",
                                id: p.id,
                              }),
                            );
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!posts.length && (
                  <Empty>Create your first draft in the composer.</Empty>
                )}
              </div>
            )}
            {(page === "Campaigns" || page === "Schedules") && (
              <div className="grid two">
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(async () => {
                      if (!selected.length)
                        throw new Error("Choose at least one group");
                      await command("createCampaign", {
                        requestId: crypto.randomUUID(),
                        name: field(f, "name"),
                        postId: field(f, "post"),
                        deviceId: field(f, "device"),
                        groupIds: selected,
                        ...(field(f, "schedule")
                          ? {
                              scheduledAt: new Date(
                                field(f, "schedule"),
                              ).getTime(),
                            }
                          : {}),
                      });
                      setNotice(
                        "Campaign prepared. Open Assistant on the assigned browser.",
                      );
                      setSelected([]);
                    });
                  }}
                >
                  <h2>
                    {page === "Schedules"
                      ? "Schedule preparation"
                      : "Prepare a campaign"}
                  </h2>
                  <label htmlFor="campaign-name">Campaign name</label>
                  <input
                    id="campaign-name"
                    name="name"
                    required
                    maxLength={120}
                  />
                  <label htmlFor="campaign-post">Saved draft</label>
                  <select id="campaign-post" name="post" required>
                    <option value="">Choose a draft</option>
                    {posts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="campaign-device">Assigned browser</label>
                  <select id="campaign-device" name="device" required>
                    <option value="">Choose a browser</option>
                    {devices
                      .filter((d) => !d.revoked)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                  <label>
                    Destinations{" "}
                    <span className="muted">({selected.length} selected)</span>
                  </label>
                  <div className="destination-options">
                    {groups.map((g) => (
                      <label key={g.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(g.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, g.id]
                                : selected.filter((id) => id !== g.id),
                            )
                          }
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                  {!groups.length && (
                    <p className="muted">
                      Save groups before creating a campaign.
                    </p>
                  )}
                  <label htmlFor="schedule">
                    Preparation reminder · local time (optional)
                  </label>
                  <input id="schedule" name="schedule" type="datetime-local" />
                  <div className="notice">
                    Scheduling prepares tasks. Chrome must be open to
                    synchronize; publication always needs your review.
                  </div>
                  <button disabled={busy}>Prepare campaign</button>
                </form>
                <div className="card">
                  <h2>Your campaigns</h2>
                  {(items.campaigns || []).map((c) => (
                    <div className="listitem" key={c.id}>
                      <h3>
                        {c.name}{" "}
                        {c.archived && <span className="badge">Archived</span>}
                      </h3>
                      <small>{new Date(c.scheduledAt).toLocaleString()}</small>
                      <p>
                        {
                          jobs.filter(
                            (j) =>
                              j.campaignId === c.id &&
                              j.status === "user_confirmed",
                          ).length
                        }{" "}
                        user confirmed /{" "}
                        {jobs.filter((j) => j.campaignId === c.id).length}{" "}
                        destinations
                      </p>
                      <button
                        className="ghost"
                        onClick={() => change("Assistant")}
                      >
                        Review tasks
                      </button>
                      {!c.archived && (
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Archive this campaign and cancel its unfinished tasks? History is retained and the active campaign slot is released.",
                              )
                            )
                              void run(() =>
                                command("archiveCampaign", { id: c.id }),
                              );
                          }}
                        >
                          Archive campaign
                        </button>
                      )}
                    </div>
                  ))}
                  {!items.campaigns?.length && (
                    <Empty>Your campaigns will appear here.</Empty>
                  )}
                </div>
              </div>
            )}
            {page === "Assistant" && (
              <>
                <div className="notice">
                  Review each destination and draft before opening a group. Copy
                  the text, attach images manually, and complete publication on
                  Facebook. Mark a task confirmed only after you finish.
                </div>
                {!extension && (
                  <p className="notice">
                    Use the installed Chrome extension on the assigned browser
                    to open destinations.
                  </p>
                )}
                {jobs
                  .filter((j) =>
                    ["prepared", "waiting_for_user", "failed"].includes(
                      j.status,
                    ),
                  )
                  .map((j) => (
                    <div className="card task-card" key={j.id}>
                      <div className="row between task-card-top">
                        <h2>{j.group.name}</h2>
                        <Status value={j.status} />
                      </div>
                      <div className="task-card-content">
                        <a href={j.group.url} target="_blank" rel="noreferrer">
                          {j.group.url}
                        </a>
                        <h3 style={{ marginTop: 20 }}>{j.post.title}</h3>
                        <p className="task-copy">{j.post.text}</p>
                        <small>
                          Ready {new Date(j.dueAt).toLocaleString()} · Expires{" "}
                          {new Date(j.expiresAt).toLocaleString()}
                        </small>
                      </div>
                      <div className="actions">
                        <button
                          className="ghost"
                          onClick={() =>
                            void run(async () => {
                              await navigator.clipboard.writeText(j.post.text);
                              setNotice("Draft text copied.");
                            })
                          }
                        >
                          <Copy size={15} />
                          Copy text
                        </button>
                        {j.post.media?.map((p: string, i: number) => (
                          <button
                            key={p}
                            className="ghost"
                            onClick={() =>
                              void run(async () => {
                                const url = await mediaUrl(p);
                                if (extension)
                                  await chrome.tabs.create({ url });
                                else window.open(url, "_blank", "noopener");
                              })
                            }
                          >
                            Open image {i + 1}
                          </button>
                        ))}
                        {j.status === "prepared" && (
                          <button
                            disabled={
                              busy ||
                              !extension ||
                              deviceId !== j.deviceId ||
                              j.dueAt > Date.now()
                            }
                            onClick={() => {
                              if (
                                confirm(
                                  `Review and prepare this draft for ${j.group.name}?\n${j.group.url}\nYou will complete publication yourself.`,
                                )
                              )
                                void run(async () => {
                                  await api("transitionJob", {
                                    id: j.id,
                                    status: "waiting_for_user",
                                  });
                                  await chrome.tabs.create({
                                    url: j.group.url,
                                  });
                                  await refresh();
                                });
                            }}
                          >
                            Review & open group <ArrowUpRight size={15} />
                          </button>
                        )}
                        {j.status === "waiting_for_user" && (
                          <button
                            disabled={
                              busy || !extension || deviceId !== j.deviceId
                            }
                            onClick={() => {
                              if (
                                confirm(
                                  `Confirm you personally completed publication in ${j.group.name}? This records your attestation, not platform verification.`,
                                )
                              )
                                void run(() =>
                                  command("transitionJob", {
                                    id: j.id,
                                    status: "user_confirmed",
                                    confirmed: true,
                                  }),
                                );
                            }}
                          >
                            <Check size={15} />I completed publication
                          </button>
                        )}
                        {j.status === "failed" && (
                          <button
                            onClick={() =>
                              void run(() =>
                                command("transitionJob", {
                                  id: j.id,
                                  status: "prepared",
                                }),
                              )
                            }
                          >
                            Retry
                          </button>
                        )}
                        <button
                          className="danger"
                          onClick={() => {
                            if (confirm("Cancel this preparation task?"))
                              void run(() =>
                                command("transitionJob", {
                                  id: j.id,
                                  status: "cancelled",
                                }),
                              );
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                {!jobs.some((j) =>
                  ["prepared", "waiting_for_user", "failed"].includes(j.status),
                ) && (
                  <div className="card">
                    <Empty>
                      No tasks waiting. Prepare a campaign to get started.
                    </Empty>
                  </div>
                )}
              </>
            )}
            {page === "History" && <ActivityHistory jobs={jobs} />}
            {page === "Devices" && (
              <div className="card">
                <h2>Connected browsers</h2>
                <p className="muted">
                  Sign in to the mobile app with {user.email}. Campaigns and
                  browser devices use this same account; no pairing code or
                  second extension is required.
                </p>
                {extension && (
                  <button
                    disabled={
                      busy ||
                      devices.some((d) => d.id === deviceId && !d.revoked)
                    }
                    onClick={() => void run(registerBrowser)}
                  >
                    <LinkIcon size={16} />
                    {devices.some((d) => d.id === deviceId && !d.revoked)
                      ? "This browser is connected"
                      : "Connect this browser"}
                  </button>
                )}
                {devices.map((d) => (
                  <div className="listitem row between" key={d.id}>
                    <div className="device-indicator">
                      <span>
                        <Monitor size={18} />
                      </span>
                      <div>
                        <h3>{d.name}</h3>
                        <small>
                          {d.revoked
                            ? "Revoked"
                            : `Last synchronized ${new Date(d.lastSeen).toLocaleString()}`}
                          {d.id === deviceId ? " · This browser" : ""}
                        </small>
                      </div>
                    </div>
                    {!d.revoked && (
                      <button
                        className="danger"
                        onClick={() => {
                          if (
                            confirm(
                              "Revoke this device? It will no longer receive tasks.",
                            )
                          )
                            void run(() =>
                              command("revokeDevice", { id: d.id }),
                            );
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
                {!devices.length && (
                  <Empty>
                    Connect a browser from the extension to receive preparation
                    tasks.
                  </Empty>
                )}
                <div className="notice">
                  An offline or closed browser does not execute tasks. Pending
                  tasks remain available until they expire.
                </div>
              </div>
            )}
            {page === "Billing" && (
              <Billing
                workspace={workspace}
                groups={groups}
                posts={posts}
                campaigns={items.campaigns || []}
                plans={plans}
                busy={busy}
                open={(action, id) =>
                  void run(async () => {
                    const r = await api(action, id ? { planId: id } : {});
                    if (extension) await chrome.tabs.create({ url: r.url });
                    else location.assign(r.url);
                  })
                }
              />
            )}
            {page === "Support" && (
              <div className="help-layout">
                <section className="card">
                  <h2>Your account</h2>
                  <p className="muted">{user.email} · Email verified</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        await updateProfile(user, {
                          displayName: field(f, "displayName")
                            .trim()
                            .slice(0, 120),
                        });
                        setNotice("Account profile updated.");
                      });
                    }}
                  >
                    <label htmlFor="display-name">Display name</label>
                    <input
                      id="display-name"
                      name="displayName"
                      maxLength={120}
                      defaultValue={user.displayName || ""}
                    />
                    <div className="actions">
                      <button disabled={busy}>Save profile</button>
                      <button
                        className="ghost"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await reset(user.email!);
                            setNotice("Password reset email requested.");
                          })
                        }
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => void logout()}
                      >
                        Sign out
                      </button>
                    </div>
                  </form>
                </section>
                <section className="card">
                  <h2>How can we help?</h2>
                  <p className="muted">
                    Describe what happened. Do not include passwords or payment
                    card details.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget),
                        form = e.currentTarget;
                      void run(async () => {
                        await api("support", { message: field(f, "message") });
                        form.reset();
                        setNotice("Support request saved.");
                      });
                    }}
                  >
                    <label htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      maxLength={4000}
                    />
                    <button disabled={busy}>Send request</button>
                  </form>
                  <details className="support-danger">
                    <summary>Request account deletion</summary>
                    <p>
                      Creates a request for owner review, including subscription
                      cancellation and data removal. Deletion is not immediate.
                    </p>
                    <button
                      className="danger"
                      onClick={() => {
                        if (
                          confirm(
                            "Request removal of your account and associated data?",
                          )
                        )
                          void run(async () => {
                            await api("deleteAccountRequest", {
                              message:
                                "Please delete my account and associated data.",
                            });
                            setNotice("Deletion request recorded for review.");
                          });
                      }}
                    >
                      Request deletion
                    </button>
                  </details>
                </section>
              </div>
            )}
            {page === "Admin" && workspace?.admin && (
              <Admin
                data={admin}
                busy={busy}
                execute={(action, input) =>
                  void run(async () => {
                    await api(action, input);
                    setAdmin(await api("admin.overview"));
                    setNotice("Changes saved.");
                  })
                }
              />
            )}
          </>
        )}
        {Object.entries({Groups:'groups',Drafts:'posts',Campaigns:'campaigns',Schedules:'campaigns',History:'jobs',Assistant:'actionableJobs',Devices:'devices'}).filter(([p,kind])=>p===page&&cursors[kind]).map(([p,kind])=><div className="actions" key={p}><button className="ghost" disabled={busy} onClick={()=>void run(()=>loadMore(kind))}>Load more {p==='History'?'history':p==='Assistant'?'pending tasks':kind}</button></div>)}
      </main>
    </div>
  );
}
