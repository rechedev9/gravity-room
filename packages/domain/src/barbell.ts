import { roundToNearest } from './generic-engine';

/** Standard competition-ish kg plate set, heaviest first. */
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export const DEFAULT_BAR_KG = 20;

export interface PlateGroup {
  readonly plate: number;
  readonly count: number;
}

export interface PlateLoading {
  readonly barWeight: number;
  /** Plates to hang on each side, heaviest first. */
  readonly perSide: readonly PlateGroup[];
  /** Weight the loading actually produces — may differ from the request. */
  readonly achievedWeight: number;
  /** Requested minus achieved; non-zero when the plate set cannot express it. */
  readonly remainder: number;
}

/**
 * How to load a bar for a target weight. Returns `null` when the target is
 * below the bar — there is nothing to load and the caller should say so rather
 * than render an empty breakdown.
 */
export function computePlateLoading(
  targetWeight: number,
  barWeight: number = DEFAULT_BAR_KG,
  plates: readonly number[] = DEFAULT_PLATES_KG
): PlateLoading | null {
  if (!Number.isFinite(targetWeight) || !Number.isFinite(barWeight)) return null;
  if (barWeight < 0 || targetWeight < barWeight) return null;

  const sorted = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  let remainingPerSide = (targetWeight - barWeight) / 2;
  const perSide: PlateGroup[] = [];

  for (const plate of sorted) {
    const count = Math.floor(remainingPerSide / plate + 1e-9);
    if (count <= 0) continue;
    perSide.push({ plate, count });
    remainingPerSide = Math.round((remainingPerSide - count * plate) * 1000) / 1000;
  }

  const achievedWeight = barWeight + 2 * perSide.reduce((sum, g) => sum + g.plate * g.count, 0);

  return {
    barWeight,
    perSide,
    achievedWeight: Math.round(achievedWeight * 1000) / 1000,
    remainder: Math.round((targetWeight - achievedWeight) * 1000) / 1000,
  };
}

/**
 * Inverse Epley: the weight you could move for `reps` clean reps given a known
 * one-rep max. Used by onboarding so a lifter who only knows their 1RM never
 * has to guess a 5RM.
 */
export function estimateRepMaxFromOneRM(oneRepMax: number, reps: number, step = 2.5): number {
  if (oneRepMax <= 0 || reps <= 0) return 0;
  return roundToNearest(oneRepMax / (1 + reps / 30), step);
}
