import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../shell/design';

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
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  option: {
    flexGrow: 1,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
  },
  label: { ...type.meta },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectedLabel: { color: colors.onAccent },
  disabled: { opacity: 0.35 },
});
