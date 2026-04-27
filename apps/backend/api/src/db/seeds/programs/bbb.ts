import type { SlotDef } from './shared';
import { tmSlot, tmTopSlot, TM_CONFIG_STRINGS, TM_CONFIG_FIELDS } from './shared';

interface BbbWeekDaysOptions {
  readonly label: string;
  readonly pcts: readonly [number, number, number];
  readonly reps: readonly [number, number, number];
  readonly amrap: boolean;
  readonly bbb: boolean;
  readonly tmUpdate: boolean;
}

function bbbWeekDays(opts: BbbWeekDaysOptions): { name: string; slots: SlotDef[] }[] {
  const { label, pcts, reps, amrap, bbb, tmUpdate } = opts;
  const lifts = [
    { ex: 'squat', tm: 'squat_tm', name: 'Sentadilla', inc: 5 },
    { ex: 'bench', tm: 'bench_tm', name: 'Press Banca', inc: 2.5 },
    { ex: 'deadlift', tm: 'deadlift_tm', name: 'Peso Muerto', inc: 5 },
    { ex: 'ohp', tm: 'ohp_tm', name: 'Press Militar', inc: 2.5 },
  ];
  return lifts.map((l) => ({
    name: `${label} — ${l.name}`,
    slots: [
      tmSlot(l.ex, l.tm, `${l.ex}_s1`, pcts[0], reps[0]),
      tmSlot(l.ex, l.tm, `${l.ex}_s2`, pcts[1], reps[1]),
      tmTopSlot(l.ex, l.tm, pcts[2], reps[2], amrap, tmUpdate ? l.inc : undefined),
      ...(bbb ? [tmSlot(l.ex, l.tm, `${l.ex}_bbb`, 0.5, 10, 5, 'supplemental')] : []),
    ],
  }));
}

const BBB_DAYS = [
  ...bbbWeekDays({
    label: 'Sem. 1 (5s)',
    pcts: [0.65, 0.75, 0.85],
    reps: [5, 5, 5],
    amrap: true,
    bbb: true,
    tmUpdate: false,
  }),
  ...bbbWeekDays({
    label: 'Sem. 2 (3s)',
    pcts: [0.7, 0.8, 0.9],
    reps: [3, 3, 3],
    amrap: true,
    bbb: true,
    tmUpdate: false,
  }),
  ...bbbWeekDays({
    label: 'Sem. 3 (5/3/1)',
    pcts: [0.75, 0.85, 0.95],
    reps: [5, 3, 1],
    amrap: true,
    bbb: true,
    tmUpdate: true,
  }),
  ...bbbWeekDays({
    label: 'Descarga',
    pcts: [0.4, 0.5, 0.6],
    reps: [5, 5, 5],
    amrap: false,
    bbb: false,
    tmUpdate: false,
  }),
];

export const BBB_DEFINITION_JSONB = {
  ...TM_CONFIG_STRINGS,
  cycleLength: 16,
  totalWorkouts: 80,
  workoutsPerWeek: 4,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    ohp: {},
  },
  configFields: [...TM_CONFIG_FIELDS],
  weightIncrements: {},
  days: BBB_DAYS,
};
