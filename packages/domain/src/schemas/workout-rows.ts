import { z } from 'zod/v4';
import { SetLogEntrySchema } from './instance';
import type { SetLogEntry } from '../types';

function nu<T>(schema: z.ZodType<T>) {
  return schema
    .nullable()
    .catch(null)
    .transform((v): T | undefined => (v !== null ? v : undefined));
}

const SlotRowSchema = z.object({
  slotId: z.string().catch(''),
  exerciseId: z.string().catch(''),
  exerciseName: z.string().catch(''),
  tier: z.string().min(1).catch(''),
  weight: z.number().catch(0),
  stage: z.number().int().catch(0),
  sets: z.number().int().catch(0),
  reps: z.number().int().catch(0),
  repsMax: nu<number>(z.number().int()),
  isAmrap: z.boolean().catch(false),
  stagesCount: z.number().int().catch(1),
  result: nu<'success' | 'fail'>(z.enum(['success', 'fail'])),
  amrapReps: nu<number>(z.number().int()),
  rpe: nu<number>(z.number()),
  isChanged: z.boolean().catch(false),
  isDeload: z.boolean().catch(false),
  role: nu<'primary' | 'secondary' | 'accessory'>(z.enum(['primary', 'secondary', 'accessory'])),
  notes: nu<string>(z.string()),
  prescriptions: z.any().transform((): undefined => undefined),
  isGpp: nu<boolean>(z.boolean()),
  complexReps: nu<string>(z.string()),
  propagatesTo: nu<string>(z.string()),
  isTestSlot: nu<boolean>(z.boolean()),
  isBodyweight: nu<boolean>(z.boolean()),
  setLogs: nu<SetLogEntry[]>(z.array(SetLogEntrySchema)),
});

export const GenericWorkoutRowSchema = z.object({
  index: z.number().int().catch(0),
  dayName: z.string().catch(''),
  slots: z.array(SlotRowSchema).catch([]),
  isChanged: z.boolean().catch(false),
  completedAt: nu<string>(z.string()),
});
