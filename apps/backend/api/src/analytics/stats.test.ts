import { describe, it, expect } from 'vitest';
import {
  linregress,
  studentTCdf,
  studentTSf,
  studentTQuantile,
  regularizedIncompleteBeta,
  logGamma,
} from './stats';
import golden from './__fixtures__/golden.json';

// Parity oracle generated live from scipy 1.15.1 (see __fixtures__/generate_golden.py).
// scipy.stats.linregress, scipy.stats.t.cdf and scipy.stats.t.ppf are the exact
// functions used by ml/plateau.py and ml/forecast.py.

describe('logGamma', () => {
  it('matches known exact values', () => {
    // gamma(n) = (n-1)!  ->  logGamma(n) = log((n-1)!)
    expect(logGamma(1)).toBeCloseTo(0, 12); // 0! = 1
    expect(logGamma(2)).toBeCloseTo(0, 12); // 1! = 1
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 10); // 4! = 24
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
  });
});

describe('regularizedIncompleteBeta', () => {
  it('is 0 at x=0 and 1 at x=1', () => {
    expect(regularizedIncompleteBeta(0, 2, 3)).toBe(0);
    expect(regularizedIncompleteBeta(1, 2, 3)).toBe(1);
  });

  it('is symmetric: I_x(a,b) = 1 - I_{1-x}(b,a)', () => {
    const x = 0.37;
    const a = 2.5;
    const b = 1.5;
    expect(regularizedIncompleteBeta(x, a, b)).toBeCloseTo(
      1 - regularizedIncompleteBeta(1 - x, b, a),
      12
    );
  });

  it('I_0.5(a,a) = 0.5 by symmetry', () => {
    expect(regularizedIncompleteBeta(0.5, 3, 3)).toBeCloseTo(0.5, 12);
  });
});

describe('linregress', () => {
  for (const c of golden.linregress) {
    it(`matches scipy on "${c.name}"`, () => {
      const r = linregress(c.x, c.y);
      expect(r.slope).toBeCloseTo(c.slope, 9);
      expect(r.intercept).toBeCloseTo(c.intercept, 9);
      if (c.rvalue !== null) {
        expect(r.rValue).toBeCloseTo(c.rvalue, 9);
      }
      if (c.rSquared !== null) {
        expect(r.rSquared).toBeCloseTo(c.rSquared, 9);
      }
      expect(r.stderr).toBeCloseTo(c.stderr, 9);
      if (c.pvalue !== null) {
        if (c.pvalue < 1e-10) {
          // Astronomically small p-values (near-perfect fits): assert both are
          // effectively zero rather than chasing relative precision in the tail.
          expect(r.pValue).toBeLessThan(1e-10);
        } else {
          expect(r.pValue).toBeCloseTo(c.pvalue, 6);
        }
      }
    });
  }

  it('handles a perfectly flat series like scipy (r=0, slope=0, p=1)', () => {
    const r = linregress([0, 1, 2, 3, 4], [50, 50, 50, 50, 50]);
    expect(r.slope).toBe(0);
    expect(r.rValue).toBe(0);
    expect(r.rSquared).toBe(0);
    expect(r.pValue).toBeCloseTo(1.0, 12);
  });

  it('throws on length mismatch and on < 2 points', () => {
    expect(() => linregress([1, 2], [1])).toThrow();
    expect(() => linregress([1], [1])).toThrow();
  });
});

describe('studentTCdf', () => {
  for (const c of golden.tCdf) {
    it(`cdf(${c.x}, df=${c.df}) matches scipy`, () => {
      expect(studentTCdf(c.x, c.df)).toBeCloseTo(c.cdf, 9);
    });
  }

  it('cdf(0, df) = 0.5 exactly for any df', () => {
    expect(studentTCdf(0, 1)).toBeCloseTo(0.5, 12);
    expect(studentTCdf(0, 30)).toBeCloseTo(0.5, 12);
  });

  it('survival function complements the CDF', () => {
    expect(studentTSf(1.3, 7)).toBeCloseTo(1 - studentTCdf(1.3, 7), 12);
  });
});

describe('studentTQuantile', () => {
  for (const c of golden.tPpf) {
    it(`ppf(${c.p}, df=${c.df}) matches scipy`, () => {
      expect(studentTQuantile(c.p, c.df)).toBeCloseTo(c.ppf, 6);
    });
  }

  it('round-trips with the CDF', () => {
    for (const [p, df] of [
      [0.8, 5],
      [0.975, 12],
      [0.3, 40],
    ] as const) {
      const q = studentTQuantile(p, df);
      expect(studentTCdf(q, df)).toBeCloseTo(p, 9);
    }
  });

  it('is symmetric about zero', () => {
    expect(studentTQuantile(0.975, 6)).toBeCloseTo(-studentTQuantile(0.025, 6), 9);
  });

  it('returns 0 at p=0.5', () => {
    expect(studentTQuantile(0.5, 10)).toBe(0);
  });
});
