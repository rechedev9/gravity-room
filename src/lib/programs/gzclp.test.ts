import { describe, it, expect } from 'bun:test';
import { GZCLP_DEFINITION } from './gzclp';
import { ProgramDefinitionSchema } from '../schemas/program-definition';

// ---------------------------------------------------------------------------
// GZCLP_DEFINITION validated through real ProgramDefinitionSchema
// This is a contract test: if the definition structure changes, the schema
// catches it. If the schema changes, the definition must adapt.
// ---------------------------------------------------------------------------
describe('GZCLP_DEFINITION', () => {
  it('should pass ProgramDefinitionSchema validation', () => {
    const result = ProgramDefinitionSchema.safeParse(GZCLP_DEFINITION);
    expect(result.success).toBe(true);
  });

  it('should have exactly 4 days in the rotation', () => {
    expect(GZCLP_DEFINITION.days).toHaveLength(4);
    expect(GZCLP_DEFINITION.cycleLength).toBe(4);
  });

  it('should have 3 slots per day (T1, T2, T3)', () => {
    for (const day of GZCLP_DEFINITION.days) {
      expect(day.slots).toHaveLength(3);
      const tiers = day.slots.map((s) => s.tier).sort();
      expect(tiers).toEqual(['t1', 't2', 't3']);
    }
  });

  it('should define 6 exercises', () => {
    expect(Object.keys(GZCLP_DEFINITION.exercises).sort()).toEqual([
      'bench',
      'dbrow',
      'deadlift',
      'latpulldown',
      'ohp',
      'squat',
    ]);
  });

  it('should have weight increments for all exercises', () => {
    for (const exerciseId of Object.keys(GZCLP_DEFINITION.exercises)) {
      expect(GZCLP_DEFINITION.weightIncrements[exerciseId]).toBeDefined();
      expect(GZCLP_DEFINITION.weightIncrements[exerciseId]).toBeGreaterThan(0);
    }
  });

  it('should have 3 stages for T1 slots', () => {
    for (const day of GZCLP_DEFINITION.days) {
      const t1 = day.slots.find((s) => s.tier === 't1');
      expect(t1?.stages).toHaveLength(3);
    }
  });

  it('should have 3 stages for T2 slots', () => {
    for (const day of GZCLP_DEFINITION.days) {
      const t2 = day.slots.find((s) => s.tier === 't2');
      expect(t2?.stages).toHaveLength(3);
    }
  });

  it('should have 1 stage for T3 slots (AMRAP)', () => {
    for (const day of GZCLP_DEFINITION.days) {
      const t3 = day.slots.find((s) => s.tier === 't3');
      expect(t3?.stages).toHaveLength(1);
      expect(t3?.stages[0].amrap).toBe(true);
    }
  });

  it('should have T2 slots with 0.65 start weight multiplier', () => {
    for (const day of GZCLP_DEFINITION.days) {
      const t2 = day.slots.find((s) => s.tier === 't2');
      expect(t2?.startWeightMultiplier).toBe(0.65);
    }
  });
});
