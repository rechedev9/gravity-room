import { describe, it, expect } from 'vitest';
import {
  computeGenericProgram,
  deriveResultFromPrescriptionLogs,
  plannedPrescriptionSets,
} from '@gzclp/domain/generic-engine';
import type { SetLogEntry } from '@gzclp/domain/types';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import { SHEIKO_7_1_DEFINITION } from './sheiko-7-1';

const CONFIG = { squat1rm: 200, bench1rm: 140, deadlift1rm: 220, rounding: 2.5 };

// Week 1, day 2 holds the blocks deadlift ladder: 55%x3, 65%x3, 75%x3, 85%x2 x2, 90%x1 x3.
function deadliftLadder() {
  const row = computeGenericProgram(
    ProgramDefinitionSchema.parse(SHEIKO_7_1_DEFINITION),
    CONFIG,
    {}
  )[1];
  const slot = row?.slots.find(
    (s) => s.exerciseId.includes('deadlift') && s.prescriptions !== undefined
  );
  if (slot?.prescriptions === undefined) throw new Error('Sheiko 7.1 day 2 has no deadlift ladder');
  return slot;
}

function logsAsPlanned(): SetLogEntry[] {
  return (deadliftLadder().prescriptions ?? []).flatMap((entry) =>
    Array.from({ length: entry.sets }, () => ({ reps: entry.reps, weight: entry.weight }))
  );
}

describe('Sheiko 7.1 deadlift ladder result', () => {
  it('plans eight confirmable sets while the engine keeps only the last group in slot.sets', () => {
    const slot = deadliftLadder();
    expect(plannedPrescriptionSets(slot.prescriptions ?? [])).toBe(8);
    expect(slot.sets).toBe(3);
    expect(slot.reps).toBe(1);
  });

  it('succeeds when every set meets its own planned reps, warm-up triples included', () => {
    const logs = logsAsPlanned();
    expect(logs.slice(0, 3).map((log) => log.reps)).toEqual([3, 3, 3]);
    expect(deriveResultFromPrescriptionLogs(logs, deadliftLadder().prescriptions ?? [])).toBe(
      'success'
    );
  });

  it('fails when a heavy single is missed', () => {
    const logs = logsAsPlanned().map((log, i) => (i === 7 ? { ...log, reps: 0 } : log));
    expect(deriveResultFromPrescriptionLogs(logs, deadliftLadder().prescriptions ?? [])).toBe(
      'fail'
    );
  });

  it('fails when a warm-up set is short of its own reps', () => {
    const logs = logsAsPlanned().map((log, i) => (i === 1 ? { ...log, reps: 2 } : log));
    expect(deriveResultFromPrescriptionLogs(logs, deadliftLadder().prescriptions ?? [])).toBe(
      'fail'
    );
  });

  it('has no result while the ladder is only partly logged', () => {
    const prescriptions = deadliftLadder().prescriptions ?? [];
    expect(
      deriveResultFromPrescriptionLogs(logsAsPlanned().slice(0, 3), prescriptions)
    ).toBeUndefined();
  });
});
