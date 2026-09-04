import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, radii, tapTarget, type } from '../app/design';

export type ButtonVariant = 'primary' | 'default' | 'danger' | 'ghost';

type ButtonProps = {
  readonly children: string;
  readonly variant?: ButtonVariant;
  readonly isLoading?: boolean;
  readonly accessibilityLabel?: string;
} & Pick<
  PressableProps,
  'onPress' | 'disabled' | 'testID' | 'accessibilityRole' | 'accessibilityState'
>;

export function Button({
  children,
  variant = 'default',
  isLoading = false,
  disabled,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.onAccent : colors.textPrimary}
          size="small"
        />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tapTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderRadius: radii.base,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  label: {
    ...type.button,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accentHover,
  },
  default: {
    backgroundColor: 'transparent',
    borderColor: colors.ruleStrong,
  },
  danger: {
    backgroundColor: 'transparent',
    borderColor: colors.fail,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
});

const labelStyles = StyleSheet.create({
  primary: {
    color: colors.onAccent,
  },
  default: {
    color: colors.textPrimary,
  },
  danger: {
    color: colors.fail,
  },
  ghost: {
    color: colors.textMuted,
  },
});
