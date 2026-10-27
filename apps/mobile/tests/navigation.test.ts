import { describe, it, expect } from 'vitest';
import { authRedirect } from '../src/navigation';
describe('authentication navigation boundaries', () => {
  it('requires a session for workspace screens', () =>
    expect(authRedirect(false, '(tabs)', 'queue')).toBe('/auth'));
  it('requires a session for a notification post link', () =>
    expect(authRedirect(false, 'post', 'post-id')).toBe('/auth'));
  it('keeps signed-out users on sign-in', () =>
    expect(authRedirect(false, 'auth', undefined)).toBeNull());
  it('allows email verification before sign-in', () =>
    expect(authRedirect(false, 'auth', 'callback')).toBeNull());
  it('allows password recovery after a session is established', () =>
    expect(authRedirect(true, 'auth', 'callback')).toBeNull());
  it('opens the workspace after login', () =>
    expect(authRedirect(true, 'auth', undefined)).toBe('/(tabs)'));
  it('keeps authorized workspace navigation intact', () =>
    expect(authRedirect(true, '(tabs)', 'groups')).toBeNull());
});
