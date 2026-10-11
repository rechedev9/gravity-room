import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@gzclp/design-tokens';
import { type } from '../shell/design';

type Props = {
  readonly name: ComponentProps<typeof Ionicons>['name'];
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  /** Visible word next to the glyph, for actions whose icon alone can be misread. */
  readonly caption?: string;
};

export function IconButton({ name, label, onPress, disabled = false, caption }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        caption !== undefined && styles.captioned,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons accessible={false} name={name} size={19} color={colors.textSecondary} />
      {caption !== undefined ? <Text style={styles.caption}>{caption}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  captioned: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
  },
  caption: { ...type.button, color: colors.textSecondary },
  pressed: { backgroundColor: colors.surface2 },
  disabled: { opacity: 0.3 },
});
