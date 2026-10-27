# Interface refresh

The customer website, login and registration, account verification, legal/help pages, payment-return pages, shared Chrome popup/side panel workspace and owner console now use a consistent visual system. The original native mobile application is preserved; this refresh covers the running web and extension interfaces and their responsive layouts.

The direction is a restrained workspace: dark forest navigation, an off-white canvas, thin dividers, modest corner radii, compact controls and a clear type hierarchy. System fonts and bundled Lucide icons avoid remote executable code or font dependencies in the extension. Copy is direct and task-oriented; repeated promotional headings have been removed from workspace pages. The public workflow illustration is labeled as a preview and does not imply real activity or successful publication.

## Updated screens

- Public home: product illustration, specific feature descriptions, preparation workflow, optional mobile connection, plan availability and consistent footer.
- Authentication: a split desktop layout, focused forms, mobile adaptation, verification and policy links.
- Dashboard: real account counts, pending-task table, setup progress and recent drafts.
- Groups, drafts, campaigns and schedules: consistent form spacing, library rows, destination selection and clear actions.
- Composer: live text/title preview, character count, attachment controls and a private-image preview.
- Assistant: a separate task header, draft content and explicit action area.
- History: a readable status table with filtering and truthful confirmation labels.
- Billing: current plan, usage summary, plan feature lists, and a portal action disabled before a subscription exists.
- Devices and account/support: recognizable device rows, separate profile/support panels and clear account actions.
- Owner console: Customers, Plans, Payments, Requests, Security and Releases tabs. Plan configuration uses validated form fields instead of a JSON editor. Customer filtering and readable payment/audit tables reduce clutter.
- Small screens: horizontally scrollable navigation plus an expandable menu, stacked panels and contained table scrolling.

## Verification

`node scripts/review-design.mjs` uses installed headless Chrome against local Firebase emulators. It creates clearly labeled fixtures under a separate local-only design-review account, not the user's owner account or production Firebase project. The review captures 42 desktop/mobile views, checks horizontal overflow, verifies live preview updates, edits/saves a draft, and submits the structured plan editor. Screenshots are stored in ignored `artifacts/design/`. The browser review does not interact with Facebook or perform payments.

The source includes a local review fixture browser registration; it is explicitly named as a demo and is not presented as an actual running browser agent. Extension source and production/local bundles are rebuilt after the refresh. Browser screenshots validate the shared web layouts; actual installation and side-panel gesture testing remain distinct from these web checks.

The UI deliberately shows the configured plan data and real empty states. No customer counts, revenue, published posts, testimonials, or merchant approval are invented for presentation.
