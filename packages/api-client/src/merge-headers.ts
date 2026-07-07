/**
 * Merge extra headers into a base headers object.
 * Accepts all three forms of HeadersInit: Headers instance, array of tuples, or plain object.
 *
 * HTTP header names are case-insensitive, so every key is normalized to
 * lowercase: an extra 'content-type' overrides a base 'Content-Type' instead
 * of producing two case-variant keys with an undefined winner.
 */
export function mergeHeaders(
  base: Record<string, string>,
  extra: HeadersInit | undefined
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    merged[key.toLowerCase()] = value;
  }
  if (!extra) return merged;
  if (extra instanceof Headers) {
    extra.forEach((value, key) => {
      merged[key.toLowerCase()] = value;
    });
    return merged;
  }
  if (Array.isArray(extra)) {
    for (const [key, value] of extra) {
      merged[key.toLowerCase()] = value;
    }
    return merged;
  }
  for (const [key, value] of Object.entries(extra)) {
    merged[key.toLowerCase()] = value;
  }
  return merged;
}
