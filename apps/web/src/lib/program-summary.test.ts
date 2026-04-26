import { describe, it, expect } from 'bun:test';
import { buildProgramSummary } from './program-summary';
import type { ProgramDefinition } from '@gzclp/domain/types/program';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal GZCLP-style definition with 2 days, 3 exercises, 3 tiers, multiple stages. */
function createGzclpDefinition(): ProgramDefinition {
  return {
    id: 'gzclp',
    name: 'GZCLP',
    description: 'Linear progression program.',
    author: 'Cody Lefever',
    version: 1,
    category: 'strength',
    source: 'preset',
    cycleLength: 2,
    totalWorkouts: 90,
    workoutsPerWeek: 3,
    exercises: {
      squat: { name: 'Sentadilla' },
      bench: { name: 'Press Banca' },
      row: { name: 'Remo' },
    },
    configFields: [
      { key: 'squat', label: 'Sentadilla', type: 'weight' as const, min: 20, step: 2.5 },
      { key: 'bench', label: 'Press Banca', type: 'weight' as const, min: 20, step: 2.5 },
      { key: 'row', label: 'Remo', type: 'weight' as const, min: 20, step: 2.5 },
      {
        key: 'variant',
        label: 'Variante',
        type: 'select' as const,
        options: [{ label: 'A', value: 'a' }],
      },
    ],
    weightIncrements: { squat: 5, bench: 2.5, row: 2.5 },
    days: [
      {
        name: 'Day A',
        slots: [
          {
            id: 'da-t1',
            exerciseId: 'squat',
            tier: 'T1',
            stages: [
              { sets: 5, reps: 3, amrap: true },
              { sets: 6, reps: 2, amrap: true },
              { sets: 10, reps: 1, amrap: true },
            ],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'advance_stage' },
            onFinalStageFail: { type: 'deload_percent', percent: 10 },
            startWeightKey: 'squat',
          },
          {
            id: 'da-t2',
            exerciseId: 'bench',
            tier: 'T2',
            stages: [
              { sets: 3, reps: 10 },
              { sets: 3, reps: 8 },
              { sets: 3, reps: 6 },
            ],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'advance_stage' },
            onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
            startWeightKey: 'bench',
          },
          {
            id: 'da-t3',
            exerciseId: 'row',
            tier: 'T3',
            stages: [{ sets: 3, reps: 15, amrap: true }],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'no_change' },
            onFinalStageFail: { type: 'no_change' },
            startWeightKey: 'row',
          },
        ],
      },
      {
        name: 'Day B',
        slots: [
          {
            id: 'db-t1',
            exerciseId: 'bench',
            tier: 'T1',
            stages: [
              { sets: 5, reps: 3, amrap: true },
              { sets: 6, reps: 2, amrap: true },
              { sets: 10, reps: 1, amrap: true },
            ],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'advance_stage' },
            onFinalStageFail: { type: 'deload_percent', percent: 10 },
            startWeightKey: 'bench',
          },
          {
            id: 'db-t2',
            exerciseId: 'squat',
            tier: 'T2',
            stages: [
              { sets: 3, reps: 10 },
              { sets: 3, reps: 8 },
              { sets: 3, reps: 6 },
            ],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'advance_stage' },
            onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
            startWeightKey: 'squat',
          },
          {
            id: 'db-t3',
            exerciseId: 'row',
            tier: 'T3',
            stages: [{ sets: 3, reps: 15, amrap: true }],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'no_change' },
            onFinalStageFail: { type: 'no_change' },
            startWeightKey: 'row',
          },
        ],
      },
    ],
  };
}

/** Definition with double_progression and update_tm rules. */
function createProgressionDefinition(): ProgramDefinition {
  return {
    id: 'prog-test',
    name: 'Progression Test',
    description: 'Test program.',
    author: 'Test',
    version: 1,
    category: 'hypertrophy',
    source: 'preset',
    cycleLength: 1,
    totalWorkouts: 48,
    workoutsPerWeek: 4,
    exercises: {
      curl: { name: 'Curl Bíceps' },
      squat: { name: 'Sentadilla' },
    },
    configFields: [],
    weightIncrements: { curl: 1, squat: 2.5 },
    days: [
      {
        name: 'Day 1',
        slots: [
          {
            id: 's1',
            exerciseId: 'curl',
            tier: 'T3',
            stages: [{ sets: 3, reps: 10 }],
            onSuccess: { type: 'double_progression', repRangeBottom: 8, repRangeTop: 12 },
            onMidStageFail: { type: 'no_change' },
            onFinalStageFail: { type: 'no_change' },
            startWeightKey: 'curl',
          },
          {
            id: 's2',
            exerciseId: 'squat',
            tier: 'T1',
            stages: [
              { sets: 5, reps: 3, amrap: true },
              { sets: 6, reps: 2, amrap: true },
            ],
            onSuccess: { type: 'update_tm', amount: 2.5, minAmrapReps: 5 },
            onMidStageFail: { type: 'advance_stage' },
            onFinalStageFail: { type: 'deload_percent', percent: 10 },
            startWeightKey: 'squat',
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildProgramSummary', () => {
  describe('unique exercises (REQ-SUMMARY-001, REQ-SUMMARY-002)', () => {
    it('should extract correct unique exercises from GZCLP-style definition', () => {
      const def = createGzclpDefinition();

      const summary = buildProgramSummary(def);

      expect(summary.uniqueExerciseCount).toBe(3);
      const names = summary.uniqueExercises.map((e) => e.name);
      expect(names).toContain('Sentadilla');
      expect(names).toContain('Press Banca');
      expect(names).toContain('Remo');
    });

    it('should deduplicate exercises by exerciseId across days', () => {
      const def = createGzclpDefinition();

      const summary = buildProgramSummary(def);

      // squat appears in both Day A (T1) and Day B (T2) — should appear only once
      const squatEntries = summary.uniqueExercises.filter((e) => e.name === 'Sentadilla');
      expect(squatEntries).toHaveLength(1);
    });
  });

  describe('day overview with setsXReps (REQ-SUMMARY-003)', () => {
    it('should produce correct day breakdown with slot tiers and setsXReps format', () => {
      const def = createGzclpDefinition();

      const summary = buildProgramSummary(def);

      expect(summary.days).toHaveLength(2);
      expect(summary.days[0].name).toBe('Day A');
      expect(summary.days[1].name).toBe('Day B');

      // Day A T1 squat: 5x3+ (amrap)
      const dayAExercises = summary.days[0].exercises;
      expect(dayAExercises[0].setsXReps).toBe('5x3+');
      expect(dayAExercises[0].tier).toBe('T1');

      // Day A T2 bench: 3x10 (no amrap)
      expect(dayAExercises[1].setsXReps).toBe('3x10');
      expect(dayAExercises[1].tier).toBe('T2');

      // Day A T3 row: 3x15+ (amrap)
      expect(dayAExercises[2].setsXReps).toBe('3x15+');
      expect(dayAExercises[2].tier).toBe('T3');
    });
  });

  describe('progression rules mapping (REQ-SUMMARY-004)', () => {
    it('should map add_weight rule to Spanish text containing "Sube peso"', () => {
      const def = createGzclpDefinition();

      const summary = buildProgramSummary(def);

      const addWeightRule = summary.progressionRules.find((r) =>
        r.description.includes('Sube peso')
      );
      expect(addWeightRule).toBeDefined();
    });

    it('should map deload_percent to text containing "Descarga al" and advance_stage to "siguiente etapa"', () => {
      const def = createGzclpDefinition();

      const summary = buildProgramSummary(def);

      const deloadRule = summary.progressionRules.find((r) =>
        r.description.includes('Descarga al 10%')
      );
      expect(deloadRule).toBeDefined();

      const advanceRule = summary.progressionRules.find((r) =>
        r.description.includes('siguiente etapa')
      );
      expect(advanceRule).toBeDefined();
    });

    it('should map double_progression to text containing rep range "8-12" and update_tm to text containing "training max"', () => {
      const def = createProgressionDefinition();

      const summary = buildProgramSummary(def);

      const doubleProgRule = summary.progressionRules.find((r) => r.description.includes('8-12'));
      expect(doubleProgRule).toBeDefined();

      const updateTmRule = summary.progressionRules.find((r) =>
        r.description.includes('training max')
      );
      expect(updateTmRule).toBeDefined();
    });
  });

  describe('stage count and config field count (REQ-SUMMARY-005)', () => {
    it('should compute correct stageCount (max across all slots) and configFieldCount', () => {
      const def = createGzclpDefinition();

      const summary = buildProgramSummary(def);

      // T1 has 3 stages, T2 has 3 stages, T3 has 1 stage — max is 3
      expect(summary.stageCount).toBe(3);
      expect(summary.hasStages).toBe(true);

      // 4 config fields (3 weight + 1 select)
      expect(summary.configFieldCount).toBe(4);
    });

    it('should handle single-stage exercises correctly', () => {
      const def: ProgramDefinition = {
        id: 'single-stage',
        name: 'Single Stage',
        description: 'Test.',
        author: 'Test',
        version: 1,
        category: 'strength',
        source: 'preset',
        cycleLength: 1,
        totalWorkouts: 30,
        workoutsPerWeek: 3,
        exercises: { deadlift: { name: 'Peso Muerto' } },
        configFields: [
          { key: 'deadlift', label: 'Peso Muerto', type: 'weight' as const, min: 40, step: 5 },
        ],
        weightIncrements: { deadlift: 5 },
        days: [
          {
            name: 'Full Body',
            slots: [
              {
                id: 's1',
                exerciseId: 'deadlift',
                tier: 'T1',
                stages: [{ sets: 5, reps: 3 }],
                onSuccess: { type: 'add_weight' },
                onMidStageFail: { type: 'no_change' },
                onFinalStageFail: { type: 'no_change' },
                startWeightKey: 'deadlift',
              },
            ],
          },
        ],
      };

      const summary = buildProgramSummary(def);

      expect(summary.stageCount).toBe(1);
      expect(summary.hasStages).toBe(false);
      expect(summary.uniqueExerciseCount).toBe(1);
      expect(summary.uniqueExercises[0].name).toBe('Peso Muerto');
    });
  });
});
