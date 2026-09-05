import { StyleSheet, View } from 'react-native';

import { colors } from '../shell/design';

type CornerTicksProps = {
  readonly size?: number;
  readonly color?: string;
};

/** Register marks on the focal panel — Forged Iron, no glow. */
export function CornerTicks({ size = 10, color = colors.ruleStrong }: CornerTicksProps) {
  const arm = { width: size, height: size, borderColor: color };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.tick, arm, styles.topLeft]} />
      <View style={[styles.tick, arm, styles.topRight]} />
      <View style={[styles.tick, arm, styles.bottomLeft]} />
      <View style={[styles.tick, arm, styles.bottomRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tick: {
    position: 'absolute',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
});
