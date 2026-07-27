import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii } from './tokens';

interface ButtonProps {
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly label: string;
  readonly onPress: () => void;
}

export function Button({
  accessibilityLabel,
  disabled = false,
  isLoading = false,
  label,
  onPress,
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {isLoading ? <ActivityIndicator color={colors.canvas} /> : null}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    color: colors.canvas,
    fontSize: 15,
    fontWeight: '700',
  },
});
