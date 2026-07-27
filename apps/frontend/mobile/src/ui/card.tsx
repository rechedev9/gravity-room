import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from './tokens';

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    gap: spacing.stack,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
    padding: spacing.card,
  },
});
