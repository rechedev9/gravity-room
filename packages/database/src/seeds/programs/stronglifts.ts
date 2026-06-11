import type { SlotDef } from './shared';
import { ADV } from './shared';

function sl5x5Slot(
  id: string,
  exerciseId: string,
  sets: number,
  reps: number,
  inc: number
): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'main',
    stages: [
      { sets, reps },
      { sets, reps },
      { sets, reps },
    ],
    onSuccess: {
      type: 'add_weight_reset_stage',
      amount: inc,
    },
    onMidStageFail: ADV,
    onFinalStageFail: { type: 'deload_percent', percent: 10 },
    startWeightKey: exerciseId,
  };
}

export const STRONGLIFTS_DEFINITION_JSONB = {
  cycleLength: 2,
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  exercises: {
    squat: {},
    bench: {},
    ohp: {},
    deadlift: {},
    bent_over_row: {},
  },
  configFields: [
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'ohp', label: 'Press Militar', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift', label: 'Peso Muerto', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bent_over_row', label: 'Remo con Barra', type: 'weight', min: 2.5, step: 2.5 },
  ],
  weightIncrements: {
    squat: 2.5,
    bench: 2.5,
    ohp: 2.5,
    deadlift: 5,
    bent_over_row: 2.5,
  },
  days: [
    {
      name: 'Workout A',
      slots: [
        sl5x5Slot('squat', 'squat', 5, 5, 2.5),
        sl5x5Slot('bench', 'bench', 5, 5, 2.5),
        sl5x5Slot('bent_over_row', 'bent_over_row', 5, 5, 2.5),
      ],
    },
    {
      name: 'Workout B',
      slots: [
        sl5x5Slot('squat', 'squat', 5, 5, 2.5),
        sl5x5Slot('ohp', 'ohp', 5, 5, 2.5),
        sl5x5Slot('deadlift', 'deadlift', 1, 5, 5),
      ],
    },
  ],
};
