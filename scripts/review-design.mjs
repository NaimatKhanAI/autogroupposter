import { chromium } from "playwright-core";
import fs from "node:fs/promises";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9195";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8185";
const { initializeApp } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
initializeApp({ projectId: "demo-autogroupposter" });
const admin = getAuth(),
  email = "design-review@autogroupposter.test",
  password = "LocalVisual!2026";
let user;
try {
  user = await admin.getUserByEmail(email);
} catch (e) {
  if (e.code !== "auth/user-not-found") throw e;
  user = await admin.createUser({
    email,
    password,
    emailVerified: true,
    displayName: "Design review",
  });
}
await admin.setCustomUserClaims(user.uid, { agpAdmin: true });
const login = await fetch(
  "http://127.0.0.1:9195/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  },
);
const { idToken } = await login.json();
async function call(action, input = {}) {
  const res = await fetch(
    "http://127.0.0.1:5105/demo-autogroupposter/us-central1/agpApi",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + idToken,
      },
      body: JSON.stringify({ data: { action, input } }),
    },
  );
  const payload = await res.json();
  if (!res.ok || payload.error)
    throw new Error(action + ": " + payload.error?.message);
  return payload.result;
}
await call("bootstrap");
await call("saveGroup", {
  id: "design-preview-group",
  name: "Local preview group (demo)",
  url: "https://www.facebook.com/groups/0000000000000000",
  category: "Design review",
});
await call("savePost", {
  id: "design-preview-draft",
  title: "Weekly community update",
  text: "Sample draft for the local design preview. Replace this text before preparing a real campaign.",
  media: [],
  template: true,
});
await call("registerDevice", {
  id: "design-preview-browser",
  name: "Design preview browser (demo)",
});
await call("createCampaign", {
  requestId: "design-preview-campaign",
  name: "Community update (demo)",
  postId: "design-preview-draft",
  groupIds: ["design-preview-group"],
  deviceId: "design-preview-browser",
});
await fs.mkdir("artifacts/design", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  }),
  page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = "http://127.0.0.1:5173";
async function capture(name, fullPage = true) {
  await page.waitForFunction(() => {
    const button = document.querySelector('[aria-label="Refresh workspace"]');
    return !button || !button.disabled;
  });
  await page.screenshot({ path: `artifacts/design/${name}.png`, fullPage });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 2,
  );
  if (overflow) throw new Error("Horizontal overflow: " + name);
}
for (const [name, path] of [
  ["landing", "/"],
  ["login", "/login"],
  ["signup", "/signup"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["refunds", "/refunds"],
  ["contact", "/contact"],
  ["delete-account", "/delete-account"],
  ["payment-success", "/payment-success"],
  ["payment-cancelled", "/payment-cancelled"],
]) {
  await page.goto(base + path);
  await page.locator("h1").waitFor();
  await capture(name);
}
await page.goto(base + "/login");
await page.locator("#email").fill(email);
await page.locator("#password").fill(password);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page
  .getByRole("heading", { name: "Overview", exact: true })
  .waitFor({ timeout: 30000 });
await page
  .locator(".sidebar button")
  .filter({ hasText: "Owner console" })
  .waitFor();
for (const name of [
  "Dashboard",
  "Groups",
  "Composer",
  "Drafts",
  "Campaigns",
  "Schedules",
  "Assistant",
  "History",
  "Billing",
  "Devices",
  "Support",
]) {
  await page
    .locator(".workspace-nav button")
    .filter({ hasText: new RegExp("^" + name + "$") })
    .click();
  if (name === "Composer") {
    await page.locator("#post-title").fill("A new community announcement");
    await page
      .locator("#post-text")
      .fill(
        "A short update for the community, prepared with the details in one place.",
      );
    if (
      (await page.locator(".preview-post-body").innerText()) !==
      "A short update for the community, prepared with the details in one place."
    )
      throw new Error("Live preview is not synchronized");
  }
  await capture("workspace-" + name.toLowerCase());
}
await page
  .locator(".workspace-nav button")
  .filter({ hasText: "Owner console" })
  .click();
await page.locator(".admin-panel-tabs").waitFor();
for (const tab of [
  "Customers",
  "Plans",
  "Payments",
  "Requests",
  "Security",
  "Releases",
]) {
  await page
    .locator(".admin-panel-tabs button")
    .filter({ hasText: tab })
    .click();
  await capture("admin-" + tab.toLowerCase());
}
await page
  .locator(".admin-panel-tabs button")
  .filter({ hasText: "Plans" })
  .click();
const saveResponse = page.waitForResponse(
  (r) =>
    r.url().includes("/agpApi") &&
    r.request().postData()?.includes("admin.plan"),
);
await page.getByRole("button", { name: "Save plan", exact: true }).click();
const saved = await (await saveResponse).json();
if (saved.error)
  throw new Error("Structured plan form did not save: " + saved.error.message);
await page.getByText("Changes saved.", { exact: true }).waitFor();
await page
  .locator(".workspace-nav button")
  .filter({ hasText: "Drafts" })
  .click();
await page
  .getByRole("button", { name: "Edit draft", exact: true })
  .first()
  .click();
if (
  (await page.locator("#post-title").inputValue()) !== "Weekly community update"
)
  throw new Error("Draft editor lost the existing title");
const updated =
  "Sample draft for the local design preview. Replace this text before preparing a real campaign. Browser form verification.";
await page.locator("#post-text").fill(updated);
await page.getByRole("button", { name: "Save draft", exact: true }).click();
await page.getByText(updated, { exact: true }).waitFor({ timeout: 15000 });
await call("savePost", {
  id: "design-preview-draft",
  title: "Weekly community update",
  text: "Sample draft for the local design preview. Replace this text before preparing a real campaign.",
  media: [],
  template: true,
});
await page
  .getByRole("button", { name: "Refresh workspace", exact: true })
  .click();
await page.waitForFunction(
  () => !document.querySelector('[aria-label="Refresh workspace"]').disabled,
);
await page.setViewportSize({ width: 390, height: 844 });
for (const name of [
  "Dashboard",
  "Groups",
  "Composer",
  "Drafts",
  "Campaigns",
  "Schedules",
  "Assistant",
  "History",
  "Billing",
  "Devices",
  "Support",
]) {
  await page
    .locator(".workspace-nav button")
    .filter({ hasText: new RegExp("^" + name + "$") })
    .click();
  await capture("mobile-" + name.toLowerCase());
}
await page
  .getByRole("button", { name: "Toggle navigation", exact: true })
  .click();
await capture("mobile-navigation");
await context.close();
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: "light",
});
const mp = await mobile.newPage();
for (const path of ["/", "/login", "/privacy"]) {
  await mp.goto(base + path);
  await mp.locator("h1").waitFor();
  await mp.screenshot({
    path:
      "artifacts/design/public-mobile-" +
      (path.replaceAll("/", "") || "landing") +
      ".png",
    fullPage: true,
  });
  if (
    await mp.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    )
  )
    errors.push("Mobile public overflow: " + path);
}
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Design review passed: 42 page captures, saved draft editing, structured plan saving, live preview, authenticated navigation, mobile menu, and overflow checks.",
);
