import { beforeEach, it, expect, vi } from 'vitest';
import { secureStorage } from '../src/secureStorage';
const memory = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => memory.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => memory.set(k, v),
  deleteItemAsync: async (k: string) => memory.delete(k),
}));
beforeEach(() => memory.clear());
it('round-trips Unicode sessions without exceeding native value limits', async () => {
  const value = JSON.stringify({ token: 'test-token', metadata: '你好 🏡'.repeat(1000) });
  await secureStorage.setItem('session', value);
  expect(await secureStorage.getItem('session')).toBe(value);
  for (const chunk of memory.values())
    expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(1500);
});
it('removes all fragments and rejects incomplete sessions', async () => {
  await secureStorage.setItem('session', 'token'.repeat(1000));
  memory.delete('session.0');
  expect(await secureStorage.getItem('session')).toBeNull();
  await secureStorage.removeItem('session');
  expect(memory.size).toBe(0);
});
