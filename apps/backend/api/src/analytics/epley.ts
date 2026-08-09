/**
 * Epley estimated-1RM used by analytics pipelines (not `@gzclp/domain`'s
 * `computeEpley1RM`). Differs on purpose for golden parity:
 *   - reps === 1 returns `weight` exactly (domain uses `weight * (1 + 1/30)`);
 *   - no `weight <= 0 || reps <= 0` → 0 guard (domain has it).
 * Pipelines must use THIS function so `user_insights` stays consistent with
 * `__fixtures__/golden.json`.
 */

/** Epley formula: `weight` for a single rep, else `weight * (1 + reps / 30)`. */
export function epley(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
