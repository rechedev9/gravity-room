/**
 * Binary logistic regression trained via IRLS (Newton's method, a.k.a.
 * iteratively reweighted least squares) with L2 regularization, mirroring the
 * scikit-learn `LogisticRegression` configuration used by the Python analytics
 * service (apps/backend/analytics/ml/recommendation.py).
 *
 * The Python code uses `LogisticRegression(max_iter=200, random_state=42)`,
 * whose defaults are: penalty="l2", C=1.0, fit_intercept=True, and the
 * intercept is NOT regularized. scikit-learn minimizes the strictly convex
 *
 *     0.5 * ||w||^2 + C * sum_i log(1 + exp(-y_i (x_i . w + b)))     y_i in {-1,+1}
 *
 * which has a unique minimizer. IRLS converges to that same minimizer, so the
 * fitted coefficients and `predict_proba` outputs match scikit-learn (whose
 * default lbfgs solver stops at tol=1e-4) to well within a few 1e-3.
 *
 * The features are standardized exactly as recommendation.py does it: per
 * column, subtract the population mean and divide by the population standard
 * deviation (numpy `std`, ddof=0), with zero-variance columns given std 1.0.
 */

export interface LogisticOptions {
  /** Inverse L2 regularization strength (scikit-learn `C`). Default 1.0. */
  readonly C?: number;
  /** Maximum Newton iterations. Default 200. */
  readonly maxIter?: number;
  /** Convergence tolerance on the max-norm of the Newton step. Default 1e-10. */
  readonly tol?: number;
}

export interface LogisticModel {
  /** Fitted weight per input feature. */
  readonly weights: number[];
  /** Fitted (unregularized) intercept. */
  readonly intercept: number;
  /** Newton iterations actually performed. */
  readonly iterations: number;
  /** Whether the iteration converged within `tol`. */
  readonly converged: boolean;
}

export interface Standardization {
  readonly mean: number[];
  readonly std: number[];
}

export interface LogisticPrediction {
  readonly model: LogisticModel;
  readonly standardization: Standardization;
  /** P(class = 1) for each query row. */
  readonly probabilities: number[];
}

const DEFAULT_C = 1.0;
const DEFAULT_MAX_ITER = 200;
const DEFAULT_TOL = 1e-10;

function sigmoid(z: number): number {
  // Numerically stable logistic function.
  if (z >= 0) {
    return 1 / (1 + Math.exp(-z));
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

/** Number of distinct label values. The caller uses this to detect a degenerate
 * single-class training set (scikit-learn requires >= 2 classes). */
export function distinctClassCount(y: readonly number[]): number {
  return new Set(y).size;
}

/**
 * Per-column standardization, matching recommendation.py:
 *   col_mean = X.mean(axis=0)
 *   col_std  = X.std(axis=0)        # numpy population std (ddof=0)
 *   col_std[col_std == 0] = 1.0
 */
export function standardizeColumns(X: readonly (readonly number[])[]): {
  scaled: number[][];
  mean: number[];
  std: number[];
} {
  const n = X.length;
  if (n === 0) {
    return { scaled: [], mean: [], std: [] };
  }
  const d = X[0].length;
  const mean = new Array<number>(d).fill(0);
  for (const row of X) {
    for (let j = 0; j < d; j++) mean[j] += row[j];
  }
  for (let j = 0; j < d; j++) mean[j] /= n;

  const std = new Array<number>(d).fill(0);
  for (const row of X) {
    for (let j = 0; j < d; j++) {
      const dj = row[j] - mean[j];
      std[j] += dj * dj;
    }
  }
  for (let j = 0; j < d; j++) {
    std[j] = Math.sqrt(std[j] / n);
    if (std[j] === 0) std[j] = 1.0;
  }

  const scaled = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));
  return { scaled, mean, std };
}

/** Apply a previously computed standardization to a single feature row. */
export function applyStandardization(x: readonly number[], s: Standardization): number[] {
  return x.map((v, j) => (v - s.mean[j]) / s.std[j]);
}

/** Linear score beta . [x, 1] = w . x + intercept. */
function linearScore(beta: readonly number[], row: readonly number[], d: number): number {
  let eta = beta[d];
  for (let j = 0; j < d; j++) eta += beta[j] * row[j];
  return eta;
}

/** Accumulate one sample's contribution to the gradient and (upper) Hessian of
 * the augmented system, where the augmented feature vector is [row..., 1]. */
function accumulateSample(
  g: number[],
  H: number[][],
  row: readonly number[],
  d: number,
  size: number,
  resid: number,
  w: number
): void {
  for (let j = 0; j < size; j++) {
    const aj = j < d ? row[j] : 1;
    g[j] += resid * aj;
    const Hj = H[j];
    for (let k = j; k < size; k++) {
      const ak = k < d ? row[k] : 1;
      Hj[k] += w * aj * ak;
    }
  }
}

/** Mirror the upper triangle of a symmetric matrix into the lower triangle. */
function mirrorUpperTriangle(H: number[][], size: number): void {
  for (let j = 0; j < size; j++) {
    for (let k = j + 1; k < size; k++) {
      H[k][j] = H[j][k];
    }
  }
}

/** Build the penalized gradient and Hessian at the current `beta`. The ridge
 * penalty (coefficient `lambda`) applies to the weight dimensions only. */
function buildGradientHessian(
  X: readonly (readonly number[])[],
  y: readonly number[],
  beta: readonly number[],
  d: number,
  size: number,
  lambda: number
): { g: number[]; H: number[][] } {
  const g = new Array<number>(size).fill(0);
  const H: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));

  for (let i = 0; i < X.length; i++) {
    const row = X[i];
    const p = sigmoid(linearScore(beta, row, d));
    accumulateSample(g, H, row, d, size, p - y[i], p * (1 - p));
  }

  for (let j = 0; j < d; j++) {
    g[j] += lambda * beta[j];
    H[j][j] += lambda;
  }
  mirrorUpperTriangle(H, size);
  return { g, H };
}

/** Choose the partial-pivot row (largest magnitude) for column `col`. */
function pivotRowFor(A: readonly number[][], col: number, size: number): number {
  let pivotRow = col;
  let pivotMag = Math.abs(A[col][col]);
  for (let r = col + 1; r < size; r++) {
    const mag = Math.abs(A[r][col]);
    if (mag > pivotMag) {
      pivotMag = mag;
      pivotRow = r;
    }
  }
  return pivotRow;
}

/** Eliminate column `col` below the pivot row in A and b. */
function eliminateColumn(A: number[][], b: number[], col: number, size: number): void {
  const pivot = A[col][col];
  if (pivot === 0) return;
  for (let r = col + 1; r < size; r++) {
    const factor = A[r][col] / pivot;
    if (factor === 0) continue;
    const Ar = A[r];
    const Acol = A[col];
    for (let c = col; c < size; c++) Ar[c] -= factor * Acol[c];
    b[r] -= factor * b[col];
  }
}

/** Solve A z = b by Gaussian elimination with partial pivoting. A and b are
 * mutated in place. */
function solveLinearSystem(A: number[][], b: number[], size: number): number[] {
  for (let col = 0; col < size; col++) {
    const pivotRow = pivotRowFor(A, col, size);
    if (pivotRow !== col) {
      const tmpA = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmpA;
      const tmpB = b[col];
      b[col] = b[pivotRow];
      b[pivotRow] = tmpB;
    }
    eliminateColumn(A, b, col, size);
  }

  const z = new Array<number>(size).fill(0);
  for (let i = size - 1; i >= 0; i--) {
    let sum = b[i];
    for (let c = i + 1; c < size; c++) sum -= A[i][c] * z[c];
    const diag = A[i][i];
    z[i] = diag === 0 ? 0 : sum / diag;
  }
  return z;
}

/**
 * Fit a binary logistic regression by L2-regularized IRLS (Newton's method).
 *
 * Labels `y` must be 0/1. The objective minimized is
 *   NLL(beta) + (1 / (2C)) * ||w||^2
 * with the intercept excluded from the penalty, equivalent up to a positive
 * scale to scikit-learn's objective above.
 */
export function fitLogisticRegression(
  X: readonly (readonly number[])[],
  y: readonly number[],
  options: LogisticOptions = {}
): LogisticModel {
  const C = options.C ?? DEFAULT_C;
  const maxIter = options.maxIter ?? DEFAULT_MAX_ITER;
  const tol = options.tol ?? DEFAULT_TOL;

  const n = X.length;
  if (n === 0) throw new Error('fitLogisticRegression: empty training set');
  const d = X[0].length;
  const size = d + 1; // weights + intercept
  const lambda = 1 / C; // ridge coefficient on the weight dimensions only

  // beta = [w_0, ..., w_{d-1}, intercept]
  const beta = new Array<number>(size).fill(0);

  let iterations = 0;
  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const { g, H } = buildGradientHessian(X, y, beta, d, size, lambda);
    const delta = solveLinearSystem(H, g, size);

    let maxStep = 0;
    for (let j = 0; j < size; j++) {
      beta[j] -= delta[j];
      const mag = Math.abs(delta[j]);
      if (mag > maxStep) maxStep = mag;
    }

    if (maxStep < tol) {
      converged = true;
      break;
    }
  }

  return {
    weights: beta.slice(0, d),
    intercept: beta[d],
    iterations,
    converged,
  };
}

/** P(class = 1) for a single (already standardized) feature row. */
export function predictProba(model: LogisticModel, x: readonly number[]): number {
  let z = model.intercept;
  for (let j = 0; j < model.weights.length; j++) {
    z += model.weights[j] * x[j];
  }
  return sigmoid(z);
}

/**
 * Full standardize -> fit -> predict pipeline mirroring the ML path in
 * recommendation.py: standardize the training features, fit the IRLS logistic
 * model, then standardize and score each query row with the SAME column
 * mean/std. The single-class fallback (scikit-learn rejects < 2 classes) is the
 * caller's responsibility; use `distinctClassCount(y)` to detect it.
 */
export function standardizeTrainPredict(
  X: readonly (readonly number[])[],
  y: readonly number[],
  queries: readonly (readonly number[])[],
  options: LogisticOptions = {}
): LogisticPrediction {
  const { scaled, mean, std } = standardizeColumns(X);
  const standardization: Standardization = { mean, std };
  const model = fitLogisticRegression(scaled, y, options);
  const probabilities = queries.map((q) =>
    predictProba(model, applyStandardization(q, standardization))
  );
  return { model, standardization, probabilities };
}
