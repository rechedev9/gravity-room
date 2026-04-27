/** Default starting weights matching the setup form defaults. */
export const DEFAULT_WEIGHTS = {
  squat: 60,
  bench: 40,
  deadlift: 60,
  ohp: 30,
  latpulldown: 30,
  dbrow: 12.5,
};

/**
 * Build a results map with `n` consecutive successful workouts.
 * Each workout has t1, t2, and t3 marked as 'success'.
 */
export function buildSuccessResults(n: number): Record<string, Record<string, string>> {
  const results: Record<string, Record<string, string>> = {};
  for (let i = 0; i < n; i++) {
    results[String(i)] = { t1: 'success', t2: 'success', t3: 'success' };
  }
  return results;
}
