/**
 * Server-side HaveIBeenPwned k-anonymity check.
 * Only the first 5 chars of the SHA-1 hash are sent — the full password never
 * leaves this server. On network failure, returns false to avoid blocking
 * signup due to a third-party outage.
 */

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

async function sha1Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-1', encoded);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Returns true if the password appears in known breach databases. */
export async function checkLeakedPassword(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) return false;

    const text = await response.text();
    return text.split('\n').some((line) => {
      const [hashSuffix] = line.split(':');
      return hashSuffix?.trim() === suffix;
    });
  } catch {
    // Network error — don't block signup due to third-party outage
    return false;
  }
}
