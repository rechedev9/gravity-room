import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, type } from '../shell/design';

type Props<Value extends string> = {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly { readonly value: Value; readonly label: string }[];
  readonly onChange: (value: Value) => void;
  readonly disabled?: boolean;
};

export function SegmentedChoice<Value extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: Props<Value>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: option.value === value, disabled }}
          disabled={disabled}
          onPress={() => onChange(option.value)}
          style={[
            styles.option,
            option.value === value ? styles.selected : null,
            disabled ? styles.disabled : null,
          ]}
        >
          <Text style={[styles.label, option.value === value ? styles.selectedLabel : null]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radii.base + 4,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  option: {
    flex: 1,
    borderRadius: radii.base,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: { ...type.button, color: colors.textMuted },
  selected: { backgroundColor: colors.accent },
  selectedLabel: { color: colors.onAccent },
  disabled: { opacity: 0.35 },
});
