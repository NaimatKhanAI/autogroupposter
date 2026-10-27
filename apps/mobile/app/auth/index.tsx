import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Card, Txt, Button, Field, useTheme } from '../../src/ui';
import { auth, configured } from '../../src/config/firebase';
import { errorMessage } from '../../src/errors';
import { authFormSchema, type AuthMode } from '../../src/authValidation';
import {
  createAccount,
  signIn,
  resetPassword,
  resendVerification,
  refreshVerification,
  leaveVerification,
} from '../../src/auth';

export default function Auth() {
  const t = useTheme();
  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const {
    control,
    handleSubmit,
    resetField,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(authFormSchema(mode)),
    defaultValues: { email: '', password: '', displayName: '', confirmPassword: '' },
  });
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const verification = Boolean(user && !user.emailVerified);
  function changeMode(next: AuthMode) {
    if (busy) return;
    setMode(next);
    setError('');
    setNotice('');
    clearErrors();
    resetField('password');
    resetField('confirmPassword');
  }
  async function submit(v: { email: string; password: string; displayName: string }) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'register') {
        const result = await createAccount(v.email, v.password, v.displayName);
        setUser(result.user);
        setNotice(result.warning ?? 'Verification email sent. Check your inbox and spam folder.');
        setResendAt(Date.now() + 60000);
        resetField('password');
        resetField('confirmPassword');
      } else if (mode === 'reset') {
        await resetPassword(v.email);
        setNotice(
          'If an account exists for this address, a password reset link is on its way. Check your inbox and spam folder.',
        );
      } else {
        const signedIn = await signIn(v.email, v.password);
        setUser(signedIn);
        if (!signedIn.emailVerified)
          setNotice('Verify your email to open your workspace. You can resend the email below.');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(resend = false) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (resend) {
        if (Date.now() < resendAt)
          throw new Error('Please wait a minute before requesting another verification email.');
        await resendVerification();
        setResendAt(Date.now() + 60000);
        setNotice('A new verification email has been sent. Check your inbox and spam folder.');
      } else if (!(await refreshVerification()))
        setNotice(
          'Your email is not verified yet. Open the latest verification link, then come back here.',
        );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function switchAccount() {
    setBusy(true);
    try {
      await leaveVerification();
      setError('');
      setNotice('');
      setMode('login');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const title = verification
    ? 'Check your inbox'
    : mode === 'register'
      ? 'Create your account'
      : mode === 'reset'
        ? 'Forgot your password?'
        : 'Welcome back';
  const subtitle = verification
    ? 'One quick step before your next great post.'
    : mode === 'register'
      ? 'A little organization. A lot more momentum.'
      : mode === 'reset'
        ? "We'll send you a link to get back into your account."
        : 'Your posts, groups and next steps. All in one place.';
  const message = error || notice;
  return (
    <Screen title={title} hideHeader>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: t.accent,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="layers" size={23} color={t.dark ? '#0C151A' : '#FFFFFF'} />
        </View>
        <Txt bold size={20}>
          GroupPoster
        </Txt>
      </View>
      <View style={{ paddingTop: 12, paddingBottom: 4, gap: 9 }}>
        <Txt bold size={32} accessibilityRole="header">
          {title}
        </Txt>
        <Txt muted size={15}>
          {subtitle}
        </Txt>
      </View>
      {!verification && mode !== 'reset' && (
        <View
          style={{
            flexDirection: 'row',
            padding: 5,
            borderRadius: 16,
            backgroundColor: t.line,
            gap: 4,
          }}
        >
          {(['login', 'register'] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === v, disabled: busy }}
              disabled={busy}
              onPress={() => changeMode(v)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: mode === v ? t.surface : 'transparent',
              }}
            >
              <Txt size={14} bold color={mode === v ? t.text : t.muted}>
                {v === 'login' ? 'Sign in' : 'Create account'}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
      <Card style={{ padding: 22, gap: 19 }}>
        {verification ? (
          <>
            <View
              style={{
                width: 62,
                height: 62,
                backgroundColor: t.soft,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="mail-unread-outline" size={30} color={t.accent} />
            </View>
            <Txt bold size={19}>
              Verify your email address
            </Txt>
            <Txt muted>
              Open the verification link sent to <Txt bold>{user?.email}</Txt>, then return here to
              continue.
            </Txt>
          </>
        ) : (
          <>
            {mode === 'register' && (
              <Controller
                control={control}
                name="displayName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Full name"
                    placeholder="Your name"
                    autoComplete="name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!busy}
                    error={errors.displayName?.message}
                  />
                )}
              />
            )}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  label="Email address"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  editable={!busy}
                  error={errors.email?.message}
                />
              )}
            />
            {mode !== 'reset' && (
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Password"
                    placeholder={
                      mode === 'register' ? 'At least 8 characters' : 'Enter your password'
                    }
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!busy}
                    error={errors.password?.message}
                  />
                )}
              />
            )}
            {mode === 'register' && (
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Confirm password"
                    placeholder="Re-enter your password"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!busy}
                    error={errors.confirmPassword?.message}
                  />
                )}
              />
            )}
            {mode === 'login' && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => changeMode('reset')}
                style={{ alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center' }}
              >
                <Txt size={13} bold color={t.accent}>
                  Forgot password?
                </Txt>
              </Pressable>
            )}
          </>
        )}
        {!!message && (
          <View
            accessibilityLiveRegion="polite"
            style={{
              padding: 14,
              borderRadius: 12,
              gap: 5,
              backgroundColor: error ? (t.dark ? '#3B2529' : '#FFF0ED') : t.soft,
            }}
          >
            <Txt size={13} color={error ? t.danger : t.accent}>
              {message}
            </Txt>
          </View>
        )}
        <Button
          title={
            verification
              ? "I've verified my email"
              : mode === 'register'
                ? 'Create account'
                : mode === 'reset'
                  ? 'Send reset link'
                  : 'Sign in'
          }
          loading={busy}
          icon="arrow-forward"
          onPress={
            verification
              ? () => verify()
              : () => {
                  void handleSubmit(submit)();
                }
          }
        />
        {verification && (
          <>
            <Button
              title="Resend verification email"
              secondary
              disabled={busy}
              onPress={() => verify(true)}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={switchAccount}
              style={{ alignItems: 'center', padding: 10 }}
            >
              <Txt size={13} bold color={t.muted}>
                Use a different account
              </Txt>
            </Pressable>
          </>
        )}
        {!verification && mode === 'reset' && (
          <Button
            title="Back to sign in"
            secondary
            disabled={busy}
            onPress={() => changeMode('login')}
          />
        )}
      </Card>
      {!configured && (
        <View style={{ flexDirection: 'row', gap: 9, paddingHorizontal: 6 }}>
          <Ionicons name="information-circle-outline" size={19} color={t.muted} />
          <Txt muted size={12} style={{ flex: 1 }}>
            Account access is being set up. Please contact the app owner if you cannot sign in.
          </Txt>
        </View>
      )}
      {!verification && mode !== 'reset' && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          <Ionicons name="shield-checkmark-outline" size={14} color={t.accent} />
          <Txt muted size={11}>
            Your Facebook password stays with Facebook.
          </Txt>
        </View>
      )}
      <View
        style={{
          marginTop: 'auto',
          borderTopWidth: 1,
          borderTopColor: t.line,
          paddingTop: 18,
          gap: 6,
        }}
      >
        <Txt bold size={13}>
          Make every share more intentional.
        </Txt>
        <Txt muted size={12}>
          Organize your Page posts. Plan your group sharing. Keep your next step clear.
        </Txt>
      </View>
    </Screen>
  );
}
