import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { operation } from './api';
import { loadNotifications } from './notificationRuntime';

export function initializeNotificationHandling(onRoute: (route: string) => void) {
  let active = true;
  let removeListener: (() => void) | undefined;
  void loadNotifications()
    .then(async (Notifications) => {
      if (!active || !Notifications) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      const open = (response: import('expo-notifications').NotificationResponse) => {
        const route = response.notification.request.content.data?.route;
        if (active && typeof route === 'string' && /^\/(queue|post\/[0-9a-f-]{36})$/.test(route))
          onRoute(route);
      };
      const sub = Notifications.addNotificationResponseReceivedListener(open);
      removeListener = () => sub.remove();
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) open(response);
    })
    .catch((error) => {
      if (active)
        console.warn('Notification setup failed. Rebuild the native app to enable push.', error);
    });
  return () => {
    active = false;
    removeListener?.();
  };
}

export async function registerPush() {
  const Notifications = await loadNotifications();
  if (!Notifications)
    throw new Error(
      'Push notifications require a development build. You can use the rest of the app in Expo Go.',
    );
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('sharing', {
      name: 'Sharing reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error('Enable notifications in your device settings to receive reminders.');
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Configure an EAS project ID before enabling push.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await operation('push.register', { token });
  await SecureStore.setItemAsync('push-token', token);
  return token;
}
export async function unregisterPush() {
  const token = await SecureStore.getItemAsync('push-token');
  if (token) await operation('push.remove', { token });
  await SecureStore.deleteItemAsync('push-token');
}
