import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePreferences } from './store';
import { errorMessage } from './errors';
export const tokens = { radius: 22, space: 20, accent: '#137F72' };
export function useTheme() {
  const system = useColorScheme();
  const appearance = usePreferences((s) => s.appearance);
  const dark = (appearance === 'system' ? system : appearance) === 'dark';
  return {
    dark,
    bg: dark ? '#0C151A' : '#F5F7F8',
    surface: dark ? '#152329' : '#FFFFFF',
    text: dark ? '#EFF6F5' : '#142A31',
    muted: dark ? '#A1B3B7' : '#637980',
    line: dark ? '#293A40' : '#E5EBED',
    accent: dark ? '#5ED6BE' : '#137F72',
    soft: dark ? '#183D39' : '#EAF5F1',
    danger: dark ? '#FFADA8' : '#AE3934',
    input: dark ? '#101D23' : '#F8FAFB',
    hero: '#103D37',
  };
}
export function Txt({
  children,
  muted = false,
  size = 15,
  bold = false,
  color,
  ...props
}: {
  children: React.ReactNode;
  muted?: boolean;
  size?: number;
  bold?: boolean;
  color?: string;
} & React.ComponentProps<typeof Text>) {
  const t = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: color || (muted ? t.muted : t.text),
          fontSize: size,
          fontWeight: bold ? '700' : '400',
          lineHeight: size * 1.45,
          letterSpacing: size >= 24 ? -0.7 : 0,
        },
        props.style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Screen({
  title,
  eyebrow = 'YOUR WORKSPACE',
  subtitle,
  hideHeader,
  children,
  refresh,
  onRefresh,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
  refresh?: boolean;
  onRefresh?: () => void;
}) {
  const t = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 22,
            gap: 20,
            paddingBottom: 48,
            width: '100%',
            maxWidth: 700,
            alignSelf: 'center',
            flexGrow: 1,
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                tintColor={t.accent}
                colors={[t.accent]}
                refreshing={refresh ?? false}
                onRefresh={onRefresh}
              />
            ) : undefined
          }
        >
          {!hideHeader && (
            <View style={{ gap: 18, paddingTop: 6, paddingBottom: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    backgroundColor: t.soft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="layers" size={17} color={t.accent} />
                </View>
                <Txt size={13} bold style={{ letterSpacing: -0.2 }}>
                  GroupPoster
                </Txt>
                <View style={{ flex: 1 }} />
                <Txt size={9} bold color={t.muted} style={{ letterSpacing: 1.3 }}>
                  WORKSPACE
                </Txt>
              </View>
              <View style={{ gap: 5 }}>
                <Txt size={10} bold color={t.muted} style={{ letterSpacing: 1.7 }}>
                  {eyebrow}
                </Txt>
                <Txt size={28} bold accessibilityRole="header">
                  {title}
                </Txt>
                {subtitle && <Txt muted>{subtitle}</Txt>}
              </View>
            </View>
          )}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: tokens.radius,
          padding: 20,
          gap: 14,
          borderWidth: 1,
          borderColor: t.line,
          boxShadow: t.dark ? undefined : '0px 3px 14px rgba(20, 42, 49, 0.025)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      {children}
    </View>
  );
}
export function FilterBar({
  values,
  value,
  onChange,
}: {
  values: { key: string; title: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {values.map((v) => (
        <Pressable
          key={v.key}
          accessibilityRole="button"
          accessibilityState={{ selected: value === v.key }}
          onPress={() => onChange(v.key)}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 17,
            minHeight: 44,
            borderRadius: 24,
            backgroundColor: value === v.key ? t.accent : t.surface,
            borderWidth: 1,
            borderColor: value === v.key ? t.accent : t.line,
          }}
        >
          <Txt size={13} bold color={value === v.key ? (t.dark ? '#0C151A' : '#FFFFFF') : t.muted}>
            {v.title}
          </Txt>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
}) {
  const t = useTheme();
  const color = secondary ? t.accent : t.dark ? '#0C151A' : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        paddingHorizontal: 18,
        paddingVertical: 13,
        borderRadius: 14,
        backgroundColor: secondary ? t.soft : t.accent,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        icon && <Ionicons name={icon} size={18} color={color} />
      )}
      <Txt bold size={14} color={color}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.ComponentProps<typeof TextInput>) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Txt size={12} bold color={t.muted}>
        {label}
      </Txt>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={t.muted}
          selectionColor={t.accent}
          {...props}
          secureTextEntry={props.secureTextEntry && !visible}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              backgroundColor: t.input,
              color: t.text,
              borderColor: error ? t.danger : focused ? t.accent : t.line,
              borderWidth: 1,
              borderRadius: 14,
              padding: 15,
              paddingRight: props.secureTextEntry ? 52 : 15,
              minHeight: 54,
              fontSize: 15,
              textAlignVertical: props.multiline ? 'top' : 'center',
            },
            props.style,
          ]}
        />
        {props.secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            onPress={() => setVisible((v) => !v)}
            style={{
              position: 'absolute',
              right: 3,
              top: 3,
              bottom: 3,
              width: 46,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={t.muted}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Txt accessibilityLiveRegion="polite" size={12} color={t.danger}>
          {error}
        </Txt>
      )}
    </View>
  );
}
export function Badge({ text }: { text: string }) {
  const t = useTheme();
  const danger = /failed|expired|error|inactive|cancelled|revoked/i.test(text);
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: danger ? (t.dark ? '#3B2529' : '#FFF0ED') : t.soft,
      }}
    >
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: danger ? t.danger : t.accent,
        }}
      />
      <Txt size={10} bold color={danger ? t.danger : t.accent}>
        {text}
      </Txt>
    </View>
  );
}
export function State({
  loading,
  error,
  empty,
  retry,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Your items will appear here when you add them.',
  emptyAction,
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  retry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { title: string; onPress: () => void };
}) {
  const t = useTheme();
  if (loading) return <LoadingCard />;
  if (error)
    return (
      <Card>
        <Ionicons name="cloud-offline-outline" size={26} color={t.danger} />
        <Txt bold>We could not load this screen</Txt>
        <Txt muted>{errorMessage(error)}</Txt>
        {retry && <Button title="Try again" secondary icon="refresh-outline" onPress={retry} />}
      </Card>
    );
  if (empty)
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 21,
            backgroundColor: t.soft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 3,
          }}
        >
          <Ionicons name="file-tray-outline" size={28} color={t.accent} />
        </View>
        <Txt bold size={17}>
          {emptyTitle}
        </Txt>
        <Txt muted size={13} style={{ textAlign: 'center', maxWidth: 290 }}>
          {emptyDescription}
        </Txt>
        {emptyAction && (
          <Button secondary title={emptyAction.title} onPress={emptyAction.onPress} />
        )}
      </Card>
    );
  return null;
}
function LoadingCard() {
  const t = useTheme();
  return (
    <Card>
      <Row>
        <ActivityIndicator color={t.accent} />
        <Txt muted size={13}>
          Loading your workspace...
        </Txt>
      </Row>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ gap: 12 }}
      >
        {['65%', '100%', '85%'].map((width, i) => (
          <View
            key={i}
            style={{
              height: i ? 10 : 18,
              width: width as `${number}%`,
              borderRadius: 8,
              backgroundColor: t.line,
            }}
          />
        ))}
      </View>
    </Card>
  );
}
export const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '46%', flexGrow: 1 },
  separator: { height: 1 },
});
