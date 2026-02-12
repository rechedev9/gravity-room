import { DAYS, T1_STAGES, T2_STAGES, TOTAL_WORKOUTS, inc } from './program';
import type { StartWeights, Results, WorkoutRow } from '@/types';

function roundToNearestHalf(value: number): number {
  const rounded = Math.round(value * 2) / 2;
  if (!Number.isFinite(rounded) || rounded < 0) return 0;
  return rounded;
}

export function computeProgram(startWeights: StartWeights, results: Results): WorkoutRow[] {
  const t1: Record<string, { w: number; s: number }> = {
    squat: { w: startWeights.squat, s: 0 },
    bench: { w: startWeights.bench, s: 0 },
    deadlift: { w: startWeights.deadlift, s: 0 },
    ohp: { w: startWeights.ohp, s: 0 },
  };

  const t2: Record<string, { w: number; s: number }> = {
    squat: { w: roundToNearestHalf(startWeights.squat * 0.65), s: 0 },
    bench: { w: roundToNearestHalf(startWeights.bench * 0.65), s: 0 },
    deadlift: { w: roundToNearestHalf(startWeights.deadlift * 0.65), s: 0 },
    ohp: { w: roundToNearestHalf(startWeights.ohp * 0.65), s: 0 },
  };

  const t3: Record<string, number> = {
    latpulldown: startWeights.latpulldown,
    dbrow: startWeights.dbrow,
  };

  const changed: Record<string, boolean> = {
    squat: false,
    bench: false,
    deadlift: false,
    ohp: false,
  };
  const t2changed: Record<string, boolean> = {
    squat: false,
    bench: false,
    deadlift: false,
    ohp: false,
  };

  const rows: WorkoutRow[] = [];

  for (let i = 0; i < TOTAL_WORKOUTS; i++) {
    const day = DAYS[i % 4];
    const t1ex = day.t1;
    const t2ex = day.t2;
    const t3ex = day.t3;
    const t1s = T1_STAGES[t1[t1ex].s];
    const t2s = T2_STAGES[t2[t2ex].s];
    const res = results[i] ?? {};

    rows.push({
      index: i,
      dayName: day.name,
      t1Exercise: t1ex,
      t1Weight: t1[t1ex].w,
      t1Stage: t1[t1ex].s,
      t1Sets: t1s.sets,
      t1Reps: t1s.reps,
      t2Exercise: t2ex,
      t2Weight: t2[t2ex].w,
      t2Stage: t2[t2ex].s,
      t2Sets: t2s.sets,
      t2Reps: t2s.reps,
      t3Exercise: t3ex,
      t3Weight: t3[t3ex],
      isChanged: changed[t1ex] || t2changed[t2ex],
      result: {
        t1: res.t1,
        t2: res.t2,
        t3: res.t3,
        t1Reps: res.t1Reps,
        t3Reps: res.t3Reps,
      },
    });

    // T1 progression
    if (res.t1 === 'fail') {
      changed[t1ex] = true;
      if (t1[t1ex].s >= 2) {
        t1[t1ex].w = roundToNearestHalf(t1[t1ex].w * 0.9);
        t1[t1ex].s = 0;
      } else {
        t1[t1ex].s += 1;
      }
    } else {
      t1[t1ex].w += inc(t1ex);
    }

    // T2 progression
    if (res.t2 === 'fail') {
      t2changed[t2ex] = true;
      if (t2[t2ex].s >= 2) {
        t2[t2ex].w += 15;
        t2[t2ex].s = 0;
      } else {
        t2[t2ex].s += 1;
      }
    } else {
      t2[t2ex].w += inc(t2ex);
    }

    // T3 progression
    if (res.t3 === 'success') {
      t3[t3ex] += 2.5;
    }
  }

  return rows;
}
