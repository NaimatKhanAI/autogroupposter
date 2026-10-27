import { errorMessage } from '../../src/errors';
import React, { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth } from '../../src/config/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { useOperation, getProfile, operation } from '../../src/api';
import { usePreferences } from '../../src/store';
import { unregisterPush } from '../../src/notifications';
import { Screen, Card, Txt, Button, Field, Row, Badge, State, useTheme } from '../../src/ui';
import { useMembership } from '../../src/MembershipContext';
export default function Settings() {
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });
  if (!profile.data)
    return (
      <Screen title="Settings">
        <State loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
      </Screen>
    );
  return (
    <SettingsForm
      profile={{ data: profile.data, isLoading: profile.isLoading, error: profile.error }}
    />
  );
}
interface Profile {
  display_name: string;
  timezone: string;
  posting_window_start: string;
  posting_window_end: string;
  notifications_enabled: boolean;
}
function SettingsForm({
  profile,
}: {
  profile: { data: Profile; isLoading: boolean; error: Error | null };
}) {
  const client = useQueryClient();
  const access = useMembership();
  const theme = useTheme();
  const op = useOperation();
  const appearance = usePreferences((s) => s.appearance);
  const setAppearance = usePreferences((s) => s.setAppearance);
  const [name, setName] = useState(profile.data.display_name);
  const [timezone, setTimezone] = useState(profile.data.timezone);
  const [start, setStart] = useState(profile.data.posting_window_start.slice(0, 5));
  const [end, setEnd] = useState(profile.data.posting_window_end.slice(0, 5));
  const [deletion, setDeletion] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(extra: Record<string, unknown> = {}) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end))
        throw new Error('Use HH:mm for preferred windows.');
      await operation('profile.update', {
        values: {
          display_name: name.slice(0, 120),
          timezone,
          appearance,
          posting_window_start: start,
          posting_window_end: end,
          ...extra,
        },
      });
      if (auth.currentUser && auth.currentUser.displayName !== name.trim())
        await updateProfile(auth.currentUser, { displayName: name.trim() });
      await client.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert('Saved', 'Preferences updated.');
    } catch (e) {
      Alert.alert('Settings', errorMessage(e));
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await unregisterPush();
      await signOut(auth);
      router.replace('/auth');
    } catch (e) {
      Alert.alert('Sign out', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    try {
      await op.mutateAsync({ action: 'account.delete', confirmation: deletion });
      Alert.alert('Deletion request received','An administrator will verify billing cancellation and remove your account data. Your account has not been deleted yet.');
    } catch (e) {
      Alert.alert('Account deletion', errorMessage(e));
    }
  }
  function legal(url?: string) {
    if (!url || url.includes('YOUR_DOMAIN'))
      Alert.alert(
        'Policy unavailable',
        'The operator must publish legal documents and configure their URL before release.',
      );
    else Linking.openURL(url).catch(() => Alert.alert('Link', 'Unable to open document.'));
  }
  return (
    <Screen title="Settings" subtitle="Make your workspace feel like yours.">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.soft,
            }}
          >
            <Txt bold size={22} color={theme.accent}>
              {(name || auth.currentUser?.email || 'G').slice(0, 1).toUpperCase()}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt bold size={18}>
              {name || 'Your account'}
            </Txt>
            <Txt muted size={12} numberOfLines={1}>
              {auth.currentUser?.email}
            </Txt>
          </View>
        </View>
        <Badge text="Email verified" />
      </Card>
      <State loading={profile.isLoading} error={profile.error} />
      <Card>
        <Txt bold>Membership & access</Txt>
        <Badge text={access.status} />
        <Button title="Trial & subscription" secondary onPress={() => router.push('/membership')} />
        {access.isAdmin && (
          <Button
            title="Admin console"
            icon="shield-checkmark-outline"
            onPress={() => router.push('/admin')}
          />
        )}
      </Card>
      <Card>
        <Txt bold>Profile & scheduling</Txt>
        <Field label="Display name" value={name} onChangeText={setName} />
        <Field label="Timezone" value={timezone} onChangeText={setTimezone} />
        <Field label="Preferred window start" value={start} onChangeText={setStart} />
        <Field label="Preferred window end" value={end} onChangeText={setEnd} />
        <Txt muted size={12}>
          Windows are preferences for planning; select an explicit date and offset when scheduling a
          post.
        </Txt>
        <Button title="Save preferences" onPress={() => save()} />
      </Card>
      <Card>
        <Txt bold>Appearance</Txt>
        <Row>
          {(['system', 'light', 'dark'] as const).map((v) => (
            <Button
              key={v}
              title={v}
              secondary={appearance !== v}
              onPress={() => setAppearance(v)}
            />
          ))}
        </Row>
        <Txt muted size={12}>
          Save preferences to persist appearance to your account.
        </Txt>
      </Card>
      <Card>
        <Txt bold>In-app reminders</Txt>
        <Txt muted>
          Scheduled tasks become ready when you open the app. Keep the app open to see updates.
          Background push notifications are not available in this version.
        </Txt>
      </Card>
      <Row>
        <Button title="Pages & default Page" secondary onPress={() => router.push('/pages')} />
        <Button title="Automations" secondary onPress={() => router.push('/integrations')} />
        <Button title="Browser workspace" secondary onPress={() => router.push('/browser' as never)} />
        <Button title="Activity" secondary onPress={() => router.push('/activity')} />
        <Button title="Analytics" secondary onPress={() => router.push('/analytics')} />
      </Row>
      <Row>
        <Button
          title="Privacy policy"
          secondary
          onPress={() => legal(process.env.EXPO_PUBLIC_PRIVACY_URL)}
        />
        <Button
          title="Terms of service"
          secondary
          onPress={() => legal(process.env.EXPO_PUBLIC_TERMS_URL)}
        />
      </Row>
      <Card>
        <Txt bold>Delete account & data</Txt>
        <Txt muted>
          This requests coordinated removal of your account, posts, groups, tasks,
          media and logs after subscription cancellation is verified. Facebook content is managed separately.
        </Txt>
        <Field
          label="Type DELETE to confirm"
          value={deletion}
          onChangeText={setDeletion}
          autoCapitalize="characters"
        />
        <Button
          title="Request account deletion"
          disabled={deletion !== 'DELETE' || op.isPending}
          secondary
          onPress={() =>
            Alert.alert('Request account deletion?', 'Billing and data removal will be reviewed before deletion.', [
              { text: 'Keep account', style: 'cancel' },
              { text: 'Delete account', style: 'destructive', onPress: remove },
            ])
          }
        />
      </Card>
      <Button title="Sign out" disabled={busy} onPress={logout} />
    </Screen>
  );
}
