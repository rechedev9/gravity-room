// Shared slot helpers + keys for Brunetti program seeds.
import type { SlotDef } from './shared';
import { flatNcSlot, NC } from './shared';
import { BRUNETTI_TM, BRUNETTI_JAW_TM } from './shared';

export const TM = BRUNETTI_TM;
export const JAW_TM = BRUNETTI_JAW_TM;

export const FZ_KEYS = {
  SQUAT: 'fz_squat_start',
  BENCH: 'fz_bench_start',
  DEADLIFT: 'fz_deadlift_start',
} as const;

export const ACC = {
  INCLINE: 'acc_incline_db_press',
  SEAL: 'acc_seal_row',
  ROW: 'acc_one_arm_row',
  GENERAL: 'acc_general',
} as const;

export function bwSlot(
  id: string,
  exerciseId: string,
  sets: number,
  reps: number,
  notes: string
): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'accessory',
    role: 'accessory',
    isBodyweight: true,
    stages: [{ sets, reps }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: '__gpp',
    notes,
  };
}

export function freeNoteSlot(
  id: string,
  exerciseId: string,
  startKey: string,
  sets: number,
  reps: number,
  notes: string,
  tier: string = 'main'
): SlotDef {
  return {
    ...flatNcSlot(id, exerciseId, startKey, sets, reps, tier, notes),
    role: tier === 'main' ? 'primary' : 'secondary',
  };
}
