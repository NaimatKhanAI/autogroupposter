import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  reload,
  signOut,
} from 'firebase/auth';
import { auth, configured } from './config/firebase';

function requireConfiguration() {
  if (!configured)
    throw new Error('Sign-in is not available yet. The app owner needs to finish Firebase setup.');
}
export async function signIn(email: string, password: string) {
  requireConfiguration();
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
  return user;
}
export async function createAccount(email: string, password: string, displayName: string) {
  requireConfiguration();
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  // Account creation succeeded even if profile/email delivery subsequently fails.
  // Keep the unverified session so the user can retry without creating duplicates.
  let warning: string | null = null;
  try {
    await updateProfile(user, { displayName: displayName.trim() });
  } catch {
    warning = 'Your account was created. You can add your name in Settings later.';
  }
  try {
    await sendEmailVerification(user);
  } catch {
    warning =
      'Your account was created, but the verification email could not be sent. Use Resend email to try again.';
  }
  return { user, warning };
}
export async function resendVerification() {
  requireConfiguration();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to resend your verification email.');
  await sendEmailVerification(user);
}
export async function refreshVerification() {
  requireConfiguration();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to continue.');
  await reload(user);
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}
export async function resetPassword(email: string) {
  requireConfiguration();
  await sendPasswordResetEmail(auth, email.trim());
}
export const leaveVerification = () => signOut(auth);
