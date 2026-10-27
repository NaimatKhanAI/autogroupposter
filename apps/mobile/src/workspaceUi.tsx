import React from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Txt, useTheme } from './ui';
export function SectionHeading({
  title,
  description,
  count,
}: {
  title: string;
  description?: string;
  count?: number;
}) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt bold size={18}>
          {title}
        </Txt>
        {count !== undefined && (
          <Txt muted size={12}>
            ({count})
          </Txt>
        )}
      </View>
      {description && (
        <Txt muted size={13}>
          {description}
        </Txt>
      )}
    </View>
  );
}
export function ChoiceCard({
  title,
  description,
  selected,
  onPress,
  disabled = false,
  kind = 'checkbox',
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'checkbox' | 'radio';
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityLabel={title}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 16,
        borderWidth: 1,
        borderColor: selected ? t.accent : t.line,
        borderRadius: 16,
        backgroundColor: selected ? t.soft : t.surface,
        opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 66,
      })}
    >
      <Ionicons
        name={
          kind === 'radio'
            ? selected
              ? 'radio-button-on'
              : 'radio-button-off'
            : selected
              ? 'checkbox'
              : 'square-outline'
        }
        color={selected ? t.accent : t.muted}
        size={22}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt bold size={14}>
          {title}
        </Txt>
        {description && (
          <Txt muted size={12} numberOfLines={2}>
            {description}
          </Txt>
        )}
      </View>
      {disabled && <Ionicons name="checkmark-circle-outline" color={t.muted} size={18} />}
    </Pressable>
  );
}
export function SummaryStrip({
  items,
}: {
  items: {
    label: string;
    value: number | string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
  }[];
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            flexGrow: 1,
            flexBasis: items.length % 2 === 0 ? '44%' : '28%',
            padding: 15,
            gap: 7,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor: t.surface,
          }}
        >
          <Ionicons name={item.icon} size={18} color={t.accent} />
          <Txt bold size={24}>
            {item.value}
          </Txt>
          <Txt muted size={11}>
            {item.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}
