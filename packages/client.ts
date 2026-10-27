import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  connectAuthEmulator,
} from "firebase/auth/web-extension";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  connectStorageEmulator,
} from "firebase/storage";
const e = import.meta.env;
const emulator = e.VITE_EMULATOR === "true";
export const configured =
  emulator || (!!e.VITE_FIREBASE_API_KEY && !!e.VITE_FIREBASE_APP_ID);
const app = initializeApp({
  apiKey: emulator ? "demo-key" : e.VITE_FIREBASE_API_KEY || "unconfigured",
  appId: e.VITE_FIREBASE_APP_ID || "",
  projectId: emulator
    ? "demo-autogroupposter"
    : e.VITE_FIREBASE_PROJECT_ID || "groupposter-1f253",
  authDomain:
    e.VITE_FIREBASE_AUTH_DOMAIN || "groupposter-1f253.firebaseapp.com",
  storageBucket: emulator
    ? "demo-autogroupposter.appspot.com"
    : "groupposter-1f253.firebasestorage.app",
});
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
});
const functions = getFunctions(app, "us-central1");
if (emulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9195", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5105);
  connectStorageEmulator(getStorage(app), "127.0.0.1", 9295);
}
export async function api(
  action: string,
  input: Record<string, unknown> = {},
): Promise<any> {
  return (await httpsCallable(functions, "agpApi")({ action, input })).data;
}
export async function login(email: string, password: string, register = false) {
  if (!configured)
    throw new Error("Firebase configuration is missing. See deployment guide.");
  const r = await (register
    ? createUserWithEmailAndPassword(auth, email, password)
    : signInWithEmailAndPassword(auth, email, password));
  if (register) await sendEmailVerification(r.user);
  return r;
}
export const logout = async() => {await signOut(auth);if(typeof chrome!=='undefined'&&chrome.runtime?.id){await chrome.action.setBadgeText({text:''});await chrome.storage.local.remove(['pendingJobs','lastSync','syncError']);}};
export const reset = (email: string) => sendPasswordResetEmail(auth, email);
export const verify = () =>
  auth.currentUser && sendEmailVerification(auth.currentUser);
export async function upload(file: File) {
  if (!auth.currentUser) throw new Error("Sign in");
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Use a PNG, JPEG or WebP under 8 MB.");
  const {path} = await api('reserveMedia',{size:file.size,contentType:file.type});
  await uploadBytes(ref(getStorage(app), path), file);
  return path;
}
export const mediaUrl = (path: string) =>
  getDownloadURL(ref(getStorage(app), path));
