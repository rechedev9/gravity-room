import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from './tokens';

interface ScreenProps extends PropsWithChildren {
  readonly centered?: boolean;
  readonly testID?: string;
}

export function Screen({ centered = false, children, testID }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      <View style={[styles.content, centered ? styles.centered : null]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flex: 1,
    gap: spacing.stack,
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.stackLarge,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
