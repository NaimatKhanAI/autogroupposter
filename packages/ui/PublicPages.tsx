import React from "react";
import {
  ArrowUpRight,
  Check,
  FileText,
  Users,
  Monitor,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Layers,
  Clock,
  ArrowLeft,
  Mail,
  LifeBuoy,
  Receipt,
} from "lucide-react";
import { Brand } from "./Design";
export function PublicNav() {
  return (
    <header className="public-header">
      <nav className="nav" aria-label="Main navigation">
        <a href="/" aria-label="AutoGroupPoster home">
          <Brand />
        </a>
        <div className="nav-links">
          <a href="/#features">Product</a>
          <a href="/#workflow">How it works</a>
          <a href="/#pricing">Plans</a>
          <a href="/contact">Support</a>
        </div>
        <div className="nav-account">
          <a href="/login">Sign in</a>
          <a className="button" href="/signup">
            Get started
            <ArrowUpRight size={15} />
          </a>
        </div>
      </nav>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div>
        <Brand />
        <p>A practical workspace for group post preparation.</p>
        <small>© {new Date().getFullYear()} AutoGroupPoster</small>
      </div>
      <div>
        <strong>Product</strong>
        <a href="/#features">Features</a>
        <a href="/#workflow">How it works</a>
        <a href="/#pricing">Plans & availability</a>
      </div>
      <div>
        <strong>Help</strong>
        <a href="/contact">Contact support</a>
        <a href="/login">Your workspace</a>
        <a href="/delete-account">Account deletion</a>
      </div>
      <div>
        <strong>Legal</strong>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/refunds">Refund Policy</a>
      </div>
    </footer>
  );
}
function ProductExample() {
  return (
    <div className="product-example">
      <div className="example-top">
        <span>
          <span className="small-mark">
            <Layers size={14} />
          </span>
          Campaign workspace
        </span>
        <span className="example-tag">Workflow preview</span>
      </div>
      <div className="example-body">
        <div className="example-sidebar">
          <span className="selected">
            <Users size={15} />
            Groups
          </span>
          <span>
            <FileText size={15} />
            Drafts
          </span>
          <span>
            <Clock size={15} />
            Schedule
          </span>
        </div>
        <div className="example-content">
          <small className="section-label">PREPARE A POST</small>
          <h3>Community update</h3>
          <div className="example-draft">
            <span className="draft-label">
              <FileText size={14} />
              Saved draft
            </span>
            <p>
              A quick update for our community. Here’s what we’ve been working
              on this week…
            </p>
            <div className="example-lines">
              <i />
              <i />
            </div>
          </div>
          <div className="example-destination">
            <span className="group-initial">C</span>
            <div>
              <strong>Your community group</strong>
              <small>Selected destination</small>
            </div>
            <Check size={15} />
          </div>
          <div className="example-review">
            <ShieldCheck size={16} />
            <span>Ready for your review</span>
            <ArrowUpRight size={15} />
          </div>
        </div>
      </div>
      <div className="example-foot">
        <span className="status-dot" />
        You stay in control of publication.
      </div>
    </div>
  );
}
export function Landing() {
  return (
    <div className="public-page">
      <PublicNav />
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="section-label">
              <span className="status-dot" />
              GROUP POSTING, ORGANIZED
            </span>
            <h1>
              Your posting routine.
              <br />
              <em>In a better place.</em>
            </h1>
            <p>
              Bring your groups, drafts and campaigns into one workspace.
              Prepare the details in advance, then review and share each post
              yourself.
            </p>
            <div className="actions">
              <a href="/signup" className="button">
                Create your workspace
                <ArrowUpRight size={16} />
              </a>
              <a href="#workflow" className="quiet-link">
                See how it works
                <ChevronRight size={15} />
              </a>
            </div>
            <div className="hero-note">
              <Monitor size={15} />
              Works in Chrome. Mobile connection is optional.
            </div>
          </div>
          <ProductExample />
        </section>
        <div className="product-principles">
          <span>
            <Users size={17} />
            An organized group library
          </span>
          <span>
            <FileText size={17} />
            Drafts you can reuse
          </span>
          <span>
            <ShieldCheck size={17} />A review before every post
          </span>
        </div>
        <section className="public-section feature-section" id="features">
          <div className="section-intro">
            <span className="section-label">THE EVERYDAY ESSENTIALS</span>
            <h2>
              Less switching between tabs.
              <br />
              More clarity about what’s next.
            </h2>
            <p>
              Keep the preparation in one place, from the first draft to the
              last destination.
            </p>
          </div>
          <div className="feature-layout">
            {[
              [
                Users,
                "A library for your groups",
                "Save group names and URLs, organize them into categories, and find the right destinations without hunting through bookmarks.",
              ],
              [
                FileText,
                "A home for unfinished ideas",
                "Save text and approved images as drafts. Turn repeatable posts into templates, then adapt them for the next campaign.",
              ],
              [
                Clock,
                "A plan you can come back to",
                "Choose your destinations, assign a browser, and schedule preparation reminders on an eligible plan.",
              ],
              [
                ShieldCheck,
                "A clear record of each step",
                "See what is prepared, what needs review, and what you have personally confirmed. No guessed publishing results.",
              ],
            ].map(([Icon, title, description], i) => {
              const I = Icon as typeof Users;
              return (
                <article className="feature" key={i}>
                  <span className="feature-icon">
                    <I size={21} strokeWidth={1.6} />
                  </span>
                  <h3>{title as string}</h3>
                  <p>{description as string}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="workflow-section" id="workflow">
          <div className="section-intro">
            <span className="section-label">A WORKFLOW THAT MAKES SENSE</span>
            <h2>
              Prepare in your own time.
              <br />
              Publish with your own judgment.
            </h2>
          </div>
          <div className="workflow-grid">
            {[
              [
                "01",
                "Write your draft",
                "Add your message and images. Save it for later or use a template.",
              ],
              [
                "02",
                "Choose your groups",
                "Select relevant destinations and assign your connected browser.",
              ],
              [
                "03",
                "Review and share",
                "Open each group, check the content, and complete publication yourself.",
              ],
            ].map(([n, t, d]) => (
              <article key={n}>
                <span className="workflow-number">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
          <div className="workflow-disclosure">
            <ShieldCheck size={20} />
            <p>
              Facebook Groups publishing is assisted. AutoGroupPoster opens your
              selected group page and makes your draft available; you complete
              publication on Facebook.
            </p>
          </div>
        </section>
        <section className="public-section connected-section">
          <div className="connection-visual">
            <span className="device-tile">
              <Monitor size={38} strokeWidth={1.3} />
              <strong>Chrome extension</strong>
              <small>Your everyday workspace</small>
            </span>
            <span className="connection-line" />
            <span className="device-tile mobile-tile">
              <Smartphone size={34} strokeWidth={1.3} />
              <strong>Mobile app</strong>
              <small>Optional, same account</small>
            </span>
          </div>
          <div className="section-intro">
            <span className="section-label">ONE ACCOUNT, TWO WAYS TO WORK</span>
            <h2>
              Start on your phone.
              <br />
              Pick it up in your browser.
            </h2>
            <p>
              Use the extension on its own, or connect the mobile app with the
              same account. Prepare a campaign on your phone and review it on
              the assigned browser.
            </p>
            <p className="small-copy">
              Browser offline? Your preparation tasks stay pending until it
              reconnects.
            </p>
          </div>
        </section>
        <section className="public-section pricing-section" id="pricing">
          <div className="section-intro">
            <span className="section-label">ROOM FOR YOUR WORKFLOW</span>
            <h2>
              Start with the essentials.
              <br />
              Choose more capacity when you need it.
            </h2>
            <p>
              Plan availability, current prices and limits are shown in your
              account before checkout.
            </p>
          </div>
          <div className="pricing-preview">
            <div>
              <span className="badge">Free access</span>
              <h3>Get your workspace in order.</h3>
              <p>
                Explore group organization, saved drafts and assisted
                preparation within the configured free limits.
              </p>
              <a href="/signup" className="button secondary">
                Create an account
                <ArrowUpRight size={15} />
              </a>
            </div>
            <div>
              <span className="badge">Paid plans, when available</span>
              <h3>Build a bigger posting routine.</h3>
              <p>
                Higher group and campaign limits, more connected browsers and
                scheduled preparation on eligible plans.
              </p>
              <a href="/login" className="button">
                View available plans
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          <p className="pricing-note">
            Paid subscriptions renew on the terms shown at hosted checkout.
            Manage future renewals and cancellation in your billing portal.
          </p>
        </section>
        <section className="closing-section">
          <div>
            <span className="section-label">
              YOUR NEXT POST, WITHOUT THE SCATTER
            </span>
            <h2>Give your routine a workspace.</h2>
          </div>
          <a className="button" href="/signup">
            Get started
            <ArrowUpRight size={16} />
          </a>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
const documents: Record<
  string,
  {
    title: string;
    description: string;
    draft?: string;
    sections: [string, string][];
  }
> = {
  "/privacy": {
    title: "Privacy Policy",
    description: "How account and workspace information is used.",
    draft:
      "Policy draft: the operator’s legal identity, contact details and retention periods must be finalized before commercial launch.",
    sections: [
      [
        "Information we process",
        "We process your account identifier, email, saved group URLs, drafts, approved images, campaigns, browser device names, task history, support requests and billing references to provide the service.",
      ],
      [
        "Service providers",
        "Firebase provides authentication and application data storage. Lemon Squeezy processes hosted checkout and payment information. Facebook pages and payment-provider pages are external services with their own policies.",
      ],
      [
        "Your account data",
        "Workspace content and stored media are restricted to your account. We do not collect social passwords, browser cookies, unrelated browsing history or complete payment-card details.",
      ],
      [
        "Access, correction and deletion",
        "Use Support in your signed-in workspace to request access, a correction or deletion. Operational retention periods and operator contact details remain to be finalized.",
      ],
    ],
  },
  "/terms": {
    title: "Terms of Service",
    description: "The terms for using your AutoGroupPoster workspace.",
    draft:
      "Terms draft: operator identity, jurisdiction and public contact information must be finalized before commercial launch.",
    sections: [
      [
        "Responsible use",
        "You must be authorized to post to every selected group and follow its rules and the platform terms. Review your content and complete each publication yourself.",
      ],
      [
        "Assisted publishing",
        "The service prepares content and opens destinations. It does not guarantee delivery, platform approval, audience reach or account availability. User confirmations are personal attestations, not verification from the platform.",
      ],
      [
        "Subscriptions",
        "Paid plans renew monthly or yearly as disclosed at hosted checkout. Cancel future renewals through the billing portal. Access depends on verified provider status and paid-through dates.",
      ],
      [
        "Account access",
        "Keep your account credentials secure. Misuse may result in suspension. Contact Support to resolve an account or service issue.",
      ],
    ],
  },
  "/refunds": {
    title: "Refund Policy",
    description: "How to request a review of a payment.",
    draft:
      "Policy draft: the operator must finalize a refund window and business details before accepting payments.",
    sections: [
      [
        "Requesting a refund",
        "Send a request through workspace Support and include your payment reference and the reason for your request. Do not send card information.",
      ],
      [
        "Review and entitlement changes",
        "Requests are reviewed under the checkout terms and applicable law. A refund may remove paid entitlements. Receipts and invoices are supplied by the payment provider.",
      ],
    ],
  },
  "/contact": {
    title: "How can we help?",
    description: "Get support for your account, workspace or billing.",
    sections: [
      [
        "Workspace support",
        "Sign in, open Help & account, and send a private support request. Include the steps that led to the problem and what you expected to happen.",
      ],
      [
        "Billing questions",
        "For payment methods, invoices and cancellation, open Plan & billing in your workspace. Refund questions can be sent through Support with the payment reference.",
      ],
      [
        "Public contact details",
        "A public support email and the operator’s business details must be configured before the Chrome Web Store submission.",
      ],
    ],
  },
  "/delete-account": {
    title: "Account deletion",
    description:
      "Request removal of your account and associated workspace data.",
    sections: [
      [
        "Submit your request",
        "Sign in and open Help & account → Request account deletion. The operator will review the request and the data associated with your account.",
      ],
      [
        "Before your account is removed",
        "Paid subscriptions need to be cancelled and applicable billing retention requirements resolved. Deletion is not immediate; the operator must complete the removal procedure.",
      ],
    ],
  },
  "/payment-success": {
    title: "We’re waiting for payment confirmation.",
    description: "Your payment provider will confirm the transaction securely.",
    sections: [
      [
        "What happens next",
        "A return to this page does not activate paid access. Open your workspace and refresh Plan & billing to see the verified subscription status.",
      ],
    ],
  },
  "/payment-cancelled": {
    title: "Your checkout was cancelled.",
    description: "You can return to your workspace whenever you are ready.",
    sections: [
      [
        "Return to your plans",
        "No paid access is granted by this page. Review the available plans in your workspace or contact Support if you need help choosing.",
      ],
    ],
  },
};
export function Info({ path }: { path: string }) {
  const d = documents[path],
    payment = path.startsWith("/payment-");
  return (
    <div className="public-page">
      <PublicNav />
      <main className={`document-layout ${payment ? "payment-layout" : ""}`}>
        <aside className="document-nav">
          <span className="section-label">HELP & INFORMATION</span>
          {[
            ["Contact support", "/contact"],
            ["Privacy Policy", "/privacy"],
            ["Terms of Service", "/terms"],
            ["Refund Policy", "/refunds"],
            ["Account deletion", "/delete-account"],
          ].map(([t, p]) => (
            <a className={p === path ? "selected" : ""} key={p} href={p}>
              {t}
              <ChevronRight size={14} />
            </a>
          ))}
        </aside>
        <article className="document-content">
          <a className="back-link" href="/">
            <ArrowLeft size={14} />
            Back to home
          </a>
          <span className="document-icon">
            {payment ? (
              <Receipt size={24} />
            ) : path === "/contact" ? (
              <LifeBuoy size={24} />
            ) : (
              <FileText size={24} />
            )}
          </span>
          <h1>{d.title}</h1>
          <p className="document-lead">{d.description}</p>
          {d.draft && <div className="notice legal-notice">{d.draft}</div>}
          <div className="document-sections">
            {d.sections.map(([title, text], i) => (
              <section key={title}>
                <span className="document-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </div>
              </section>
            ))}
          </div>
          <div className="document-cta">
            <div>
              <strong>
                {payment ? "Check your workspace" : "Need something else?"}
              </strong>
              <p>
                {payment
                  ? "Your account always shows the verified status."
                  : "Send a private request from your signed-in account."}
              </p>
            </div>
            <a href="/app" className="button">
              Open workspace
              <ArrowUpRight size={15} />
            </a>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
