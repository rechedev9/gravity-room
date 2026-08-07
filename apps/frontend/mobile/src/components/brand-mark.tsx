import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../app/design';

type BrandMarkProps = {
  readonly compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <View style={[styles.mark, compact ? styles.markCompact : null]} accessibilityElementsHidden>
      <Text style={[styles.letters, compact ? styles.lettersCompact : null]}>GR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  markCompact: {
    width: 42,
    height: 42,
    borderRadius: radii.control,
  },
  letters: {
    color: colors.accentPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -2,
  },
  lettersCompact: {
    fontSize: 16,
    letterSpacing: -1,
  },
});
