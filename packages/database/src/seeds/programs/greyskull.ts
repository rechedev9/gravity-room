import type { SlotDef } from './shared';
import { NC } from './shared';

function gslpSlot(id: string, exerciseId: string, sets: number): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'main',
    stages: [{ sets, reps: 5, amrap: true }],
    onSuccess: { type: 'add_weight' },
    onMidStageFail: NC,
    onFinalStageFail: { type: 'deload_percent', percent: 10 },
    startWeightKey: exerciseId,
  };
}

export const GSLP_DEFINITION_JSONB = {
  cycleLength: 2,
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  exercises: {
    ohp: {},
    pullup: {},
    squat: {},
    bench: {},
    bent_over_row: {},
    deadlift: {},
  },
  configFields: [
    { key: 'ohp', label: 'Press Militar', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'pullup', label: 'Dominadas (peso añadido)', type: 'weight', min: 0, step: 2.5 },
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bent_over_row', label: 'Remo con Barra', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift', label: 'Peso Muerto', type: 'weight', min: 2.5, step: 2.5 },
  ],
  weightIncrements: {
    ohp: 2.5,
    pullup: 2.5,
    squat: 2.5,
    bench: 2.5,
    bent_over_row: 2.5,
    deadlift: 5,
  },
  days: [
    {
      name: 'Workout A',
      slots: [
        gslpSlot('ohp', 'ohp', 3),
        gslpSlot('pullup', 'pullup', 3),
        gslpSlot('squat', 'squat', 3),
      ],
    },
    {
      name: 'Workout B',
      slots: [
        gslpSlot('bench', 'bench', 3),
        gslpSlot('bent_over_row', 'bent_over_row', 3),
        gslpSlot('deadlift', 'deadlift', 1),
      ],
    },
  ],
};
