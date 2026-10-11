import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@gzclp/design-tokens';

type Props = {
  readonly edge: 'top' | 'right';
  /** Thickness of the fade in dp, measured inward from the edge. */
  readonly size: number;
  readonly color?: string;
};

/** Opaque at the edge, transparent inward: softens content that scrolls out of sight. */
export function EdgeFade({ edge, size, color = colors.canvas }: Props) {
  const horizontal = edge === 'right';
  const placement: StyleProp<ViewStyle> = horizontal
    ? { top: 0, bottom: 0, right: 0, width: size }
    : { top: 0, left: 0, right: 0, height: size };
  const id = `edge-fade-${edge}`;
  return (
    <View accessible={false} pointerEvents="none" style={[styles.fade, placement]}>
      <Svg accessible={false} width="100%" height="100%">
        <Defs>
          <LinearGradient
            id={id}
            x1="0"
            y1="0"
            x2={horizontal ? '1' : '0'}
            y2={horizontal ? '0' : '1'}
          >
            <Stop offset="0" stopColor={color} stopOpacity={horizontal ? 0 : 1} />
            <Stop offset="1" stopColor={color} stopOpacity={horizontal ? 1 : 0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute' },
});
