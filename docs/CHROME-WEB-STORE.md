# Chrome Web Store submission pack

Name: AutoGroupPoster

Short description: Organize groups and drafts, prepare campaigns, and review each post before sharing.

Description:

Keep your community posting workflow organized with a standalone Chrome workspace. Save Facebook group destinations, organize categories, write drafts with approved images, prepare campaigns, and review each destination in the posting assistant. You open the group page, attach media and finalize publication yourself. Completion history distinguishes preparation, waiting, personal confirmation, failure, cancellation and expiry. User confirmation is your attestation and is not verification from Facebook.

Use the extension independently or sign in with the same account in the optional AutoGroupPoster mobile app. Browser connections and preparation tasks synchronize through Firebase. Chrome must be running and online to synchronize; no hidden background publication occurs. Free plan limits apply. Some features require a paid monthly/yearly subscription as shown in the workspace and hosted checkout. Subscriptions renew automatically on the disclosed checkout terms and can be managed in the payment provider portal. Not affiliated with Meta or Facebook.

## Permissions

- `storage`: connected device identifier and synchronization status; no social cookies.
- `sidePanel`: full draft, group and campaign workspace.
- `alarms`: best-effort queue synchronization while Chrome is running.

The extension does not request tabs history, cookies, scripting, broad host permissions, identity or content scripts. Opening a user-selected page uses `chrome.tabs.create`, which does not require the `tabs` permission. No remote executable code is loaded; Firebase and React are bundled. Backend network responses are data only.

## Required store form entries

Single purpose: organize and prepare user-reviewed group posts. Declare account email/identifier, user-generated drafts/media, saved group URLs, device registration, job history, billing references and support content. Data is used for the product's core service, not advertising or resale. Fill the data-use declarations truthfully after reviewing actual processors and retention. Specify that publication is assisted and user-controlled.

Before submission configure a genuine support email, website URL, `/privacy`, `/terms`, `/refunds`, merchant/operator legal identity, extension public listing ID and operational deletion process. Current legal pages are drafts. Provide reviewer access and sandbox instructions without sharing production secrets. Ensure verified-email onboarding works on the final extension origin.

## Install and package

`npm ci`, configure public Firebase values, then `npm run release`. Test `dist/chrome-extension` with Load unpacked. Upload `releases/AutoGroupPoster-1.0.0.zip` to the developer dashboard only after release gates pass. The archive has manifest.json at its root and contains all runtime scripts and PNG icons (16/32/48/128).

Screenshots to capture from the final configured build: dashboard, saved groups, composer with a harmless sample draft, assistant showing review confirmation, billing disclosures, and optional same-account mobile devices. Use store-accepted dimensions (verify current dashboard requirements); redact personal data and avoid fabricated payment or publishing success. No screenshots of a deployed authenticated environment were generated in this session.

For updates change manifest version in `scripts/build.mjs`, align registered device version and release filename, document release notes, run release and emulator checks, test worker termination/restart in chrome://extensions, and stage the ZIP. Review Chrome policies again before submission. This archive has not been submitted, approved or published.
