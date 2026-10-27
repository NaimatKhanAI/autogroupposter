import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Firebase's default typings omit this export provided by its React Native entry.
declare module 'firebase/auth' {
  function getReactNativePersistence(storage: typeof ReactNativeAsyncStorage): Persistence;
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'unconfigured',
  authDomain: 'groupposter-1f253.firebaseapp.com',
  projectId: 'groupposter-1f253',
  storageBucket: 'groupposter-1f253.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const configured = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
  !process.env.EXPO_PUBLIC_FIREBASE_API_KEY.includes('YOUR_') &&
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID &&
  !process.env.EXPO_PUBLIC_FIREBASE_APP_ID.includes('YOUR_') &&
  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
  !process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID.includes('YOUR_'),
);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;

try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'auth/already-initialized'
  ) {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

const db = getFirestore(app);
const storage = getStorage(app);

const functions = getFunctions(app, 'us-central1');

export { app, auth, db, storage, functions };
