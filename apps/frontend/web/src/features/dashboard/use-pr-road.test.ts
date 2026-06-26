import { describe, it, expect } from 'vitest';
import { computePrRoad } from './use-pr-road';

describe('computePrRoad', () => {
  it('returns null when no history', () => {
    expect(computePrRoad([])).toBeNull();
  });

  it('finds the lift closest to its PR among history', () => {
    const history = [
      { lift: 'Banca', weight: 67.5, isPr: false, prTarget: 70 },
      { lift: 'Sentadilla', weight: 80, isPr: false, prTarget: 100 },
    ];
    const r = computePrRoad(history);
    expect(r?.lift).toBe('Banca');
    expect(r?.deltaToPr).toBe(2.5);
  });

  it('skips lifts that have already broken their PR', () => {
    const history = [
      { lift: 'Banca', weight: 72, isPr: true, prTarget: 70 },
      { lift: 'Sentadilla', weight: 80, isPr: false, prTarget: 100 },
    ];
    const r = computePrRoad(history);
    expect(r?.lift).toBe('Sentadilla');
  });
});
