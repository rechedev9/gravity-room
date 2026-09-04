import { StyleSheet, Text, View } from 'react-native';

import { colors, type } from '../app/design';

type KickerProps = {
  readonly children: string;
  readonly index?: string;
  readonly noRule?: boolean;
};

/** Indexed mono caps with a trailing hairline — Forged Iron wayfinding. */
export function Kicker({ children, index, noRule = false }: KickerProps) {
  return (
    <View style={styles.row}>
      {index ? <Text style={styles.index}>{index}</Text> : null}
      <Text style={styles.label}>{children}</Text>
      {noRule ? null : <View style={styles.rule} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  index: {
    ...type.kicker,
    color: colors.accentDeep,
  },
  label: {
    ...type.kicker,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.rule,
  },
});
