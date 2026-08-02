export const MAX_JWT_KID_CHARS = 256;

/**
 * Small process-local cache for signing-key ids that were absent after a JWKS
 * refresh. Expired entries are removed lazily and the oldest live entry is
 * evicted at capacity so attacker-controlled kids cannot grow memory forever.
 */
export class NegativeKidCache {
  private readonly entries = new Map<string, number>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error('maxEntries must be a positive integer');
    }
  }

  has(key: string): boolean {
    this.pruneExpired();
    return (this.entries.get(key) ?? 0) > this.now();
  }

  add(key: string): void {
    this.pruneExpired();
    // Refresh insertion order when an existing key is observed again.
    this.entries.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    this.entries.set(key, this.now() + this.ttlMs);
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(key);
    }
  }
}
