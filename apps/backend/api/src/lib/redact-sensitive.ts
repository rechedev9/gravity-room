/** Redact common bearer credentials while preserving enough context to diagnose failures. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]+)@/gi, '$1[Redacted]:[Redacted]@')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [Redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[Redacted JWT]')
    .replace(/([?&](?:token|password|secret|api_key|apikey)=)[^&#\s]+/gi, '$1[Redacted]');
}

export function sanitizedError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const sanitized = new Error(redactSensitiveText(error.message));
  sanitized.name = error.name;
  if (error.stack) sanitized.stack = redactSensitiveText(error.stack);
  return sanitized;
}
