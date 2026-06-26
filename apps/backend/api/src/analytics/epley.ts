/**
 * Epley estimated-1RM formula, ported verbatim from the Python analytics
 * service (apps/backend/analytics/insights/e1rm.py:epley).
 *
 * NOTE: @gzclp/domain already exports `computeEpley1RM`, but its semantics
 * differ from the analytics formula in two ways that matter for parity:
 *   - domain returns `weight * (1 + 1/30)` for reps === 1, whereas the
 *     analytics service special-cases a single rep to return `weight` exactly;
 *   - domain guards `weight <= 0 || reps <= 0` and returns 0.
 * To preserve byte-for-byte parity with the Python outputs that seed the
 * `user_insights` table, the analytics pipelines must use THIS function, not
 * the domain helper.
 */

/** Epley formula: `weight` for a single rep, else `weight * (1 + reps / 30)`. */
export function epley(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
