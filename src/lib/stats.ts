import { DAYS, TOTAL_WORKOUTS, inc } from './program';
import type { StartWeights, Results, ChartDataPoint, ExerciseStats } from '@/types';

const T1_EXERCISES = ['squat', 'bench', 'deadlift', 'ohp'] as const;

export function extractChartData(
  startWeights: StartWeights,
  results: Results
): Record<string, ChartDataPoint[]> {
  const data: Record<string, ChartDataPoint[]> = {};
  for (const ex of T1_EXERCISES) {
    data[ex] = [];
  }

  const t1: Record<string, { w: number; s: number }> = {
    squat: { w: startWeights.squat, s: 0 },
    bench: { w: startWeights.bench, s: 0 },
    deadlift: { w: startWeights.deadlift, s: 0 },
    ohp: { w: startWeights.ohp, s: 0 },
  };

  for (let i = 0; i < TOTAL_WORKOUTS; i++) {
    const day = DAYS[i % 4];
    const t1ex = day.t1;
    const res = results[i] ?? {};

    data[t1ex].push({
      workout: i + 1,
      weight: t1[t1ex].w,
      stage: t1[t1ex].s + 1,
      result: res.t1 ?? null,
    });

    if (res.t1 === 'fail') {
      if (t1[t1ex].s >= 2) {
        t1[t1ex].w = Math.round(t1[t1ex].w * 0.9 * 2) / 2;
        t1[t1ex].s = 0;
      } else {
        t1[t1ex].s += 1;
      }
    } else {
      t1[t1ex].w += inc(t1ex);
    }
  }

  return data;
}

export function calculateStats(data: ChartDataPoint[]): ExerciseStats {
  const marked = data.filter((d) => d.result !== null);
  const successes = marked.filter((d) => d.result === 'success');
  const fails = marked.filter((d) => d.result === 'fail');
  const last = data.length > 0 ? data[data.length - 1] : null;
  const first = data.length > 0 ? data[0] : null;

  return {
    total: marked.length,
    successes: successes.length,
    fails: fails.length,
    rate: marked.length > 0 ? Math.round((successes.length / marked.length) * 100) : 0,
    currentWeight: last ? last.weight : 0,
    startWeight: first ? first.weight : 0,
    gained: last && first ? +(last.weight - first.weight).toFixed(1) : 0,
    currentStage: last ? last.stage : 1,
  };
}

export { T1_EXERCISES };
