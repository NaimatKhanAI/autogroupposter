import { errorMessage } from '../../src/errors';
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Alert } from 'react-native';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../../src/config/firebase';
import { Screen, Txt, Field, Button } from '../../src/ui';
export default function Callback() {
  const { oobCode, mode } = useLocalSearchParams<{ oobCode?: string; mode?: string }>();
  const [message, setMessage] = useState(
    'Open your Firebase email link to verify your account or reset your password.',
  );
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!oobCode) return;
    let active = true;
    async function verify() {
      try {
        if (mode === 'resetPassword') {
          await verifyPasswordResetCode(auth, oobCode!);
          if (active) {
            setRecovery(true);
            setMessage('Choose a new password.');
          }
        } else if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode!);
          await auth.currentUser?.reload();
          await auth.currentUser?.getIdToken(true);
          if (active) setMessage('Email verified. You can sign in.');
        } else throw new Error('Unsupported email action. Request a new link.');
      } catch (e) {
        if (active) setMessage(errorMessage(e));
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, [oobCode, mode]);
  async function save() {
    if (!oobCode || password.length < 8)
      return Alert.alert('Password', 'Use at least 8 characters.');
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      router.replace('/auth');
    } catch (e) {
      Alert.alert('Password', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Account verification">
      <Txt>{message}</Txt>
      {recovery && (
        <>
          <Field label="New password" secureTextEntry value={password} onChangeText={setPassword} />
          <Button title="Save password" disabled={busy} onPress={save} />
        </>
      )}
      <Button title="Back to sign in" secondary onPress={() => router.replace('/auth')} />
    </Screen>
  );
}
