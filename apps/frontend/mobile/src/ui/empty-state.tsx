import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from './tokens';

interface EmptyStateProps {
  readonly body: string;
  readonly title: string;
}

export function EmptyState({ body, title }: EmptyStateProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.stack,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
    padding: spacing.card,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
