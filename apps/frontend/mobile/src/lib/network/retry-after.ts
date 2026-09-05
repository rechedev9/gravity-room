/** HTTP Retry-After supports nonnegative seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number {
  if (!value?.trim()) return 0;
  const text = value.trim();
  const epoch = /^\d+$/.test(text) ? now + Number(text) * 1000 : Date.parse(text);
  return Number.isSafeInteger(epoch) && epoch >= now ? epoch : 0;
}
