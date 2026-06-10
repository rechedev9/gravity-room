/**
 * Merge extra headers into a base headers object.
 * Accepts all three forms of HeadersInit: Headers instance, array of tuples, or plain object.
 */
export function mergeHeaders(
  base: Record<string, string>,
  extra: HeadersInit | undefined
): Record<string, string> {
  if (!extra) return base;
  if (extra instanceof Headers) {
    const merged = { ...base };
    extra.forEach((value, key) => {
      merged[key] = value;
    });
    return merged;
  }
  if (Array.isArray(extra)) {
    const merged = { ...base };
    for (const [key, value] of extra) {
      merged[key] = value;
    }
    return merged;
  }
  return { ...base, ...extra };
}
