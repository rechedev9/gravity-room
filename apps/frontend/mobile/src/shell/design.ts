import { type TextStyle } from 'react-native';

/** Native surfaces are quiet and warm; gold identifies the current action.
 * Rounded controls and a shared sans-serif hierarchy keep dense workout data readable.
 */
export const colors = {
  canvas: '#111110',
  card: '#1C1C1A',
  surface2: '#272724',
  header: '#141413',
  ink: '#0A0908',
  textPrimary: '#EBE7E0',
  textSecondary: '#B7B7AB',
  textMuted: '#96968B',
  rule: '#30302C',
  ruleStrong: '#45453E',
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
  base: 10,
  card: 16,
  pill: 24,
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
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 36,
  } satisfies TextStyle,
  displaySm: {
    fontFamily: fonts.bodyBold,
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 32,
  } satisfies TextStyle,
  displayData: {
    fontFamily: fonts.bodyBold,
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
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  } satisfies TextStyle,
} as const;

export const tapTarget = {
  minHeight: 44,
} as const;
