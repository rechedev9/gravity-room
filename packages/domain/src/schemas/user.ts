/**
 * User payload parsing — deliberately dependency-free.
 *
 * `UserInfo` is a four-field shape validated on the SPA's critical path
 * (auth-context restores the session before the first paint). Expressing it as
 * a Zod schema pulled the whole Zod runtime (~20 KB gz) into the entry chunk of
 * every page, including the public landing where nobody is signed in. The
 * shape is small and stable enough that a hand-written guard is both cheaper
 * and just as strict, so the parser lives here — still the single source of
 * truth — without the runtime dependency.
 */

export interface UserInfo {
  readonly id: string;
  readonly email: string;
  readonly name?: string;
  readonly avatarUrl?: string;
}

/**
 * Accepts a nullable/optional string field, mirroring the previous
 * `z.string().nullable().optional()` + `?? undefined` transform: `null` and a
 * missing key both normalise to `undefined`, anything else must be a string.
 */
function readOptionalString(
  source: Record<string, unknown>,
  key: string
): { readonly ok: true; readonly value: string | undefined } | { readonly ok: false } {
  const raw = source[key];
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw === 'string') return { ok: true, value: raw };
  return { ok: false };
}

/** Parses an unknown payload into `UserInfo`, or `null` when it does not match. */
export function parseUserSafe(data: unknown): UserInfo | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const source = data as Record<string, unknown>;

  const { id, email } = source;
  if (typeof id !== 'string' || typeof email !== 'string') return null;

  const name = readOptionalString(source, 'name');
  if (!name.ok) return null;
  const avatarUrl = readOptionalString(source, 'avatarUrl');
  if (!avatarUrl.ok) return null;

  return {
    id,
    email,
    ...(name.value !== undefined ? { name: name.value } : {}),
    ...(avatarUrl.value !== undefined ? { avatarUrl: avatarUrl.value } : {}),
  };
}

/** Strict variant: throws when the payload is not a valid user. */
export function parseUser(data: unknown): UserInfo {
  const parsed = parseUserSafe(data);
  if (parsed === null) throw new TypeError('Invalid user payload');
  return parsed;
}
