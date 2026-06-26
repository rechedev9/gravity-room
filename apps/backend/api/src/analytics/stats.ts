/**
 * Statistical primitives for the analytics port.
 *
 * Ports the exact scipy.stats semantics relied on by the Python analytics
 * service: ordinary-least-squares `linregress` (slope / intercept / r and its
 * two-sided p-value) plus the Student-t CDF and quantile used by plateau
 * detection (`scipy.stats.linregress` p-value) and forecasting
 * (`scipy.stats.t.ppf(0.975, df)` prediction-interval critical value).
 *
 * The Student-t CDF/quantile are built on a regularized incomplete beta
 * function (Numerical Recipes continued fraction) and a Lanczos log-gamma,
 * matching scipy to well within 1e-6 over the ranges these pipelines use.
 */

// --- log-gamma (Lanczos g=7, n=9) -----------------------------------------

const LANCZOS_G = 7;
const LANCZOS_COEF = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** Natural log of the gamma function. */
export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula for x < 0.5.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = LANCZOS_COEF[0];
  const t = z + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    a += LANCZOS_COEF[i] / (z + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

// --- regularized incomplete beta ------------------------------------------

const BETACF_MAXIT = 300;
const BETACF_EPS = 3e-14;
const BETACF_FPMIN = 1e-300;

/** Continued-fraction evaluation for the incomplete beta (Numerical Recipes). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= BETACF_MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < BETACF_FPMIN) c = BETACF_FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < BETACF_FPMIN) d = BETACF_FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < BETACF_FPMIN) c = BETACF_FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < BETACF_EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lbeta);
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

// --- Student-t distribution ------------------------------------------------

/**
 * Student-t cumulative distribution function P(T <= t) for `df` degrees of
 * freedom. Matches scipy.stats.t.cdf.
 */
export function studentTCdf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  if (df <= 0) return Number.NaN;
  const x = df / (df + t * t);
  const half = 0.5 * regularizedIncompleteBeta(x, df / 2, 0.5);
  return t > 0 ? 1 - half : half;
}

/** Student-t survival function P(T > t). Matches scipy.stats.t.sf. */
export function studentTSf(t: number, df: number): number {
  return 1 - studentTCdf(t, df);
}

/**
 * Student-t quantile (inverse CDF / percent-point function) for probability
 * `p` and `df` degrees of freedom. Matches scipy.stats.t.ppf.
 *
 * Solved by monotone bisection on the CDF, which is robust across all df >= 1
 * and accurate to ~1e-12, comfortably inside the 1e-6 parity budget.
 */
export function studentTQuantile(p: number, df: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  if (df <= 0) return Number.NaN;

  const upper = p > 0.5;
  const target = upper ? p : 1 - p; // solve on the non-negative side, t >= 0

  let lo = 0;
  let hi = 1;
  while (studentTCdf(hi, df) < target && hi < 1e12) {
    hi *= 2;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const t = (lo + hi) / 2;
  return upper ? t : -t;
}

// --- ordinary least squares (scipy.stats.linregress) -----------------------

export interface LinregressResult {
  /** Best-fit slope. */
  readonly slope: number;
  /** Best-fit intercept. */
  readonly intercept: number;
  /** Pearson correlation coefficient r (clamped to [-1, 1]). */
  readonly rValue: number;
  /** Coefficient of determination r^2. */
  readonly rSquared: number;
  /** Two-sided p-value for the null hypothesis that the slope is zero. */
  readonly pValue: number;
  /** Standard error of the estimated slope. */
  readonly stderr: number;
  /** Number of points. */
  readonly n: number;
}

const LINREGRESS_TINY = 1e-20;

/**
 * Ordinary-least-squares linear regression over (x, y), reproducing
 * scipy.stats.linregress including its two-sided p-value and its r/p-value
 * handling for degenerate (zero-variance) series.
 */
export function linregress(x: readonly number[], y: readonly number[]): LinregressResult {
  const n = x.length;
  if (n !== y.length) {
    throw new Error(`linregress: x and y length mismatch (${n} vs ${y.length})`);
  }
  if (n < 2) {
    throw new Error('linregress: need at least two points');
  }

  let xMean = 0;
  let yMean = 0;
  for (let i = 0; i < n; i++) {
    xMean += x[i];
    yMean += y[i];
  }
  xMean /= n;
  yMean /= n;

  // Population (bias=1) second moments, matching numpy.cov(..., bias=1).
  let ssxm = 0; // var(x)
  let ssym = 0; // var(y)
  let ssxym = 0; // cov(x, y)
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    ssxm += dx * dx;
    ssym += dy * dy;
    ssxym += dx * dy;
  }
  ssxm /= n;
  ssym /= n;
  ssxym /= n;

  const slope = ssxm === 0 ? Number.NaN : ssxym / ssxm;
  const intercept = yMean - slope * xMean;

  const rDen = Math.sqrt(ssxm * ssym);
  let r: number;
  if (rDen === 0) {
    r = 0;
  } else {
    r = ssxym / rDen;
    if (r > 1) r = 1;
    else if (r < -1) r = -1;
  }

  let pValue: number;
  let stderr: number;
  if (n === 2) {
    pValue = 1.0;
    stderr = 0.0;
  } else {
    const df = n - 2;
    const t = r * Math.sqrt(df / ((1 - r + LINREGRESS_TINY) * (1 + r + LINREGRESS_TINY)));
    pValue = 2 * studentTCdf(-Math.abs(t), df);
    stderr = Math.sqrt(((1 - r * r) * ssym) / ssxm / df);
  }

  return { slope, intercept, rValue: r, rSquared: r * r, pValue, stderr, n };
}
