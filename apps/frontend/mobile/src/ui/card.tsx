import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../app/design';
import { CornerTicks } from './corner-ticks';

type CardProps = {
  readonly children: ReactNode;
  readonly focal?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

export function Card({ children, focal = false, style }: CardProps) {
  return (
    <View style={[styles.card, focal ? styles.focal : null, style]}>
      {focal ? <CornerTicks /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.card,
    padding: spacing.card,
    gap: 8,
  },
  focal: {
    borderColor: colors.ruleStrong,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
});
