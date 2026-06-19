/**
 * Wrap an async function so that concurrent callers all receive the same
 * in-flight Promise rather than launching duplicate requests.
 * Once the Promise settles the slot is cleared so subsequent calls
 * start a fresh request.
 */
export function createSingleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (!inFlight) {
      inFlight = fn().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
