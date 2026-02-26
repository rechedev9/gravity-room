import { describe, it, expect } from 'bun:test';
import { extractGenericChartData, calculateStats } from './generic-stats';
import { computeGenericProgram } from './generic-engine';
import { NIVEL7_DEFINITION_FIXTURE as NIVEL7_DEFINITION } from '../test/fixtures';

const BASE_CONFIG: Record<string, number> = {
  press_mil: 50,
  bench: 70,
  squat: 90,
  deadlift: 110,
};

describe('extractGenericChartData', () => {
  it('should return a key for every exercise in the definition', () => {
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    const exerciseIds = Object.keys(NIVEL7_DEFINITION.exercises);
    expect(Object.keys(data).sort()).toEqual(exerciseIds.sort());
  });

  it('should have data points for main lifts across all 48 workouts', () => {
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    // press_mil appears once per Monday = 12 times across 48 workouts
    expect(data['press_mil'].length).toBe(12);
    // bench appears once per Thursday = 12 times
    expect(data['bench'].length).toBe(12);
  });

  it('should merge slot variants into a single exercise series', () => {
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    // press_mil has 3 phases × 2 cycles = 6 slot IDs, but they're all merged
    // into one series of 12 data points (one per appearance)
    const series = data['press_mil'];
    expect(series[0].weight).toBe(40); // c1b1 week 1
    expect(series[11].weight).toBe(52.5); // c2b2 week 12
  });

  it('should track results when provided', () => {
    const results = {
      '0': { 'press_mil-c1b1': { result: 'success' as const } },
    };
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, results);
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    expect(data['press_mil'][0].result).toBe('success');
    expect(data['press_mil'][1].result).toBeNull();
  });

  it('should produce data compatible with calculateStats', () => {
    const results = {
      '0': { 'press_mil-c1b1': { result: 'success' as const } },
      '4': { 'press_mil-c1b1': { result: 'success' as const } },
      '8': { 'press_mil-c1b1d': { result: 'success' as const } },
    };
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, results);
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);
    const stats = calculateStats(data['press_mil']);

    expect(stats.total).toBe(3);
    expect(stats.successes).toBe(3);
    expect(stats.rate).toBe(100);
    expect(stats.startWeight).toBe(40);
  });

  it('should include accessory exercises', () => {
    const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});
    const data = extractGenericChartData(NIVEL7_DEFINITION, rows);

    // press_franc appears on every Monday = 12 times
    expect(data['press_franc'].length).toBe(12);
    expect(data['press_franc'][0].weight).toBe(0);
    expect(data['press_franc'][0].stage).toBe(1); // stage 0 + 1 = 1
  });
});
