/**
 * Prescribed-weight replay: a result recorded without a logged weight must get
 * the weight the program engine prescribed for that workout.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect } from 'vitest';
import { PROGRAM_TEMPLATE_DEFINITIONS } from '@gzclp/database/seeds/program-templates-seed';
import { CANONICAL_EXERCISES } from '@gzclp/database/seeds/exercises-seed';
import { hydrateProgramDefinition } from '../lib/hydrate-program';
import { prescribedWeights, weightKey, type AnalyticsResultRow } from './prescribed-weight';

function gzclp() {
  const hydrated = hydrateProgramDefinition(
    {
      id: 'gzclp',
      name: 'GZCLP',
      description: '',
      author: '',
      version: 1,
      category: 'strength',
      source: 'preset',
      definition: PROGRAM_TEMPLATE_DEFINITIONS['gzclp'],
    },
    CANONICAL_EXERCISES.map((exercise) => ({ id: exercise.id, name: exercise.name }))
  );
  if (!hydrated.ok) throw new Error('GZCLP seed must hydrate');
  return hydrated.value;
}

function row(workoutIndex: number, result: 'success' | 'fail'): AnalyticsResultRow {
  return {
    instanceId: 'i1',
    workoutIndex,
    slotId: 'd1-t1',
    result,
    amrapReps: null,
    rpe: null,
    setLogs: null,
    loggedWeight: null,
  };
}

const CONFIG = { squat: 60, bench: 40, deadlift: 80, ohp: 30, latpulldown: 30, dbrow: 20 };

describe('prescribedWeights', () => {
  it('follows the progression the earlier results produced', () => {
    const definition = gzclp();
    const increment = definition.weightIncrements['squat'] ?? 0;

    // Day 1 repeats every 4 workouts: success adds the increment, a fail holds it.
    const weights = prescribedWeights([row(0, 'success'), row(4, 'fail'), row(8, 'success')], {
      definition,
      config: CONFIG,
    });

    expect(increment).toBeGreaterThan(0);
    expect(weights.get(weightKey(row(0, 'success')))).toBe(60);
    expect(weights.get(weightKey(row(4, 'fail')))).toBe(60 + increment);
    expect(weights.get(weightKey(row(8, 'success')))).toBe(60 + increment);
  });

  it('omits slots that carry no load', () => {
    const weights = prescribedWeights([row(0, 'success')], { definition: gzclp(), config: {} });

    expect(weights.size).toBe(0);
  });
});
