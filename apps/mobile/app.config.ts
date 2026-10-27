import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'GroupPoster',
  slug: 'groupposter',
  owner: 'naimatdevs-team',
  version: '1.0.0',
  scheme: 'groupposter',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  android: {
    allowBackup: false,
    package: 'com.groupposter.manager',
    versionCode: 1,
    adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#137F72' },
    permissions: ['POST_NOTIFICATIONS'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_CONTACTS',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      ...(process.env.EAS_BUILD_PROFILE === 'development'
        ? []
        : ['android.permission.SYSTEM_ALERT_WINDOW']),
    ],
  },
  plugins: [
    './plugins/withAndroidRepositories',
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      { image: './assets/icon.png', imageWidth: 100, backgroundColor: '#137F72' },
    ],
    ['expo-notifications', { color: '#137F72' }],
  ],
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || 'b4b088f5-0ed9-439a-a11f-b35efe331f38',
    },
  },
};
export default config;
