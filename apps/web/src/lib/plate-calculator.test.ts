import { describe, it, expect } from 'bun:test';
import { calculatePlates, BAR_KG } from './plate-calculator';

// ---------------------------------------------------------------------------
// Tests (REQ-PC-001)
// ---------------------------------------------------------------------------

describe('calculatePlates', () => {
  it('returns ok:true with correct plates for 100 kg (bar 20 + 2x(25+15))', () => {
    const result = calculatePlates(100, 20);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // 100 - 20 = 80 total, 40 per side: 25 + 15 = 40
      const totalPerSide = result.plates.reduce((sum, p) => sum + p.kg * p.count, 0);
      expect(totalPerSide).toBe(40);
    }
  });

  it('returns ok:false when target equals bar weight (20 kg)', () => {
    const result = calculatePlates(20, 20);

    expect(result).toEqual({ ok: false });
  });

  it('returns ok:true with [1.25x1] per side for 22.5 kg', () => {
    const result = calculatePlates(22.5, 20);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plates).toEqual([{ kg: 1.25, count: 1 }]);
    }
  });

  it('returns ok:false when target is below bar weight (15 kg)', () => {
    const result = calculatePlates(15, 20);

    expect(result).toEqual({ ok: false });
  });

  it('handles fractional weight 97.5 kg correctly', () => {
    const result = calculatePlates(97.5, 20);

    // 97.5 - 20 = 77.5 total, 38.75 per side: 25 + 10 + 2.5 + 1.25 = 38.75
    expect(result.ok).toBe(true);
    if (result.ok) {
      const totalPerSide = result.plates.reduce((sum, p) => sum + p.kg * p.count, 0);
      expect(totalPerSide).toBe(38.75);
    }
  });

  it('defaults barKg to BAR_KG (20) when omitted', () => {
    const withDefault = calculatePlates(40);
    const withExplicit = calculatePlates(40, 20);

    expect(withDefault).toEqual(withExplicit);
  });

  it('returns ok:false for unachievable weight (21 kg — 0.5 kg remainder)', () => {
    const result = calculatePlates(21, 20);

    expect(result).toEqual({ ok: false });
  });

  it('exports BAR_KG constant as 20', () => {
    expect(BAR_KG).toBe(20);
  });
});
