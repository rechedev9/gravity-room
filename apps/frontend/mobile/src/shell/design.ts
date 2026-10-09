import { type TextStyle } from 'react-native';
import { colors, fonts, typeScale, type FontKey } from '@gzclp/design-tokens';

interface TypeScaleMetrics {
  font: FontKey;
  fontSize: number;
  fontWeight?: '400' | '600';
  letterSpacing?: number;
  lineHeight?: number;
}

function textMetrics<Scale extends TypeScaleMetrics>(scale: Scale) {
  const { font, ...metrics } = scale;
  return { fontFamily: fonts[font], ...metrics };
}

/** React Native text compositions built from the shared tokens. Rounded controls and a shared
 * sans-serif hierarchy keep dense workout data readable.
 */
export const type = {
  kicker: {
    ...textMetrics(typeScale.kicker),
    color: colors.textMuted,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  display: {
    ...textMetrics(typeScale.display),
    color: colors.textPrimary,
  } satisfies TextStyle,
  displaySm: {
    ...textMetrics(typeScale.displaySm),
    color: colors.textPrimary,
  } satisfies TextStyle,
  displayData: {
    ...textMetrics(typeScale.displayData),
    color: colors.accent,
  } satisfies TextStyle,
  title: {
    ...textMetrics(typeScale.title),
    color: colors.textPrimary,
  } satisfies TextStyle,
  body: {
    ...textMetrics(typeScale.body),
    color: colors.textSecondary,
  } satisfies TextStyle,
  meta: {
    ...textMetrics(typeScale.meta),
    color: colors.textMuted,
  } satisfies TextStyle,
  button: {
    ...textMetrics(typeScale.button),
  } satisfies TextStyle,
} as const;
