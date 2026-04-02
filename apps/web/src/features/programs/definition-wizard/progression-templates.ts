import type { z } from 'zod/v4';
import type {
  ProgressionRuleSchema,
  StageDefinitionSchema,
} from '@gzclp/shared/schemas/program-definition';

type ProgressionRule = z.infer<typeof ProgressionRuleSchema>;
type StageDefinition = z.infer<typeof StageDefinitionSchema>;

export interface ProgressionTemplate {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly onSuccess: ProgressionRule;
  readonly onMidStageFail: ProgressionRule;
  readonly onFinalStageFail: ProgressionRule;
  readonly defaultStages: readonly StageDefinition[];
}

export const PROGRESSION_TEMPLATES: readonly ProgressionTemplate[] = [
  {
    id: 'linear',
    label: 'Progresion Lineal',
    description: 'Sube peso cada sesion exitosa. Si fallas, baja de etapa.',
    onSuccess: { type: 'add_weight' },
    onMidStageFail: { type: 'advance_stage' },
    onFinalStageFail: { type: 'deload_percent', percent: 10 },
    defaultStages: [
      { sets: 5, reps: 3, amrap: true },
      { sets: 6, reps: 2 },
      { sets: 10, reps: 1 },
    ],
  },
  {
    id: 'double-progression',
    label: 'Doble Progresion',
    description: 'Aumenta reps dentro del rango antes de subir peso.',
    onSuccess: { type: 'double_progression', repRangeBottom: 8, repRangeTop: 12 },
    onMidStageFail: { type: 'no_change' },
    onFinalStageFail: { type: 'deload_percent', percent: 10 },
    defaultStages: [{ sets: 3, reps: 8, amrap: true }],
  },
  {
    id: 'linear-t2',
    label: 'Lineal (Secundario)',
    description: 'Progresion lineal para ejercicios T2 con mas volumen.',
    onSuccess: { type: 'add_weight' },
    onMidStageFail: { type: 'advance_stage' },
    onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
    defaultStages: [
      { sets: 3, reps: 10 },
      { sets: 3, reps: 8 },
      { sets: 3, reps: 6 },
    ],
  },
  {
    id: 'accessory',
    label: 'Accesorio',
    description: 'Doble progresion para ejercicios accesorios (T3).',
    onSuccess: { type: 'double_progression', repRangeBottom: 15, repRangeTop: 25 },
    onMidStageFail: { type: 'no_change' },
    onFinalStageFail: { type: 'no_change' },
    defaultStages: [{ sets: 3, reps: 15, amrap: true }],
  },
  {
    id: 'no-progression',
    label: 'Sin Progresion',
    description: 'Peso fijo, ideal para ejercicios de calentamiento o GPP.',
    onSuccess: { type: 'no_change' },
    onMidStageFail: { type: 'no_change' },
    onFinalStageFail: { type: 'no_change' },
    defaultStages: [{ sets: 3, reps: 10 }],
  },
];
