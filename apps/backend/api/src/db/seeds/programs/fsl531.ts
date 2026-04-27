import type { SlotDef } from './shared';
import { tmSlot, tmTopSlot, TM_CONFIG_STRINGS, TM_CONFIG_FIELDS } from './shared';

interface FslWeekDaysOptions {
  readonly label: string;
  readonly pcts: readonly [number, number, number];
  readonly reps: readonly [number, number, number];
  readonly tmUpdate: boolean;
}

function fsl531WeekDays(opts: FslWeekDaysOptions): { name: string; slots: SlotDef[] }[] {
  const { label, pcts, reps, tmUpdate } = opts;
  const dayConfigs = [
    {
      name: 'Sentadilla + Press Banca',
      lifts: [
        { ex: 'squat', tm: 'squat_tm', inc: 5 },
        { ex: 'bench', tm: 'bench_tm', inc: 2.5 },
      ],
      isFirst: true,
    },
    {
      name: 'Peso Muerto + Press Militar',
      lifts: [
        { ex: 'deadlift', tm: 'deadlift_tm', inc: 5 },
        { ex: 'ohp', tm: 'ohp_tm', inc: 2.5 },
      ],
      isFirst: true,
    },
    {
      name: 'Press Banca + Sentadilla',
      lifts: [
        { ex: 'bench', tm: 'bench_tm', inc: 2.5 },
        { ex: 'squat', tm: 'squat_tm', inc: 5 },
      ],
      isFirst: false,
    },
  ];
  return dayConfigs.map((d) => ({
    name: `${label} — ${d.name}`,
    slots: d.lifts.flatMap((l) => [
      tmSlot(l.ex, l.tm, `${l.ex}_s1`, pcts[0], reps[0]),
      tmSlot(l.ex, l.tm, `${l.ex}_s2`, pcts[1], reps[1]),
      tmTopSlot(l.ex, l.tm, pcts[2], reps[2], true, tmUpdate && d.isFirst ? l.inc : undefined),
      tmSlot(l.ex, l.tm, `${l.ex}_fsl`, pcts[0], 5, 5, 'supplemental'),
    ]),
  }));
}

const FSL531_DAYS = [
  ...fsl531WeekDays({
    label: 'Sem. 1 (5s)',
    pcts: [0.65, 0.75, 0.85],
    reps: [5, 5, 5],
    tmUpdate: false,
  }),
  ...fsl531WeekDays({
    label: 'Sem. 2 (3s)',
    pcts: [0.7, 0.8, 0.9],
    reps: [3, 3, 3],
    tmUpdate: false,
  }),
  ...fsl531WeekDays({
    label: 'Sem. 3 (5/3/1)',
    pcts: [0.75, 0.85, 0.95],
    reps: [5, 3, 1],
    tmUpdate: true,
  }),
];

export const FSL531_DEFINITION_JSONB = {
  ...TM_CONFIG_STRINGS,
  cycleLength: 9,
  totalWorkouts: 72,
  workoutsPerWeek: 3,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    ohp: {},
  },
  configFields: [...TM_CONFIG_FIELDS],
  weightIncrements: {},
  days: FSL531_DAYS,
};
