/** Native surfaces are quiet and warm; gold identifies the current action.
 * These values are the single source for the mobile app and the web dark theme.
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
  /** Room under scroll content so the last control clears the tab bar. */
  tabClearance: 96,
} as const;

export const radii = {
  base: 10,
  card: 16,
  pill: 24,
} as const;

export const tapTarget = {
  minHeight: 44,
} as const;

export const fonts = {
  display: 'Bebas Neue',
  body: 'Barlow',
  bodySemi: 'Barlow SemiBold',
  bodyBold: 'Barlow Bold',
  mono: 'JetBrains Mono',
  monoBold: 'JetBrains Mono Bold',
} as const;

export type FontKey = keyof typeof fonts;

interface TypeScaleEntry {
  font: FontKey;
  fontSize: number;
  fontWeight?: '400' | '600';
  letterSpacing?: number;
  lineHeight?: number;
}

/** The weight is part of each face name. A fontWeight of 700 or more on a custom face makes
 * Android look the face up as a bold variant, miss it and fall back to system Roboto Bold. */
export const typeScale = {
  kicker: { font: 'monoBold', fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },
  display: { font: 'bodyBold', fontSize: 30, letterSpacing: -0.5, lineHeight: 36 },
  displaySm: { font: 'bodyBold', fontSize: 26, letterSpacing: -0.3, lineHeight: 32 },
  displayData: {
    font: 'bodyBold',
    fontSize: 64,
    fontWeight: '400',
    letterSpacing: 0.6,
    lineHeight: 64,
  },
  title: { font: 'bodySemi', fontSize: 20, fontWeight: '600' },
  body: { font: 'body', fontSize: 16, lineHeight: 24 },
  meta: { font: 'monoBold', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  button: { font: 'bodySemi', fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },
} as const satisfies Record<string, TypeScaleEntry>;
