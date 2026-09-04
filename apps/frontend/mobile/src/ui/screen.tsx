import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../app/design';

type ScreenProps = {
  readonly children: ReactNode;
  readonly padded?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

export function Screen({ children, padded = true, style }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[padded ? styles.padded : styles.fill, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  fill: {
    flex: 1,
  },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
    gap: spacing.stack,
  },
});
