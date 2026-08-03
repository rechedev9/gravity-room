// Book prescription tables for Brunetti 365 (OCR anchors).
// Brunetti fundamental notation: REPS × SETS → stored as {pct, sets, reps}.

/** JAW B1–B3: Brunetti reps×sets → {pct, sets, reps}. OCR p.86. */
export const BOOK_JAW_B1 = [
  { pct: 0.7, sets: 6, reps: 10 }, // 70% 10x6s
  { pct: 0.72, sets: 5, reps: 10 },
  { pct: 0.74, sets: 4, reps: 10 },
  { pct: 0.76, sets: 3, reps: 10 },
  { pct: 0.8, sets: 4, reps: 5 }, // scarico 80% 5x4s
] as const;

export const BOOK_JAW_B2 = [
  { pct: 0.8, sets: 6, reps: 6 },
  { pct: 0.82, sets: 5, reps: 6 },
  { pct: 0.84, sets: 4, reps: 6 },
  { pct: 0.86, sets: 3, reps: 6 },
  { pct: 0.75, sets: 5, reps: 3 }, // scarico 75% 3x5s
] as const;

export const BOOK_JAW_B3 = [
  { pct: 0.9, sets: 6, reps: 3 },
  { pct: 0.92, sets: 5, reps: 3 },
  { pct: 0.94, sets: 4, reps: 3 },
  { pct: 0.96, sets: 3, reps: 3 },
  { pct: 0.825, sets: 3, reps: 4 }, // scarico 82.5% 4x3s
] as const;

/** T1 Giorno 1 panca: OCR p.43 — 50% 8/9/10×6s then 55% 8/9/10×6s */
export const BOOK_T1_BENCH_D1 = [
  { pct: 0.5, sets: 6, reps: 8 },
  { pct: 0.5, sets: 6, reps: 9 },
  { pct: 0.5, sets: 6, reps: 10 },
  { pct: 0.55, sets: 6, reps: 8 },
  { pct: 0.55, sets: 6, reps: 9 },
  { pct: 0.55, sets: 6, reps: 10 },
] as const;

/** T1 Giorno 1 stacco: OCR p.43 */
export const BOOK_T1_DL_D1 = [
  { pct: 0.55, sets: 5, reps: 5 }, // Sett1-2 55% 5x5
  { pct: 0.55, sets: 5, reps: 5 },
  { pct: 0.6, sets: 4, reps: 6 }, // Sett3-4 60% 6x4s
  { pct: 0.6, sets: 4, reps: 6 },
  { pct: 0.65, sets: 6, reps: 4 }, // Sett5-6 65% 4x6s
  { pct: 0.65, sets: 6, reps: 4 },
] as const;

/** T1 Box Squat Giorno 3: OCR p.44 */
export const BOOK_T1_BOX_SQUAT = [
  { pct: 0.6, sets: 6, reps: 6 }, // 60% 6x6
  { pct: 0.55, sets: 5, reps: 7 }, // 55% 7x5s
  { pct: 0.6, sets: 6, reps: 8 },
  { pct: 0.65, sets: 5, reps: 9 },
  { pct: 0.6, sets: 6, reps: 10 },
  { pct: 0.65, sets: 5, reps: 5 }, // 65% 5x5
] as const;

/** PN2 Blocco1 Giorno 1 squat main volume (OCR p.72). Extra singles/backoff in notes. */
export const BOOK_PN_SQUAT_D1_MAIN = [
  { pct: 0.72, sets: 5, reps: 5 }, // Sett1 72% 5x5
  { pct: 0.6, sets: 4, reps: 8 }, // Sett2 60% 8x4s
  { pct: 0.74, sets: 5, reps: 5 },
  { pct: 0.63, sets: 4, reps: 8 },
  { pct: 0.65, sets: 4, reps: 4 }, // Sett5 65% 4x4 then 80% 2x2 as second slot
] as const;

/** PN2 Blocco1 Giorno 1 panca pin (OCR p.72) */
export const BOOK_PN_BENCH_D1 = [
  { pct: 0.7, sets: 7, reps: 4 }, // 70% 4x7s
  { pct: 0.75, sets: 7, reps: 3 },
  { pct: 0.7, sets: 6, reps: 4 },
  { pct: 0.75, sets: 7, reps: 3 },
  { pct: 0.65, sets: 3, reps: 5 }, // Leggero 65% 5x3s
] as const;

/**
 * PN2 Blocco1 Giorno Tre stacco volume (OCR p.73).
 * Not identical to squat D1: Sett4 is 63% 8x3s (not 8x4s).
 */
export const BOOK_PN_DL_D3_B1 = [
  { pct: 0.72, sets: 5, reps: 5 }, // Sett1 72% 5x5
  { pct: 0.6, sets: 4, reps: 8 }, // Sett2 60% 8x4s
  { pct: 0.74, sets: 5, reps: 5 }, // Sett3 74% 5x5
  { pct: 0.63, sets: 3, reps: 8 }, // Sett4 63% 8x3s
  { pct: 0.65, sets: 4, reps: 4 }, // Sett5 65% 4x4
] as const;

/**
 * PN2 Blocco2 Giorno Tre panca fermo 1" (OCR p.76 Sett6–12).
 * Index 0 = Sett6 … index 6 = Sett12.
 */
export const BOOK_PN_BENCH_D3_B2 = [
  { pct: 0.8, sets: 6, reps: 2 }, // Sett6 80% 2x6s
  { pct: 0.75, sets: 6, reps: 2 }, // Sett7 75% 2x6s
  { pct: 0.8, sets: 6, reps: 2 }, // Sett8 80% 2x6s
  { pct: 0.75, sets: 4, reps: 2 }, // Sett9 75% 2x4s
  { pct: 0.7, sets: 4, reps: 4 }, // Sett10 Leggero 70% 4x4
  { pct: 0.8, sets: 5, reps: 2 }, // Sett11 80% 2x5s
  { pct: 0.75, sets: 4, reps: 2 }, // Sett12 75% 2x4s
] as const;

/**
 * PN2 Blocco2 Giorno Uno squat main volume (OCR p.74 Sett6–13).
 * Index 0 = Sett6 … index 7 = Sett13.
 */
export const BOOK_PN_SQUAT_D1_B2 = [
  { pct: 0.76, sets: 5, reps: 4 }, // Sett6 76% ~44344
  { pct: 0.66, sets: 4, reps: 6 }, // Sett7 66% 6x4s
  { pct: 0.78, sets: 5, reps: 2 }, // Sett8 78% 22225
  { pct: 0.69, sets: 3, reps: 5 }, // Sett9 69% 5x3s
  { pct: 0.8, sets: 5, reps: 3 }, // Sett10 80% 3-3-2-3-3
  { pct: 0.72, sets: 3, reps: 5 }, // Sett11 72% 5x3s
  { pct: 0.82, sets: 5, reps: 2 }, // Sett12 82% 22225
  { pct: 0.66, sets: 4, reps: 6 }, // Sett13 66% 6x4s
] as const;

/** IS Sottofase 1 Squat Giorno 1 Soluzione A (OCR p.182–183) */
export const BOOK_IS_SQUAT_D1 = [
  { kind: 'heavy' as const, main: { pct: 0.8, sets: 7, reps: 3 } }, // 80% 3x7s
  { kind: 'volume' as const, main: { pct: 0.75, sets: 6, reps: 4 } }, // 75% 4x6s
  {
    kind: 'light' as const,
    main: { pct: 0.825, sets: 3, reps: 2 },
    back: { pct: 0.75, sets: 2, reps: 2 },
  },
] as const;

/** IS Panca Giorno 1 (OCR p.189) */
export const BOOK_IS_BENCH_D1 = [
  { pct: 0.825, sets: 7, reps: 2 }, // 82.5% 2x7s
  { pct: 0.8, sets: 8, reps: 3 }, // 80% 3x8s (OCR 3x85 → 3x8s)
  { pct: 0.75, sets: 4, reps: 2 }, // light + optional 82.5% single block
] as const;

export const FZ_EXIT_NOTES =
  'Criterios de salida (libro): 3 reps sentadilla al peso corporal con tempo 5s-3s-5s; ' +
  '1 rep press banca al peso corporal con tecnica perfecta; ' +
  '10 reps peso muerto al peso corporal con subida controlada. ' +
  'Mujeres: mismos criterios al 70% del peso corporal.';
