import React, { useState } from 'react';
import { Alert } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { auth, db } from './config/firebase';
import { CURRENCIES, validatePlan, type MembershipPlan } from './membershipPlans';
import { Card, Txt, Field, Button } from './ui';
import { errorMessage } from './errors';
export function MembershipPlanEditor({ initial }: { initial: MembershipPlan }) {
  const [plan, setPlan] = useState(initial);
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const save = async () => {
    setBusy(true);
    try {
      validatePlan(plan);
      await setDoc(doc(db, 'membership_config', 'default'), {
        ...plan,
        updated_at: serverTimestamp(),
        updated_by: auth.currentUser!.uid,
      });
      await client.invalidateQueries({ queryKey: ['membership-plan'] });
      Alert.alert('Pricing saved', 'Members can now see your prices and payment instructions.');
    } catch (error) {
      Alert.alert('Pricing', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Txt bold size={18}>
        Monthly subscription prices
      </Txt>
      <Txt muted size={12}>
        Set each currency independently. A blank price is not offered. Payments are verified
        manually; these settings do not charge customers.
      </Txt>
      {CURRENCIES.map((currency) => (
        <Field
          key={currency}
          label={`${currency} per month`}
          value={plan.monthly_prices[currency]}
          keyboardType="decimal-pad"
          onChangeText={(value) =>
            setPlan((p) => ({
              ...p,
              monthly_prices: { ...p.monthly_prices, [currency]: value.trim() },
            }))
          }
        />
      ))}
      <Field
        label="Subscription contact email"
        value={plan.contact_email}
        onChangeText={(value) => setPlan((p) => ({ ...p, contact_email: value.trim() }))}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Field
        label="Payment and renewal instructions"
        value={plan.payment_instructions}
        onChangeText={(value) => setPlan((p) => ({ ...p, payment_instructions: value }))}
        multiline
        maxLength={2000}
      />
      <Button title="Save subscription prices" disabled={busy} onPress={save} />
    </Card>
  );
}
