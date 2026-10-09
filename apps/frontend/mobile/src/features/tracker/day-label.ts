const GENERIC_TOKEN = /\b(?:semana|week|d[ií]a|day)\s*\d+/giu;

/**
 * Program rows carry a stored label such as "Semana 1 - Dia 1(SQUAT)". The header already shows
 * the localized week and day, so only the part that adds information survives.
 */
export function distinctDayLabel(stored: string): string | null {
  const remainder = stored
    .replace(GENERIC_TOKEN, ' ')
    .replace(/[()[\]\-–—·:,]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return remainder === '' ? null : remainder;
}
