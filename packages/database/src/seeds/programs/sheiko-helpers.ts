// Shared helpers for generating Sheiko program definitions (7.1–7.5).
// Follows the same factory pattern as mutenroshi-helpers.ts.

import type { SlotDef, SetPrescription } from './shared';
import { prescriptionSlot, gppSlot as sharedGppSlot } from './shared';

// ── Slot counter (deterministic IDs across all days) ──

let slotCounter = 0;

function nextSlotId(prefix: string): string {
  slotCounter += 1;
  return `${prefix}_${slotCounter}`;
}

/** Reset the slot counter. Call before building all days for a program. */
export function resetSlotCounter(): void {
  slotCounter = 0;
}

// ── Exercise ID constants ──

export const SQ = {
  competition: 'squat',
  paused2s: 'paused-squat-2s',
  pauseHalfDown: 'squat-pause-halfway-down',
  pauseHalfUp: 'squat-pause-halfway-up',
  chains: 'squat-chains',
} as const;

export const BP = {
  competition: 'bench',
  paused2s: 'paused-bench-2s',
  paused3s: 'paused-bench-3s',
  bands: 'bench-bands',
  chains: 'bench-chains',
  slingshot: 'bench-slingshot',
  board: 'board-press',
  decline: 'decline-bench',
  speed: 'speed-bench',
  dumbbell: 'dumbbell-bench',
  inclineShoulder: 'incline-shoulder-press',
  closeGrip: 'bench-close-grip',
  middleGrip: 'bench-middle-grip',
} as const;

export const DL = {
  competition: 'deadlift',
  bands: 'deadlift-bands',
  chains: 'deadlift-chains',
  blocks: 'deadlift-blocks',
  blocksChains: 'deadlift-blocks-chains',
  deficit: 'deficit-deadlift',
  pauseKnees: 'deadlift-pause-knees',
  kneesFull: 'deadlift-knees-full',
  plusBelowKnees: 'deadlift-plus-below-knees',
  aboveKneesBlocks: 'deadlift-above-knees-blocks',
  pauseBelowAbove: 'deadlift-pause-below-above',
  snatchGrip: 'deadlift-snatch-grip',
} as const;

export const GPP = {
  pecs: 'pecs',
  frontDelts: 'front-delts',
  medialDelts: 'medial-delts',
  rearDelts: 'rear-delts',
  tricepsPushdowns: 'triceps-pushdowns',
  tricepsStanding: 'triceps-standing',
  lats: 'lats',
  abs: 'abs',
  hyperextensions: 'hyperextensions',
  reverseHyperextensions: 'reverse-hyperextensions',
  legCurls: 'leg-curls',
  legExtensions: 'leg-extensions',
  legPress: 'leg-press',
  goodmorning: 'goodmorning',
  goodmorningSeat: 'goodmorning-seated',
  dips: 'dips',
  seatedRowing: 'seated-rowing',
  biceps: 'biceps',
  frenchPress: 'french-press',
  frontSquat: 'front-squat',
  squatGpp: 'squat',
} as const;

// ── Slot factory functions ──

/** Competition lift slot with prescription ladder. */
export function compSlot(
  exerciseId: string,
  percentOf: string,
  prescriptions: readonly SetPrescription[],
  complexReps?: string
): SlotDef {
  const id = nextSlotId('comp');
  return prescriptionSlot(id, exerciseId, percentOf, prescriptions, complexReps);
}

/** GPP/accessory slot (no weight, pass/fail tracking). */
export function gpp(exerciseId: string, reps: number, sets: number): SlotDef {
  const id = nextSlotId('gpp');
  return sharedGppSlot(id, exerciseId, reps, sets);
}

// ── Prescription shorthand helpers ──

/** Create a prescription entry: { percent, reps, sets }. */
export function p(percent: number, reps: number, sets: number): SetPrescription {
  return { percent, reps, sets };
}

// ── Day builder types ──

export interface SheikoDayDef {
  readonly name: string;
  readonly slots: readonly SlotDef[];
}

export interface SheikoWeekPlan {
  readonly days: readonly (readonly SlotDef[])[];
}

/**
 * Build ProgramDay[] from weekly plans.
 * Each week has 4 days. Day names follow "Semana N — Dia D" format.
 */
export function buildSheikoDays(weeklyPlans: readonly SheikoWeekPlan[]): readonly SheikoDayDef[] {
  const days: SheikoDayDef[] = [];
  for (let w = 0; w < weeklyPlans.length; w++) {
    const week = weeklyPlans[w];
    for (let d = 0; d < week.days.length; d++) {
      const slots = week.days[d];
      days.push({
        name: `Semana ${w + 1} — Dia ${d + 1}`,
        slots,
      });
    }
  }
  return days;
}

// ── Sheiko exercise map builder ──

/** Build the exercises record for a ProgramDefinition from the exercise IDs used in the days. */
export function buildExerciseMap(
  days: readonly SheikoDayDef[]
): Record<string, { readonly name: string }> {
  const ids = new Set<string>();
  for (const day of days) {
    for (const slot of day.slots) {
      ids.add(slot.exerciseId);
    }
  }

  const exerciseNames: Record<string, string> = {
    // Squat variations
    [SQ.competition]: 'Sentadilla',
    [SQ.paused2s]: 'Sentadilla pausa 2s',
    [SQ.pauseHalfDown]: 'Sentadilla pausa media bajada',
    [SQ.pauseHalfUp]: 'Sentadilla pausa media subida',
    [SQ.chains]: 'Sentadilla con cadenas',
    // Bench variations
    [BP.competition]: 'Press Banca',
    [BP.paused2s]: 'Press Banca pausa 2s',
    [BP.paused3s]: 'Press Banca pausa 3s',
    [BP.bands]: 'Press Banca con bandas',
    [BP.chains]: 'Press Banca con cadenas',
    [BP.slingshot]: 'Press Banca con slingshot',
    [BP.board]: 'Press en tabla',
    [BP.decline]: 'Press Banca declinado',
    [BP.speed]: 'Press Banca velocidad',
    [BP.dumbbell]: 'Press Banca mancuernas',
    [BP.inclineShoulder]: 'Press hombro inclinado',
    [BP.closeGrip]: 'Press Banca agarre cerrado',
    [BP.middleGrip]: 'Press Banca agarre medio',
    // Deadlift variations
    [DL.competition]: 'Peso Muerto',
    [DL.bands]: 'Peso Muerto con bandas',
    [DL.chains]: 'Peso Muerto con cadenas',
    [DL.blocks]: 'Peso Muerto desde bloques',
    [DL.blocksChains]: 'Peso Muerto bloques + cadenas',
    [DL.deficit]: 'Peso Muerto deficit',
    [DL.pauseKnees]: 'Peso Muerto pausa rodillas',
    [DL.kneesFull]: 'Peso Muerto rodillas + completo',
    [DL.plusBelowKnees]: 'Peso Muerto + desde debajo rodillas',
    [DL.aboveKneesBlocks]: 'Peso Muerto encima rodillas bloques',
    [DL.pauseBelowAbove]: 'Peso Muerto pausa debajo y encima',
    [DL.snatchGrip]: 'Peso Muerto agarre arrancada',
    // GPP / Accessories
    [GPP.pecs]: 'Pectorales',
    [GPP.frontDelts]: 'Deltoides frontales',
    [GPP.medialDelts]: 'Deltoides laterales',
    [GPP.rearDelts]: 'Deltoides posteriores',
    [GPP.tricepsPushdowns]: 'Extension triceps polea',
    [GPP.tricepsStanding]: 'Triceps de pie',
    [GPP.lats]: 'Dorsales',
    [GPP.abs]: 'Abdominales',
    [GPP.hyperextensions]: 'Hiperextensiones',
    [GPP.reverseHyperextensions]: 'Hiperextensiones inversas',
    [GPP.legCurls]: 'Curl femoral',
    [GPP.legExtensions]: 'Extension cuadriceps',
    [GPP.legPress]: 'Prensa de piernas',
    [GPP.goodmorning]: 'Buenos dias',
    [GPP.goodmorningSeat]: 'Buenos dias sentado',
    [GPP.dips]: 'Fondos en paralelas',
    [GPP.seatedRowing]: 'Remo sentado',
    [GPP.biceps]: 'Biceps',
    [GPP.frenchPress]: 'Press Frances',
    [GPP.frontSquat]: 'Sentadilla frontal',
    // GPP.squatGpp ('squat') shares the same exercise ID as SQ.competition — already mapped above
  };

  const result: Record<string, { readonly name: string }> = {};
  for (const id of ids) {
    result[id] = { name: exerciseNames[id] ?? id };
  }
  return result;
}
