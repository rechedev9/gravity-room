/**
 * Type-safe singleflight map — coalesces concurrent calls for the same key
 * into a single execution. Prevents cache stampede / thundering herd.
 *
 * When multiple callers request the same key concurrently, only the first
 * starts the actual work. All subsequent callers receive the same promise.
 * Once the promise settles, the key is removed so the next call starts fresh.
 *
 * Create one instance per return type to maintain type safety without assertions.
 */
export class SingleflightMap<T> {
  private readonly flights = new Map<string, Promise<T>>();

  /**
   * Execute `fn` at most once per `key` concurrently.
   * If a call for the same key is already in flight, returns the existing promise.
   */
  run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.flights.get(key);
    if (existing) return existing;

    const promise = fn().finally(() => {
      this.flights.delete(key);
    });

    this.flights.set(key, promise);
    return promise;
  }
}
