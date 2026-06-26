import { describe, it, expect } from 'vitest';
import {
  fitLogisticRegression,
  predictProba,
  standardizeColumns,
  applyStandardization,
  standardizeTrainPredict,
  distinctClassCount,
} from './logistic';
import golden from './__fixtures__/golden.json';

// Parity oracle generated live from scikit-learn 1.6.1 LogisticRegression
// (max_iter=200, random_state=42) with the SAME manual standardization the
// Python recommendation pipeline applies. See __fixtures__/generate_golden.py.
//
// IRLS (Newton) and scikit-learn's lbfgs both minimize the same strictly
// convex L2-regularized objective and converge to the same unique optimum.
// scikit-learn's default lbfgs stops at tol=1e-4, so we allow a small,
// documented tolerance on coefficients and probabilities.
const PROB_TOL = 2e-3; // absolute tolerance on predict_proba parity
const COEF_TOL = 5e-3; // absolute tolerance on fitted coefficients

describe('standardizeColumns', () => {
  it('matches numpy population mean/std with zero-variance -> 1.0', () => {
    const X = [
      [1, 5],
      [3, 5],
      [5, 5],
    ];
    const { mean, std, scaled } = standardizeColumns(X);
    expect(mean[0]).toBeCloseTo(3, 12);
    expect(mean[1]).toBeCloseTo(5, 12);
    // population std of [1,3,5] = sqrt(8/3)
    expect(std[0]).toBeCloseTo(Math.sqrt(8 / 3), 12);
    // constant column -> std forced to 1.0
    expect(std[1]).toBe(1);
    expect(scaled[1]![0]).toBeCloseTo(0, 12);
    expect(scaled[1]![1]).toBeCloseTo(0, 12);
  });
});

describe('distinctClassCount', () => {
  it('counts unique labels', () => {
    expect(distinctClassCount([1, 1, 1])).toBe(1);
    expect(distinctClassCount([0, 1, 0, 1])).toBe(2);
  });
});

describe('fitLogisticRegression + predictProba (parity with scikit-learn)', () => {
  for (const c of golden.logistic) {
    it(`coefficients match on "${c.name}"`, () => {
      const { scaled } = standardizeColumns(c.X);
      const model = fitLogisticRegression(scaled, c.y);
      expect(model.converged).toBe(true);
      for (let j = 0; j < c.coef.length; j++) {
        expect(Math.abs(model.weights[j]! - c.coef[j]!)).toBeLessThan(COEF_TOL);
      }
      expect(Math.abs(model.intercept - c.intercept)).toBeLessThan(COEF_TOL);
    });

    it(`predict_proba matches on "${c.name}"`, () => {
      const { result, mean, std } = (() => {
        const s = standardizeColumns(c.X);
        const model = fitLogisticRegression(s.scaled, c.y);
        return { result: model, mean: s.mean, std: s.std };
      })();
      for (let i = 0; i < c.queries.length; i++) {
        const xs = applyStandardization(c.queries[i]!, { mean, std });
        const p = predictProba(result, xs);
        expect(Math.abs(p - c.probs[i]!)).toBeLessThan(PROB_TOL);
      }
    });
  }
});

describe('standardizeTrainPredict (full pipeline)', () => {
  for (const c of golden.logistic) {
    it(`probabilities match scikit-learn on "${c.name}"`, () => {
      const { probabilities } = standardizeTrainPredict(c.X, c.y, c.queries);
      for (let i = 0; i < c.probs.length; i++) {
        expect(Math.abs(probabilities[i]! - c.probs[i]!)).toBeLessThan(PROB_TOL);
      }
    });
  }

  it('recovers a clean linear decision boundary', () => {
    // 1D separable problem: label = 1 iff feature > 0.
    const X = [[-3], [-2], [-1], [1], [2], [3]];
    const y = [0, 0, 0, 1, 1, 1];
    const { probabilities } = standardizeTrainPredict(X, y, [[-5], [5]]);
    expect(probabilities[0]!).toBeLessThan(0.1);
    expect(probabilities[1]!).toBeGreaterThan(0.9);
  });
});
