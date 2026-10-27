import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { auth, db } from '../src/config/firebase';
import { normalize } from '../src/firebaseOperations';
import { useMembership } from '../src/MembershipContext';
import { membershipStatus, type MembershipRecord } from '../src/membership';
import {
  readMembershipPlan,
  updateMembership,
  type AdminMembershipAction,
} from '../src/membershipApi';
import { MembershipPlanEditor } from '../src/MembershipPlanEditor';
import { Screen, Card, Txt, Badge, Button, Row, Field, State } from '../src/ui';
import { errorMessage } from '../src/errors';
import { SummaryStrip } from '../src/workspaceUi';

export default function Admin() {
  const access = useMembership();
  const [search, setSearch] = useState('');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const plan = useQuery({
    queryKey: ['membership-plan'],
    queryFn: () => readMembershipPlan(db),
    enabled: access.isAdmin,
  });
  const members = useQuery<MembershipRecord[]>({
    queryKey: ['admin-memberships', auth.currentUser?.uid],
    enabled: access.isAdmin,
    queryFn: async () =>
      (
        await getDocs(
          query(collection(db, 'memberships'), orderBy('trial_started_at', 'desc'), limit(100)),
        )
      ).docs.map((d) => normalize(d.data())),
  });
  if (!access.isAdmin)
    return (
      <Screen title="Admin console">
        <State
          empty
          emptyTitle="Administrator access required"
          emptyDescription="This account cannot manage membership approvals."
        />
        <Button title="Membership" onPress={() => router.replace('/membership')} />
      </Screen>
    );
  const term = search.trim().toLowerCase();
  const visible = members.data?.filter((m) =>
    `${m.email} ${m.display_name} ${m.uid}`.toLowerCase().includes(term),
  );
  const change = (member: MembershipRecord, action: AdminMembershipAction, title: string) => {
    Alert.alert(
      title,
      `${member.email}\n${action === 'subscribe' ? `Add ${days} days after verified payment. This does not charge a card.` : 'This changes the member’s workspace access immediately.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            setBusy(true);
            void updateMembership(db, auth.currentUser!.uid, member.uid, action, Number(days))
              .then(() => members.refetch())
              .catch((e) => Alert.alert('Membership update', errorMessage(e)))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };
  return (
    <Screen
      title="Admin console"
      subtitle="Approve free members and manage paid access."
      onRefresh={() => members.refetch()}
      refresh={members.isRefetching}
    >
      <Card>
        <Badge text="ADMINISTRATOR" />
        <Txt bold>Membership controls</Txt>
        <Txt muted>
          Normal accounts receive one 14-day trial. Only an administrator can approve ongoing free
          access, activate a paid period or pause an account.
        </Txt>
      </Card>
      {members.data && (
        <SummaryStrip
          items={[
            { label: 'Listed accounts', value: members.data.length, icon: 'people-outline' },
            {
              label: 'Approved free',
              value: members.data.filter((m) => !m.blocked && m.approved_free).length,
              icon: 'checkmark-circle-outline',
            },
            {
              label: 'Paid access',
              value: members.data.filter((m) => membershipStatus(m, access.now) === 'subscribed')
                .length,
              icon: 'card-outline',
            },
          ]}
        />
      )}
      <Field
        label="Find a member"
        placeholder="Email, display name or account ID"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />
      <State loading={plan.isLoading} error={plan.error} retry={() => plan.refetch()} />
      {plan.data && <MembershipPlanEditor initial={plan.data} />}
      <Field
        label="Subscription duration (days)"
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
      />
      <Txt muted size={12}>
        Showing the 100 most recently registered accounts. Pull down to refresh. Subscription
        activation records verified payment; it does not collect payment.
      </Txt>
      <State
        loading={members.isLoading}
        error={members.error}
        retry={() => members.refetch()}
        empty={visible?.length === 0}
        emptyTitle="No matching members"
        emptyDescription="Members appear after they verify their email and open the updated app."
      />
      {visible?.map((member) => (
        <Card key={member.uid}>
          <Row>
            <Txt bold size={17}>
              {member.display_name || member.email}
            </Txt>
            <Badge text={membershipStatus(member, access.now)} />
          </Row>
          <Txt selectable>{member.email}</Txt>
          <Txt muted size={11} selectable>
            {member.uid}
          </Txt>
          <Txt muted size={12}>
            Trial started: {new Date(member.trial_started_at).toLocaleDateString()}
          </Txt>
          {member.subscription_until && (
            <Txt muted size={12}>
              Paid until: {new Date(member.subscription_until).toLocaleString()}
            </Txt>
          )}
          <Row>
            <Button
              title={member.approved_free ? 'Revoke free access' : 'Approve free access'}
              secondary
              disabled={busy}
              onPress={() =>
                change(
                  member,
                  member.approved_free ? 'revoke_free' : 'approve_free',
                  member.approved_free ? 'Revoke free approval?' : 'Approve ongoing free access?',
                )
              }
            />
            <Button
              title="Activate / extend subscription"
              disabled={busy || member.approved_free}
              onPress={() => change(member, 'subscribe', 'Activate paid access?')}
            />
            {member.subscription_until && (
              <Button
                title="End paid access"
                secondary
                disabled={busy}
                onPress={() => change(member, 'cancel_subscription', 'End paid access now?')}
              />
            )}
            <Button
              title={member.blocked ? 'Restore access' : 'Pause access'}
              secondary
              disabled={busy || member.uid === auth.currentUser?.uid}
              onPress={() =>
                change(
                  member,
                  member.blocked ? 'unblock' : 'block',
                  member.blocked ? 'Restore account access?' : 'Pause account access?',
                )
              }
            />
          </Row>
        </Card>
      ))}
      <Button title="Back to membership" secondary onPress={() => router.replace('/membership')} />
    </Screen>
  );
}
