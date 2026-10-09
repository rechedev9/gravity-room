import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../shell/design';

type Props = {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Optional control aligned with the eyebrow, such as an add button. */
  readonly trailing?: ReactNode;
};

/** One header for every top-level tab, so titles sit at the same height and size. */
export function ScreenHeader({ eyebrow, title, subtitle, trailing }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.topLine}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {trailing}
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12 },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  eyebrow: { ...type.kicker, color: colors.accent, letterSpacing: 2 },
  title: { ...type.display, fontSize: 34, lineHeight: 40 },
  subtitle: { ...type.body, fontSize: 14, lineHeight: 21 },
});
