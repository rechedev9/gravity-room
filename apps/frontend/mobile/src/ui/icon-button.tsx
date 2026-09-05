import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../shell/design';

type Props = {
  readonly name: ComponentProps<typeof Ionicons>['name'];
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
};

export function IconButton({ name, label, onPress, disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons accessible={false} name={name} size={21} color={colors.textSecondary} />
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
  pressed: { backgroundColor: colors.surface2 },
  disabled: { opacity: 0.3 },
});
