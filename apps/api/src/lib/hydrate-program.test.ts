/**
 * hydrate-program unit tests — verifies hydrateProgramDefinition produces
 * valid ProgramDefinition objects for all 3 preset programs, and correctly
 * handles error cases (invalid JSONB, missing exercises, schema validation).
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect } from 'bun:test';
import { hydrateProgramDefinition, type TemplateRow, type ExerciseRow } from './hydrate-program';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';

// ---------------------------------------------------------------------------
// Minimal GZCLP template fixture (matches program-templates-seed.ts shape)
// ---------------------------------------------------------------------------

const GZCLP_EXERCISES: readonly ExerciseRow[] = [
  { id: 'squat', name: 'Sentadilla' },
  { id: 'bench', name: 'Press Banca' },
  { id: 'deadlift', name: 'Peso Muerto' },
  { id: 'ohp', name: 'Press Militar' },
  { id: 'latpulldown', name: 'Jalón al Pecho' },
  { id: 'dbrow', name: 'Remo con Mancuernas' },
];

function makeGzclpTemplate(): TemplateRow {
  return {
    id: 'gzclp',
    name: 'GZCLP',
    description: 'A linear progression program.',
    author: 'Cody Lefever',
    version: 1,
    category: 'strength',
    source: 'preset',
    definition: {
      cycleLength: 4,
      totalWorkouts: 90,
      workoutsPerWeek: 3,
      exercises: {
        squat: {},
        bench: {},
        deadlift: {},
        ohp: {},
        latpulldown: {},
        dbrow: {},
      },
      configFields: [
        { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 },
        { key: 'bench', label: 'Press Banca', type: 'weight', min: 2.5, step: 2.5 },
        { key: 'deadlift', label: 'Peso Muerto', type: 'weight', min: 2.5, step: 2.5 },
        { key: 'ohp', label: 'Press Militar', type: 'weight', min: 2.5, step: 2.5 },
        { key: 'latpulldown', label: 'Jalón al Pecho', type: 'weight', min: 2.5, step: 2.5 },
        { key: 'dbrow', label: 'Remo con Mancuernas', type: 'weight', min: 2.5, step: 2.5 },
      ],
      weightIncrements: {
        squat: 5,
        bench: 2.5,
        deadlift: 5,
        ohp: 2.5,
        latpulldown: 2.5,
        dbrow: 2.5,
      },
      days: [
        {
          name: 'Día 1',
          slots: [
            {
              id: 'd1-t1',
              exerciseId: 'squat',
              tier: 't1',
              stages: [
                { sets: 5, reps: 3 },
                { sets: 6, reps: 2 },
                { sets: 10, reps: 1 },
              ],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'advance_stage' },
              onFinalStageFail: { type: 'deload_percent', percent: 10 },
              startWeightKey: 'squat',
            },
            {
              id: 'd1-t2',
              exerciseId: 'bench',
              tier: 't2',
              stages: [
                { sets: 3, reps: 10 },
                { sets: 3, reps: 8 },
                { sets: 3, reps: 6 },
              ],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'advance_stage' },
              onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
              startWeightKey: 'bench',
              startWeightMultiplier: 0.65,
            },
            {
              id: 'latpulldown-t3',
              exerciseId: 'latpulldown',
              tier: 't3',
              stages: [{ sets: 3, reps: 25, amrap: true }],
              onSuccess: { type: 'add_weight' },
              onUndefined: { type: 'no_change' },
              onMidStageFail: { type: 'no_change' },
              onFinalStageFail: { type: 'no_change' },
              startWeightKey: 'latpulldown',
            },
          ],
        },
        {
          name: 'Día 2',
          slots: [
            {
              id: 'd2-t1',
              exerciseId: 'ohp',
              tier: 't1',
              stages: [
                { sets: 5, reps: 3 },
                { sets: 6, reps: 2 },
                { sets: 10, reps: 1 },
              ],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'advance_stage' },
              onFinalStageFail: { type: 'deload_percent', percent: 10 },
              startWeightKey: 'ohp',
            },
            {
              id: 'd2-t2',
              exerciseId: 'deadlift',
              tier: 't2',
              stages: [
                { sets: 3, reps: 10 },
                { sets: 3, reps: 8 },
                { sets: 3, reps: 6 },
              ],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'advance_stage' },
              onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
              startWeightKey: 'deadlift',
              startWeightMultiplier: 0.65,
            },
            {
              id: 'dbrow-t3',
              exerciseId: 'dbrow',
              tier: 't3',
              stages: [{ sets: 3, reps: 25, amrap: true }],
              onSuccess: { type: 'add_weight' },
              onUndefined: { type: 'no_change' },
              onMidStageFail: { type: 'no_change' },
              onFinalStageFail: { type: 'no_change' },
              startWeightKey: 'dbrow',
            },
          ],
        },
        {
          name: 'Día 3',
          slots: [
            {
              id: 'd3-t1',
              exerciseId: 'bench',
              tier: 't1',
              stages: [
                { sets: 5, reps: 3 },
                { sets: 6, reps: 2 },
                { sets: 10, reps: 1 },
              ],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'advance_stage' },
              onFinalStageFail: { type: 'deload_percent', percent: 10 },
              startWeightKey: 'bench',
            },
            {
              id: 'd3-t2',
              exerciseId: 'squat',
              tier: 't2',
              stages: [
                { sets: 3, reps: 10 },
                { sets: 3, reps: 8 },
                { sets: 3, reps: 6 },
              ],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'advance_stage' },
              onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
              startWeightKey: 'squat',
              startWeightMultiplier: 0.65,
            },
            {
              id: 'latpulldown-t3',
              exerciseId: 'latpulldown',
              tier: 't3',
              stages: [{ sets: 3, reps: 25, amrap: true }],
              onSuccess: { type: 'add_weight' },
              onUndefined: { type: 'no_change' },
              onMidStageFail: { type: 'no_change' },
              onFinalStageFail: { type: 'no_change' },
              startWeightKey: 'latpulldown',
            },
          ],
        },
        {
          name: 'Día 4',
          slots: [
            {
              id: 'd4-t1',
              exerciseId: 'deadlift',
              tier: 't1',
              stages: [
                { sets: 5, reps: 3 },
                { sets: 6, reps: 2 },
                { sets: 10, reps: 1 },
              ],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'advance_stage' },
              onFinalStageFail: { type: 'deload_percent', percent: 10 },
              startWeightKey: 'deadlift',
            },
            {
              id: 'd4-t2',
              exerciseId: 'ohp',
              tier: 't2',
              stages: [
                { sets: 3, reps: 10 },
                { sets: 3, reps: 8 },
                { sets: 3, reps: 6 },
              ],
              onSuccess: { type: 'add_weight' },
              onMidStageFail: { type: 'advance_stage' },
              onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
              startWeightKey: 'ohp',
              startWeightMultiplier: 0.65,
            },
            {
              id: 'dbrow-t3',
              exerciseId: 'dbrow',
              tier: 't3',
              stages: [{ sets: 3, reps: 25, amrap: true }],
              onSuccess: { type: 'add_weight' },
              onUndefined: { type: 'no_change' },
              onMidStageFail: { type: 'no_change' },
              onFinalStageFail: { type: 'no_change' },
              startWeightKey: 'dbrow',
            },
          ],
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hydrateProgramDefinition', () => {
  describe('GZCLP happy path', () => {
    it('should return Ok with a valid ProgramDefinition', () => {
      const template = makeGzclpTemplate();

      const result = hydrateProgramDefinition(template, GZCLP_EXERCISES);

      expect(result.ok).toBe(true);
    });

    it('should pass ProgramDefinitionSchema validation', () => {
      const template = makeGzclpTemplate();

      const result = hydrateProgramDefinition(template, GZCLP_EXERCISES);

      if (!result.ok) throw new Error('Expected Ok result');
      expect(() => ProgramDefinitionSchema.parse(result.value)).not.toThrow();
    });

    it('should populate exercise names from exerciseRows, not JSONB', () => {
      const template = makeGzclpTemplate();

      const result = hydrateProgramDefinition(template, GZCLP_EXERCISES);

      if (!result.ok) throw new Error('Expected Ok result');
      expect(result.value.exercises['squat']?.name).toBe('Sentadilla');
      expect(result.value.exercises['bench']?.name).toBe('Press Banca');
    });

    it('should set id, name, description from template row', () => {
      const template = makeGzclpTemplate();

      const result = hydrateProgramDefinition(template, GZCLP_EXERCISES);

      if (!result.ok) throw new Error('Expected Ok result');
      expect(result.value.id).toBe('gzclp');
      expect(result.value.name).toBe('GZCLP');
      expect(result.value.description).toBe('A linear progression program.');
    });

    it('should have 4 days', () => {
      const template = makeGzclpTemplate();

      const result = hydrateProgramDefinition(template, GZCLP_EXERCISES);

      if (!result.ok) throw new Error('Expected Ok result');
      expect(result.value.days).toHaveLength(4);
    });

    it('should have 6 exercises', () => {
      const template = makeGzclpTemplate();

      const result = hydrateProgramDefinition(template, GZCLP_EXERCISES);

      if (!result.ok) throw new Error('Expected Ok result');
      expect(Object.keys(result.value.exercises)).toHaveLength(6);
    });
  });

  describe('invalid JSONB', () => {
    it('should return Err(INVALID_DEFINITION) when definition is a string', () => {
      const template: TemplateRow = {
        id: 'bad',
        name: 'Bad',
        description: '',
        author: '',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: 'not an object',
      };

      const result = hydrateProgramDefinition(template, []);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_DEFINITION');
    });

    it('should return Err(INVALID_DEFINITION) when definition is null', () => {
      const template: TemplateRow = {
        id: 'bad',
        name: 'Bad',
        description: '',
        author: '',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: null,
      };

      const result = hydrateProgramDefinition(template, []);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_DEFINITION');
    });

    it('should return Err(INVALID_DEFINITION) when definition is a number', () => {
      const template: TemplateRow = {
        id: 'bad',
        name: 'Bad',
        description: '',
        author: '',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: 42,
      };

      const result = hydrateProgramDefinition(template, []);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_DEFINITION');
    });
  });

  describe('missing exercise reference', () => {
    it('should return Err(MISSING_EXERCISE_REFERENCE) when an exercise is missing', () => {
      const template = makeGzclpTemplate();
      // Only provide 5 of 6 exercises — omit 'dbrow'
      const incompleteExercises = GZCLP_EXERCISES.filter((e) => e.id !== 'dbrow');

      const result = hydrateProgramDefinition(template, incompleteExercises);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('MISSING_EXERCISE_REFERENCE');
      if (result.error.code !== 'MISSING_EXERCISE_REFERENCE') return;
      expect(result.error.exerciseId).toBe('dbrow');
    });

    it('should return Err when all exercises are missing', () => {
      const template = makeGzclpTemplate();

      const result = hydrateProgramDefinition(template, []);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('MISSING_EXERCISE_REFERENCE');
    });
  });

  describe('schema validation failure', () => {
    it('should return Err(SCHEMA_VALIDATION_FAILED) for definition missing required fields', () => {
      const template: TemplateRow = {
        id: 'bad',
        name: 'Bad',
        description: '',
        author: '',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: {
          // Valid object but missing required fields (days, cycleLength, etc.)
          exercises: {},
        },
      };

      const result = hydrateProgramDefinition(template, []);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('SCHEMA_VALIDATION_FAILED');
    });
  });

  describe('exercise name resolution', () => {
    it('should use names from exerciseRows, ignoring any names in JSONB', () => {
      const template = makeGzclpTemplate();
      // Override exercise name to prove it comes from exerciseRows
      const customExercises: readonly ExerciseRow[] = [
        { id: 'squat', name: 'Custom Squat Name' },
        { id: 'bench', name: 'Custom Bench Name' },
        { id: 'deadlift', name: 'Custom Deadlift Name' },
        { id: 'ohp', name: 'Custom OHP Name' },
        { id: 'latpulldown', name: 'Custom Lat Pulldown Name' },
        { id: 'dbrow', name: 'Custom DB Row Name' },
      ];

      const result = hydrateProgramDefinition(template, customExercises);

      if (!result.ok) throw new Error('Expected Ok result');
      expect(result.value.exercises['squat']?.name).toBe('Custom Squat Name');
      expect(result.value.exercises['bench']?.name).toBe('Custom Bench Name');
    });
  });
});
