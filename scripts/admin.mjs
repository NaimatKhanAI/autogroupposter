// Uses Application Default Credentials. Never ship this script or credentials in the extension.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
initializeApp({
  credential: applicationDefault(),
  projectId: "groupposter-1f253",
});
const uid = process.argv[2];
if (!uid)
  throw new Error("Usage: node scripts/admin.mjs FIREBASE_UID [revoke]");
const auth = getAuth(),
  user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, {
  ...user.customClaims,
  agpAdmin: process.argv[3] !== "revoke",
});
console.log("Admin claim updated. Sign out and back in to refresh.");
