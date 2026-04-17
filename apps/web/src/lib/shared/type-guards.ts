/**
 * Type guard for validating unknown values are plain objects.
 * Replaces unsafe `as Record<string, unknown>` casts throughout the codebase.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
