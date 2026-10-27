import { z } from 'zod';
const messages: Record<string, string> = {
  'auth/invalid-credential': 'The email or password is incorrect. Please try again.',
  'auth/wrong-password': 'The email or password is incorrect. Please try again.',
  'auth/user-not-found': 'The email or password is incorrect. Please try again.',
  'auth/email-already-in-use':
    'An account with this email already exists. Sign in or reset your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
  'auth/password-does-not-meet-requirements':
    'Use a stronger password that meets the account password requirements.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/network-request-failed':
    'We could not connect. Check your internet connection and try again.',
  'auth/user-disabled': 'This account is disabled. Contact the app administrator.',
  'auth/operation-not-allowed':
    'Email sign-in is not enabled yet. The app owner needs to enable Email/Password in Firebase Authentication.',
  'auth/configuration-not-found': 'Firebase Authentication needs to be enabled by the app owner.',
  'auth/invalid-api-key':
    'Firebase setup is incomplete. The app owner needs to provide the correct Firebase configuration.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    'Firebase configuration is invalid. Contact the app owner.',
  'auth/app-not-authorized': 'This app is not authorized to use Firebase. Contact the app owner.',
  'auth/requires-recent-login': 'For your security, sign out and sign in again before continuing.',
  'auth/expired-action-code': 'This email link expired. Request a new link.',
  'auth/invalid-action-code': 'This link is invalid or already used. Request a new email.',
  'functions/unauthenticated': 'Your session expired. Please sign in again.',
  'functions/not-found': 'The workspace service is not ready yet. Contact the app owner.',
  'functions/unavailable': 'The workspace is temporarily unavailable. Please try again.',
  'functions/deadline-exceeded': 'The request took too long. Check your connection and retry.',
  'permission-denied': 'You do not have access to this data. Verify your email and sign in again.',
  unavailable: 'Your workspace is temporarily unavailable. Check your connection and retry.',
};
export function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    messages[error.code]
  )
    return messages[error.code]!;
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return issue
      ? `${issue.path.length ? issue.path.join('.') + ': ' : ''}${issue.message}`
      : 'Check the form values.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
