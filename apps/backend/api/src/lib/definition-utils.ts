import { isRecord } from '@gzclp/domain/type-guards';

/**
 * Collects all unique exercise IDs referenced in a definition JSONB —
 * from both the `exercises` map keys and `days[].slots[].exerciseId` fields.
 */
export function collectExerciseIds(definition: unknown): Set<string> {
  const ids = new Set<string>();

  if (!isRecord(definition)) return ids;

  const defExercises = definition['exercises'];
  if (isRecord(defExercises)) {
    for (const key of Object.keys(defExercises)) {
      ids.add(key);
    }
  }

  const days = definition['days'];
  if (!Array.isArray(days)) return ids;

  for (const day of days) {
    if (!isRecord(day)) continue;
    const slots = day['slots'];
    if (!Array.isArray(slots)) continue;
    for (const slot of slots) {
      if (!isRecord(slot)) continue;
      const exerciseId = slot['exerciseId'];
      if (typeof exerciseId === 'string') {
        ids.add(exerciseId);
      }
    }
  }

  return ids;
}
