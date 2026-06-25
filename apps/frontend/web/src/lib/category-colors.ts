// Forged Iron: category badges read as part of the warm/iron palette, never as
// three loud web hues. Each value sits on the warm OKLCH ladder (hue 44-96, low
// chroma) so it stays palette-native next to the scarce gold accent while still
// being distinguishable by both hue and lightness.
//
//   strength     pale brass / khaki-gold   oklch(0.70 0.045 96)
//   hypertrophy  warm amber                oklch(0.64 0.085 70)
//   powerlifting deep copper / terracotta  oklch(0.56 0.075 44)
//
// Hex is precomputed (sRGB) since consumers apply these as inline badge/gradient
// styles. The export shape and keys are unchanged.
const CATEGORY_COLORS: Record<string, { readonly badge: string; readonly gradient: string }> = {
  strength: { badge: '#a69f7f', gradient: 'rgba(166,159,127,0.08)' },
  hypertrophy: { badge: '#ad8351', gradient: 'rgba(173,131,81,0.08)' },
  powerlifting: { badge: '#9a6650', gradient: 'rgba(154,102,80,0.08)' },
};

const FALLBACK_CATEGORY_COLOR: { readonly badge: string; readonly gradient: string } = {
  badge: '#e8aa20',
  gradient: 'rgba(232,170,32,0.08)',
};

export function getCategoryColor(category: string): {
  readonly badge: string;
  readonly gradient: string;
} {
  return CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_COLOR;
}
