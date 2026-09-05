import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radii } from '../shell/design';

type Props = {
  readonly children: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
};

export function Chip({ children, selected = false, disabled = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, selected ? styles.selected : null, disabled ? styles.disabled : null]}
    >
      <Text style={[styles.label, selected ? styles.selectedLabel : null]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.pill,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textMuted },
  selected: { backgroundColor: colors.surface2 },
  selectedLabel: { color: colors.textPrimary },
  disabled: { opacity: 0.35 },
});
