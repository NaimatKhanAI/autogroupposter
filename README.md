# AutoGroupPoster

A single Manifest V3 Chrome extension with a standalone React workspace, a Firebase commercial backend, a customer website/owner console, and an additive Expo mobile integration. Facebook Group publication is user-assisted: this product prepares content and opens pages; it does not publish through the retired Groups API or automate Facebook's DOM.

The adjacent original GroupPoster repository was inspected and its portable source preserved in `apps/mobile`. The original directory was not modified. Existing Android generated files, dependencies, local credentials, logs and build outputs were excluded. Expo prebuild regenerates the native project.

## Develop

Use Node 24.12+ and `npm.cmd` on Windows if PowerShell blocks npm.ps1.

```sh
npm ci
copy .env.example .env
# Configure Firebase public web app values in .env
npm run dev
npm run typecheck
npm test
npm run test:emulators
npm run build
```

Load `dist/chrome-extension` through chrome://extensions → Developer mode → Load unpacked. The release archive is `releases/AutoGroupPoster-1.0.0.zip`. The website builds to `dist/website`; all application routes need an index.html fallback. The same account accesses the same commercial data from mobile and extension. No mobile installation is required for standalone use.

## Run the local demo

With Node 24.12+, run `npm run dev:backend` in one terminal and `npm run dev:local` in another. Then run `npm run dev:seed`. Open http://127.0.0.1:5173/login and sign in as `owner@autogroupposter.test` with password `LocalDemo!2026`. This account exists only in the local Auth emulator. The owner dashboard and callable API were verified over local HTTP with an emulated ID token.

For the extension connected to this demo, run `npm run dev:extension` and load `dist/chrome-extension-local` in Chrome. This separate local build uses the emulators; the production release ZIP is preserved. Local billing uses no valid merchant credentials and cannot complete real checkout. Demo data currently lasts for the emulator session; run the seed command again after restarting it. `node scripts/smoke-local.mjs` checks the local login, workspace bootstrap and owner endpoint without printing tokens.

**Current release is a deployment candidate, not a live commercial launch.** Read [technical report](docs/REPORT.md), [deployment](docs/DEPLOYMENT.md), [store guide](docs/CHROME-WEB-STORE.md), and [audit](docs/AUDIT.md). Live authentication, merchant checkout, production rules, and extension/browser behavior require configuration and acceptance checks. Legal pages intentionally identify their incomplete operator-specific content.
