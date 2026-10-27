import Constants, { ExecutionEnvironment } from 'expo-constants';

export const remotePushAvailable = false;
export function supportsPushNotifications() {
  return remotePushAvailable && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

export async function loadNotifications() {
  // Do not evaluate this package in Expo Go: its Android entry requires native
  // modules that are available only in our own development/production build.
  if (!supportsPushNotifications()) return null;
  return import('expo-notifications');
}
