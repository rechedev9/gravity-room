import { type TextStyle } from 'react-native';

/**
 * Forged Iron tokens for native. Hex approximations of the web `oklch`
 * theme in `apps/frontend/web/src/styles/globals.css`. Surfaces are warm
 * iron; gold is the scarce signal (one per view); hierarchy is hairline
 * rules, never glow. Radii are machined (2px), not pills.
 */
export const colors = {
  canvas: '#14110E',
  card: '#1C1915',
  surface2: '#26221C',
  header: '#0E0C0B',
  ink: '#0A0908',
  textPrimary: '#EBE7E0',
  textSecondary: '#A59D92',
  textMuted: '#7E786F',
  rule: '#3A342C',
  ruleStrong: '#575147',
  accent: '#EAB53B',
  accentHover: '#F8C64E',
  accentDeep: '#AA7D25',
  accentDim: '#5E4925',
  onAccent: '#0A0704',
  ok: '#66BA7A',
  okBg: '#0F2416',
  fail: '#E86154',
  failBg: '#2C0806',
  warn: '#ED990E',
  errorBg: '#2C0806',
  errorLine: '#602A25',
  textError: '#E86154',
  // Back-compat aliases used by screens that still name the old palette.
  accentPrimary: '#EAB53B',
  accentSuccess: '#EAB53B',
  accentWarning: '#ED990E',
  accentDanger: '#E86154',
  borderSubtle: '#3A342C',
  borderStrong: '#575147',
} as const;

export const spacing = {
  screenX: 20,
  stack: 12,
  stackLarge: 16,
  card: 16,
  controlY: 12,
  controlX: 16,
} as const;

export const radii = {
  base: 2,
  card: 2,
  pill: 2,
} as const;

export const fonts = {
  display: 'Bebas Neue',
  body: 'Barlow',
  bodySemi: 'Barlow SemiBold',
  bodyBold: 'Barlow Bold',
  mono: 'JetBrains Mono',
  monoBold: 'JetBrains Mono Bold',
} as const;

export const type = {
  kicker: {
    fontFamily: fonts.monoBold,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  display: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: '400',
    letterSpacing: 1.2,
    lineHeight: 38,
  } satisfies TextStyle,
  displaySm: {
    fontFamily: fonts.display,
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: 1,
    lineHeight: 30,
  } satisfies TextStyle,
  displayData: {
    fontFamily: fonts.display,
    color: colors.accent,
    fontSize: 64,
    fontWeight: '400',
    letterSpacing: 0.6,
    lineHeight: 64,
  } satisfies TextStyle,
  title: {
    fontFamily: fonts.bodySemi,
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  } satisfies TextStyle,
  body: {
    fontFamily: fonts.body,
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  } satisfies TextStyle,
  meta: {
    fontFamily: fonts.monoBold,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  } satisfies TextStyle,
  button: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } satisfies TextStyle,
} as const;

export const tapTarget = {
  minHeight: 44,
} as const;
