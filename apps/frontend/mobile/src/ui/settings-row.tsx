import type { ComponentProps, ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, type } from '../shell/design';

type IconName = ComponentProps<typeof Ionicons>['name'];

type BaseProps = {
  readonly icon: IconName;
  readonly label: string;
  readonly description?: string;
  readonly last?: boolean;
};

function RowBody({
  icon,
  label,
  description,
  trailing,
}: BaseProps & { readonly trailing?: ReactNode }) {
  return (
    <>
      <Ionicons accessible={false} name={icon} size={20} color={colors.textSecondary} />
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {trailing}
    </>
  );
}

type ValueRowProps = BaseProps & {
  readonly value?: string;
  /** Without a handler the row is informational and does not look pressable. */
  readonly onPress?: () => void;
  readonly external?: boolean;
  readonly accessibilityLabel?: string;
};

export function SettingsRow({
  value,
  onPress,
  external = false,
  accessibilityLabel,
  last = false,
  ...base
}: ValueRowProps) {
  const trailing = (
    <>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress ? (
        <Ionicons
          accessible={false}
          name={external ? 'open-outline' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.row, last ? styles.last : null]}>
        <RowBody {...base} trailing={trailing} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? base.label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, last ? styles.last : null, pressed && styles.pressed]}
    >
      <RowBody {...base} trailing={trailing} />
    </Pressable>
  );
}

type SwitchRowProps = BaseProps & {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  readonly disabled?: boolean;
};

export function SwitchRow({
  value,
  onValueChange,
  disabled = false,
  last,
  ...base
}: SwitchRowProps) {
  return (
    <View style={[styles.row, last ? styles.last : null]}>
      <RowBody
        {...base}
        trailing={
          <Switch
            accessibilityLabel={base.label}
            value={value}
            disabled={disabled}
            onValueChange={onValueChange}
            trackColor={{ false: colors.surface2, true: colors.accentDim }}
            thumbColor={value ? colors.accent : colors.textMuted}
            ios_backgroundColor={colors.surface2}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  last: { borderBottomWidth: 0 },
  pressed: { backgroundColor: colors.surface2 },
  copy: { flex: 1, gap: 3 },
  label: { ...type.body, color: colors.textPrimary, fontSize: 16, lineHeight: 22 },
  description: { ...type.body, fontSize: 13, lineHeight: 18 },
  value: {
    ...type.body,
    fontSize: 14,
    color: colors.textSecondary,
    maxWidth: '55%',
    flexShrink: 1,
    textAlign: 'right',
  },
});
