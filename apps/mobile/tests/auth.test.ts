import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAccount,
  signIn,
  refreshVerification,
  resendVerification,
  resetPassword,
} from '../src/auth';
import { authFormSchema } from '../src/authValidation';
import { errorMessage } from '../src/errors';
const setup = vi.hoisted(() => ({
  configured: true,
  auth: {
    currentUser: null as null | { emailVerified: boolean; getIdToken: ReturnType<typeof vi.fn> },
  },
}));
const firebase = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
  reload: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../src/config/firebase', () => setup);
vi.mock('firebase/auth', () => firebase);
beforeEach(() => {
  vi.resetAllMocks();
  setup.configured = true;
  setup.auth.currentUser = null;
});
const form = {
  email: ' user@example.com ',
  password: 'secret123',
  confirmPassword: 'secret123',
  displayName: 'User Name',
};
describe('authentication validation', () => {
  it('accepts existing shorter passwords for login, while registration requires eight characters', () => {
    expect(authFormSchema('login').safeParse({ ...form, password: 'short' }).success).toBe(true);
    expect(
      authFormSchema('register').safeParse({ ...form, password: 'short', confirmPassword: 'short' })
        .success,
    ).toBe(false);
  });
  it('requires matching registration passwords and a name', () => {
    expect(
      authFormSchema('register').safeParse({ ...form, confirmPassword: 'different' }).success,
    ).toBe(false);
    expect(authFormSchema('register').safeParse({ ...form, displayName: '' }).success).toBe(false);
    expect(authFormSchema('register').parse(form).email).toBe('user@example.com');
  });
  it('resets passwords without requiring hidden password/name fields', () => {
    expect(
      authFormSchema('reset').safeParse({
        email: form.email,
        password: '',
        confirmPassword: '',
        displayName: '',
      }).success,
    ).toBe(true);
  });
});
describe('authentication failure recovery', () => {
  it('blocks network requests when Firebase configuration is missing', async () => {
    setup.configured = false;
    await expect(signIn(form.email, form.password)).rejects.toThrow('finish Firebase setup');
    expect(firebase.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });
  it('keeps an unverified account available for resend when email delivery fails', async () => {
    const user = { emailVerified: false };
    firebase.createUserWithEmailAndPassword.mockResolvedValue({ user });
    firebase.sendEmailVerification.mockRejectedValue(new Error('Temporary outage'));
    const result = await createAccount(form.email, form.password, form.displayName);
    expect(result.user).toBe(user);
    expect(result.warning).toContain('account was created');
    expect(firebase.signOut).not.toHaveBeenCalled();
  });
  it('does not attempt verification delivery again on every unverified login', async () => {
    const user = { emailVerified: false };
    firebase.signInWithEmailAndPassword.mockResolvedValue({ user });
    expect(await signIn(form.email, form.password)).toBe(user);
    expect(firebase.sendEmailVerification).not.toHaveBeenCalled();
    expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledWith(
      setup.auth,
      'user@example.com',
      form.password,
    );
  });
  it('refreshes the ID token only after email verification succeeds', async () => {
    const user = { emailVerified: false, getIdToken: vi.fn() };
    setup.auth.currentUser = user;
    expect(await refreshVerification()).toBe(false);
    expect(user.getIdToken).not.toHaveBeenCalled();
    user.emailVerified = true;
    expect(await refreshVerification()).toBe(true);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });
  it('resends for the current account and rejects expired sessions', async () => {
    await expect(resendVerification()).rejects.toThrow('Sign in again');
    setup.auth.currentUser = { emailVerified: false, getIdToken: vi.fn() };
    await resendVerification();
    expect(firebase.sendEmailVerification).toHaveBeenCalledWith(setup.auth.currentUser);
  });
  it('trims email for password reset', async () => {
    await resetPassword(form.email);
    expect(firebase.sendPasswordResetEmail).toHaveBeenCalledWith(setup.auth, 'user@example.com');
  });
  it('shows useful errors without exposing raw auth internals or account existence', () => {
    expect(errorMessage({ code: 'auth/invalid-credential' })).toContain('email or password');
    expect(errorMessage({ code: 'auth/user-not-found' })).toBe(
      errorMessage({ code: 'auth/wrong-password' }),
    );
    expect(errorMessage({ code: 'auth/network-request-failed' })).toContain('internet');
    expect(errorMessage({ code: 'auth/operation-not-allowed' })).toContain('Email/Password');
  });
});
