import { auth, api } from "../../../packages/client";
import { onAuthStateChanged } from "firebase/auth/web-extension";
let ready: Promise<unknown> = new Promise((resolve) => {
  const stop = onAuthStateChanged(auth, () => {
    stop();
    resolve(true);
  });
});
chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create("agp-sync", { periodInMinutes: 1 });
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});
chrome.runtime.onStartup.addListener(() => {
  void chrome.alarms.create("agp-sync", { periodInMinutes: 1 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "agp-sync") void sync();
});
async function sync() {
  await ready;
  if (!auth.currentUser?.emailVerified) {await chrome.action.setBadgeText({text:''});await chrome.storage.local.remove(['pendingJobs','lastSync','syncError']);return;}
  const { deviceId } = await chrome.storage.local.get("deviceId");
  if (!deviceId) return;
  try {
    const jobs = await api("jobs", { deviceId,version:chrome.runtime.getManifest().version });
    await chrome.storage.local.set({
      pendingJobs: jobs.length,
      lastSync: Date.now(),
      syncError: null,
    });
    await chrome.action.setBadgeText({
      text: jobs.length ? String(jobs.length) : "",
    });
    await chrome.action.setBadgeBackgroundColor({ color: "#137F72" });
  } catch {
    await chrome.action.setBadgeText({text:'!'});
    await chrome.storage.local.set({
      syncError: "Sync unavailable. Open AutoGroupPoster to reconnect.",
    });
  }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SYNC") {
    sync()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});
