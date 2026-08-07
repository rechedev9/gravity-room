import { StyleSheet, View } from 'react-native';

import { colors, radii } from '../app/design';

export type TabIconName = 'programs' | 'tracker' | 'profile';

type TabIconProps = {
  readonly active: boolean;
  readonly name: TabIconName;
};

export function TabIcon({ active, name }: TabIconProps) {
  const tint = active ? colors.accentPrimary : colors.textMuted;

  if (name === 'programs') {
    return (
      <View style={styles.iconFrame} accessibilityElementsHidden>
        <View style={[styles.bookPage, styles.bookPageLeft, { borderColor: tint }]} />
        <View style={[styles.bookPage, styles.bookPageRight, { borderColor: tint }]} />
      </View>
    );
  }

  if (name === 'tracker') {
    return (
      <View style={styles.iconFrame} accessibilityElementsHidden>
        <View style={[styles.bar, { backgroundColor: tint }]} />
        <View style={[styles.plate, styles.plateLeft, { borderColor: tint }]} />
        <View style={[styles.plate, styles.plateRight, { borderColor: tint }]} />
      </View>
    );
  }

  return (
    <View style={styles.iconFrame} accessibilityElementsHidden>
      <View style={[styles.head, { borderColor: tint }]} />
      <View style={[styles.shoulders, { borderColor: tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookPage: {
    position: 'absolute',
    top: 3,
    width: 10,
    height: 16,
    borderWidth: 1.5,
  },
  bookPageLeft: {
    left: 2,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  bookPageRight: {
    right: 2,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  bar: {
    width: 22,
    height: 2,
    borderRadius: radii.pill,
  },
  plate: {
    position: 'absolute',
    width: 5,
    height: 15,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  plateLeft: {
    left: 2,
  },
  plateRight: {
    right: 2,
  },
  head: {
    position: 'absolute',
    top: 1,
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderRadius: radii.pill,
  },
  shoulders: {
    position: 'absolute',
    bottom: 1,
    width: 18,
    height: 9,
    borderWidth: 1.5,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomWidth: 0,
  },
});
