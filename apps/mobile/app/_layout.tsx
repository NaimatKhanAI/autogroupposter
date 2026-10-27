import React, { useEffect, useState, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { initializeNotificationHandling } from '../src/notifications';
import { auth, db } from '../src/config/firebase';
import { getProfile, operation } from '../src/api';
import { Button, Screen, State, useTheme } from '../src/ui';
import { OfflineNotice } from '../src/OfflineNotice';
import { usePreferences } from '../src/store';
import { authRedirect } from '../src/navigation';
import { MembershipContext, useMembershipState } from '../src/MembershipContext';
import { membershipRouteAllowed } from '../src/membership';
const client = new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 30000 } } });
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) =>
    setOnline(state.isConnected !== false && state.isInternetReachable !== false),
  ),
);
function Navigation() {
  const [session, setSession] = useState<User | null>(null);
  const owner = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments() as string[];
  const t = useTheme();
  const access = useMembershipState(session?.uid);
  useEffect(() => {
    return onIdTokenChanged(auth, (user) => {
      const nextOwner = user?.emailVerified ? user.uid : null;
      if (owner.current !== nextOwner) client.clear();
      owner.current = nextOwner;
      setSession(user?.emailVerified ? user : null);
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!ready) return;
    const destination = authRedirect(Boolean(session), segments[0], segments[1]);
    if (destination) router.replace(destination);
  }, [ready, session, segments]);
  const userId = session?.uid;
  useEffect(() => {
    if (!session || !access.ready) return;
    if (!access.allowed && !membershipRouteAllowed(segments[0], segments[1]))
      router.replace('/membership');
    if (segments[0] === 'admin' && !access.isAdmin) router.replace('/membership');
  }, [session, access.ready, access.allowed, access.isAdmin, segments]);
  useEffect(() => {
    if (!userId || !access.allowed) return;
    let active = true;
    client
      .fetchQuery({ queryKey: ['profile'], queryFn: getProfile })
      .then((profile) => {
        if (active) usePreferences.getState().setAppearance(profile.appearance);
      })
      .catch(() => {});
    const subscriptions = [
      'sharing_tasks',
      'imported_posts',
      'notifications',
      'facebook_groups',
      'connected_pages',
    ].map((table) =>
      onSnapshot(
        query(collection(db, table), where('owner_id', '==', userId)),
        () => {
          void client.invalidateQueries();
        },
        () => {
          void client.invalidateQueries();
        },
      ),
    );
    subscriptions.push(
      onSnapshot(
        doc(db, 'profiles', userId),
        (snapshot) => {
          const appearance = snapshot.data()?.appearance;
          if (['system', 'light', 'dark'].includes(appearance))
            usePreferences.getState().setAppearance(appearance);
        },
        () => {},
      ),
    );
    const advance = () => {
      void operation('schedule.advance')
        .then((result) => {
          if (result.advanced) void client.invalidateQueries();
        })
        .catch(() => {});
    };
    advance();
    const timer = setInterval(advance, 60000);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        advance();
        void auth.currentUser
          ?.reload()
          .then(() => auth.currentUser?.getIdToken(true))
          .catch(() => {});
        void client.invalidateQueries();
      }
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      app.remove();
    };
  }, [userId, access.allowed]);
  useEffect(() => initializeNotificationHandling((route) => router.push(route as '/queue')), []);
  if (!ready || (session && (!access.ready || access.error)))
    return (
      <Screen title="Checking membership">
        <State loading={!access.error} error={access.error} retry={access.retry} />
        {access.error && (
          <Button
            title="Sign out"
            secondary
            onPress={() => {
              void signOut(auth);
            }}
          />
        )}
      </Screen>
    );
  if (
    session &&
    ((!access.allowed && !membershipRouteAllowed(segments[0], segments[1])) ||
      (segments[0] === 'admin' && !access.isAdmin))
  )
    return (
      <Screen title="Membership">
        <State loading />
      </Screen>
    );
  return (
    <MembershipContext.Provider value={access}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="group/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="membership" />
        <Stack.Screen name="admin" />
      </Stack>
      <OfflineNotice />
    </MembershipContext.Provider>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <Navigation />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
