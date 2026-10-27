import { useQuery } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { Alert } from 'react-native';
import { auth } from '../../src/config/firebase';
import { getProfile, operation } from '../../src/api';
import { errorMessage } from '../../src/errors';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, Screen, State, Button, Txt } from '../../src/ui';
export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile, retry: 1 });
  const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    index: 'grid-outline',
    posts: 'documents-outline',
    groups: 'people-outline',
    queue: 'checkmark-circle-outline',
    settings: 'options-outline',
  };
  if (!profile.data)
    return (
      <Screen title="Your workspace" subtitle="Everything you need, in one place.">
        <State
          loading={profile.isLoading}
          error={profile.error}
          retry={() => {
            void profile.refetch();
          }}
        />
        {profile.error && (
          <>
            <Txt muted>
              Your account is signed in. Your workspace could not be opened yet. Retry in a moment
              or sign out to use another account.
            </Txt>
            {profile.error.message.includes('deletion is in progress') && (
              <Button
                title="Finish deleting account"
                onPress={() =>
                  Alert.alert(
                    'Finish account deletion?',
                    'This permanently removes your remaining app data.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete account',
                        style: 'destructive',
                        onPress: () => {
                          void operation('account.delete', { confirmation: 'DELETE' }).catch((e) =>
                            Alert.alert('Account deletion', errorMessage(e)),
                          );
                        },
                      },
                    ],
                  )
                }
              />
            )}
            <Button
              title="Sign out"
              secondary
              onPress={() => {
                void signOut(auth).catch((e) => Alert.alert('Sign out', errorMessage(e)));
              }}
            />
          </>
        )}
      </Screen>
    );
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 3 },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.line,
          height: 64 + Math.max(insets.bottom, 10),
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 10),
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name] ?? 'ellipse-outline'} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Overview' }} />
      <Tabs.Screen name="posts" options={{ title: 'Posts' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="queue" options={{ title: 'Queue' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
