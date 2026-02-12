import { describe, it, expect } from 'bun:test';
import { extractChartData, calculateStats } from './stats';
import { DEFAULT_WEIGHTS, buildResults, buildSuccessfulResults } from '../../test/helpers/fixtures';

// ---------------------------------------------------------------------------
// extractChartData — integration through real T1 progression logic
// ---------------------------------------------------------------------------
describe('extractChartData', () => {
  it('should return chart data for all 4 T1 exercises', () => {
    const data = extractChartData(DEFAULT_WEIGHTS, {});
    expect(Object.keys(data).sort()).toEqual(['bench', 'deadlift', 'ohp', 'squat']);
  });

  it('should produce data points for each exercise appearance across 90 workouts', () => {
    const data = extractChartData(DEFAULT_WEIGHTS, {});
    // Each exercise appears as T1 once per 4-day cycle:
    // squat: Day 1 (0,4,8,...,88) → 23 appearances
    // ohp: Day 2 (1,5,9,...,89) → 23 appearances
    // bench: Day 3 (2,6,10,...,86) → 22 appearances
    // deadlift: Day 4 (3,7,11,...,87) → 22 appearances
    expect(data.squat).toHaveLength(23);
    expect(data.bench).toHaveLength(22);
    expect(data.ohp).toHaveLength(23);
    expect(data.deadlift).toHaveLength(22);
  });

  it('should show increasing weights with all successes', () => {
    const results = buildSuccessfulResults(90);
    const data = extractChartData(DEFAULT_WEIGHTS, results);

    // Squat starts at 60, increments by 5 each appearance
    for (let i = 1; i < data.squat.length; i++) {
      expect(data.squat[i].weight).toBeGreaterThan(data.squat[i - 1].weight);
    }
  });

  it('should track result values correctly', () => {
    const results = buildResults([
      [0, { t1: 'success' }],
      [4, { t1: 'fail' }],
    ]);
    const data = extractChartData(DEFAULT_WEIGHTS, results);

    // Squat at index 0 (first data point): success
    expect(data.squat[0].result).toBe('success');
    // Squat at index 4 (second data point): fail
    expect(data.squat[1].result).toBe('fail');
    // Squat at index 8 (third data point): no result
    expect(data.squat[2].result).toBeNull();
  });

  it('should track stage transitions on failure', () => {
    const results = buildResults([
      [0, { t1: 'fail' }], // squat stage 0 → 1
      [4, { t1: 'fail' }], // squat stage 1 → 2
    ]);
    const data = extractChartData(DEFAULT_WEIGHTS, results);

    // stage is stored as s+1 in chart data
    expect(data.squat[0].stage).toBe(1); // stage 0 → displayed as 1
    expect(data.squat[1].stage).toBe(2); // stage 1 → displayed as 2
    expect(data.squat[2].stage).toBe(3); // stage 2 → displayed as 3
  });

  it('should deload after stage 2 failure', () => {
    const results = buildResults([
      [0, { t1: 'fail' }],
      [4, { t1: 'fail' }],
      [8, { t1: 'fail' }], // stage 2 fail → deload
    ]);
    const data = extractChartData(DEFAULT_WEIGHTS, results);

    // After deload: stage resets to 0 (displayed as 1), weight = round(60*0.9) = 54
    expect(data.squat[3].stage).toBe(1);
    expect(data.squat[3].weight).toBe(54);
  });
});

// ---------------------------------------------------------------------------
// calculateStats — operates on ChartDataPoint arrays
// ---------------------------------------------------------------------------
describe('calculateStats', () => {
  it('should return zeros for empty data', () => {
    const stats = calculateStats([]);
    expect(stats).toEqual({
      total: 0,
      successes: 0,
      fails: 0,
      rate: 0,
      currentWeight: 0,
      startWeight: 0,
      gained: 0,
      currentStage: 1,
    });
  });

  it('should calculate correct stats from chart data with mixed results', () => {
    const results = buildResults([
      [0, { t1: 'success' }],
      [4, { t1: 'success' }],
      [8, { t1: 'fail' }],
    ]);
    const data = extractChartData(DEFAULT_WEIGHTS, results);
    const stats = calculateStats(data.squat);

    expect(stats.total).toBe(3); // 3 marked results
    expect(stats.successes).toBe(2);
    expect(stats.fails).toBe(1);
    expect(stats.rate).toBe(67); // round(2/3 * 100)
    expect(stats.startWeight).toBe(60);
  });

  it('should calculate weight gained correctly', () => {
    const results = buildSuccessfulResults(12); // 3 full cycles
    const data = extractChartData(DEFAULT_WEIGHTS, results);
    const stats = calculateStats(data.squat);

    // Squat: 3 appearances (0, 4, 8), each success adds 5kg
    // After 3 successes: start=60, current=75 (60 at idx0, 65 at idx4, 70 at idx8, then 75 at idx12 is 4th point)
    // But last point in data is the 4th appearance (not yet marked)
    expect(stats.gained).toBe(stats.currentWeight - stats.startWeight);
  });

  it('should report 100% success rate when all results are success', () => {
    const results = buildSuccessfulResults(20);
    const data = extractChartData(DEFAULT_WEIGHTS, results);
    const stats = calculateStats(data.squat);

    expect(stats.rate).toBe(100);
  });
});
