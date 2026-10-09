import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, type } from '../shell/design';

type Props = {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly clearLabel: string;
  readonly maxLength?: number;
};

export function SearchField({ value, onChangeText, placeholder, clearLabel, maxLength }: Props) {
  return (
    <View style={styles.field}>
      <Ionicons accessible={false} name="search-outline" size={20} color={colors.textMuted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        {...(maxLength === undefined ? {} : { maxLength })}
      />
      {value !== '' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Ionicons accessible={false} name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 12,
    paddingLeft: 14,
  },
  input: {
    ...type.body,
    color: colors.textPrimary,
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
  },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surface2, borderRadius: 12 },
});
