/** Preserve the recorded pause duration when the wall clock moves behind its anchor. */
export function rebaseRetryDeadline(retryAt: number, recordedAt: number, now: number): number {
  return now < recordedAt ? now + Math.max(0, retryAt - recordedAt) : retryAt;
}

/**
 * Process-local deadline state. The caller owns its account scope and reset or
 * expiry decision; this controller owns no clock, timer, credentials or I/O.
 */
export class RetryPause {
  constructor(
    private retryAt: number,
    private recordedAt: number
  ) {}

  readDeadline(now: number): number {
    if (now < this.recordedAt) {
      this.retryAt = rebaseRetryDeadline(this.retryAt, this.recordedAt, now);
      this.recordedAt = now;
    }
    return this.retryAt;
  }
}
