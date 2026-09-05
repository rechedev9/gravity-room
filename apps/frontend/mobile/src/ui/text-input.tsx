import {
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, radii, type } from '../shell/design';

type Props = TextInputProps & { readonly label: string; readonly error?: string };

export function TextInput({ label, error, style, ...props }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <NativeTextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        {...props}
        style={[styles.input, error ? styles.invalid : null, style]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...type.meta },
  input: {
    ...type.body,
    color: colors.textPrimary,
    minHeight: 44,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radii.base,
    backgroundColor: colors.card,
  },
  invalid: { borderColor: colors.fail },
  error: { ...type.body, color: colors.textError, fontSize: 14 },
});
