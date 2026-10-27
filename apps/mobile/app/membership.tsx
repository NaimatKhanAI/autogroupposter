import React from 'react';
import { Alert, Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';
import { auth, db } from '../src/config/firebase';
import { readMembershipPlan } from '../src/membershipApi';
import { CURRENCIES } from '../src/membershipPlans';
import { useMembership } from '../src/MembershipContext';
import { DAY_MS, membershipExpiry } from '../src/membership';
import { Screen, Card, Txt, Badge, Button, Row } from '../src/ui';
import { errorMessage } from '../src/errors';

const titles = {
  admin: 'Administrator access',
  free: 'Approved free access',
  trial: 'Your 14-day free trial',
  subscribed: 'Your subscription is active',
  expired: 'Continue with a subscription',
  blocked: 'Access is paused',
};
export default function Membership() {
  const access = useMembership();
  const plan = useQuery({ queryKey: ['membership-plan'], queryFn: () => readMembershipPlan(db) });
  const expires = membershipExpiry(access.record, access.status);
  const remaining = expires
    ? Math.max(0, Math.ceil((Date.parse(expires) - access.now) / DAY_MS))
    : 0;
  return (
    <Screen title="Membership" subtitle="Your access, trial and subscription in one place.">
      <Card>
        <Badge
          text={
            access.status === 'expired'
              ? 'TRIAL / SUBSCRIPTION EXPIRED'
              : access.status.toUpperCase()
          }
        />
        <Txt bold size={24}>
          {titles[access.status]}
        </Txt>
        {access.status === 'trial' && (
          <Txt>
            {remaining} {remaining === 1 ? 'day' : 'days'} remaining. Your trial starts once and
            lasts 14 days; it does not renew when you sign in again.
          </Txt>
        )}
        {access.status === 'free' && (
          <Txt>
            Your administrator has approved ongoing free access. You do not need a subscription
            while this approval remains active.
          </Txt>
        )}
        {access.status === 'subscribed' && (
          <Txt>
            Your administrator has activated your subscription. It remains valid until the date
            below.
          </Txt>
        )}
        {access.status === 'expired' && (
          <Txt>
            Your trial or subscription has ended. Ask your administrator to activate a subscription.
            Only accounts explicitly approved by an administrator receive ongoing free access.
          </Txt>
        )}
        {access.status === 'blocked' && (
          <Txt>Your administrator has paused this account. Contact them to review your access.</Txt>
        )}
        {access.status === 'admin' && (
          <Txt>Manage member approvals and subscription access from the Admin console.</Txt>
        )}
        {expires && <Txt muted>Access until: {new Date(expires).toLocaleString()}</Txt>}
        {access.allowed && (
          <Button title="Open workspace" onPress={() => router.replace('/(tabs)')} />
        )}
        {access.isAdmin && (
          <Button title="Admin console" secondary onPress={() => router.push('/admin')} />
        )}
      </Card>
      <Card>
        <Txt bold>Subscription activation</Txt>
        {CURRENCIES.filter((currency) => plan.data?.monthly_prices[currency]).map((currency) => (
          <Txt key={currency} bold>
            {currency} {plan.data!.monthly_prices[currency]} / month
          </Txt>
        ))}
        {plan.data?.payment_instructions && <Txt selectable>{plan.data.payment_instructions}</Txt>}
        {plan.data?.contact_email && (
          <Button
            title="Contact subscription admin"
            secondary
            onPress={() => {
              void Linking.openURL(
                `mailto:${encodeURIComponent(plan.data!.contact_email)}?subject=${encodeURIComponent('GroupPoster subscription')}`,
              ).catch(() => Alert.alert('Contact', plan.data!.contact_email));
            }}
          />
        )}
        <Txt muted>
          Subscriptions are activated by your administrator after payment is verified. Automatic
          card payments and recurring charges are not enabled. Contact the administrator for the
          current price and renewal options.
        </Txt>
        <Txt muted size={12}>
          No payment is collected on this screen. Expired access does not delete your workspace
          data.
        </Txt>
      </Card>
      <Card>
        <Txt bold>Account details</Txt>
        <Txt selectable>{auth.currentUser?.email ?? access.record?.email}</Txt>
        <Txt muted size={12} selectable>
          Account ID: {auth.currentUser?.uid}
        </Txt>
      </Card>
      <Row>
        <Button title="Account settings" secondary onPress={() => router.push('/settings')} />
        <Button
          title="Sign out"
          secondary
          onPress={() => {
            void signOut(auth)
              .then(() => router.replace('/auth'))
              .catch((e) => Alert.alert('Sign out', errorMessage(e)));
          }}
        />
      </Row>
    </Screen>
  );
}
