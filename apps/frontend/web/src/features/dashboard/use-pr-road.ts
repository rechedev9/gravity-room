import { useMemo } from 'react';

export interface LiftHistoryRow {
  readonly lift: string;
  readonly weight: number;
  readonly isPr: boolean;
  readonly prTarget: number;
}

export interface PrRoad {
  readonly lift: string;
  readonly current: number;
  readonly target: number;
  readonly deltaToPr: number;
  readonly pctTowardPr: number;
}

export function computePrRoad(history: readonly LiftHistoryRow[]): PrRoad | null {
  let best: PrRoad | null = null;
  for (const row of history) {
    if (row.isPr) continue;
    const delta = row.prTarget - row.weight;
    if (delta <= 0) continue;
    const pct = (row.weight / row.prTarget) * 100;
    if (!best || delta < best.deltaToPr) {
      best = {
        lift: row.lift,
        current: row.weight,
        target: row.prTarget,
        deltaToPr: delta,
        pctTowardPr: pct,
      };
    }
  }
  return best;
}

export function usePrRoad(history: readonly LiftHistoryRow[]): PrRoad | null {
  return useMemo(() => computePrRoad(history), [history]);
}
