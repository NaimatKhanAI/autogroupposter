import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadNotifications, supportsPushNotifications } from '../src/notificationRuntime';
const runtime = vi.hoisted(() => ({ executionEnvironment: 'storeClient' }));
const native = vi.hoisted(() => ({ imported: vi.fn() }));
vi.mock('expo-constants', () => ({
  default: runtime,
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
vi.mock('expo-notifications', () => {
  native.imported();
  return { setNotificationHandler: vi.fn() };
});
beforeEach(() => {
  runtime.executionEnvironment = 'storeClient';
  native.imported.mockClear();
});
describe('notification runtime availability', () => {
  it('does not evaluate native notification modules in Expo Go', async () => {
    expect(supportsPushNotifications()).toBe(false);
    expect(await loadNotifications()).toBeNull();
    expect(native.imported).not.toHaveBeenCalled();
  });
  it('keeps remote push unavailable in the free backend even in a development build', async () => {
    runtime.executionEnvironment = 'bare';
    expect(supportsPushNotifications()).toBe(false);
    expect(await loadNotifications()).toBeNull();
    expect(native.imported).not.toHaveBeenCalled();
  });
});
