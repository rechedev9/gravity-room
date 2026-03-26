export interface Cookie {
  readonly name: string;
  readonly value: string;
  readonly path: string;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: string;
  readonly maxAge: number | null;
}

export class CookieJar {
  private store = new Map<string, Cookie>();

  captureFromResponse(_url: URL, response: Response): void {
    const setCookies = response.headers.getSetCookie();
    for (const raw of setCookies) {
      const cookie = parseCookie(raw);
      if (cookie) {
        this.store.set(cookie.name, cookie);
      }
    }
  }

  getCookieHeader(url: URL): string {
    const parts: string[] = [];
    for (const cookie of this.store.values()) {
      if (cookie.maxAge === 0) continue;
      if (url.pathname.startsWith(cookie.path)) {
        parts.push(`${cookie.name}=${cookie.value}`);
      }
    }
    return parts.join('; ');
  }

  getCookie(name: string): Cookie | undefined {
    return this.store.get(name);
  }

  clear(): void {
    this.store.clear();
  }
}

function parseCookie(raw: string): Cookie | null {
  const segments = raw.split(';').map((s) => s.trim());
  const first = segments[0];
  if (!first) return null;

  const eqIdx = first.indexOf('=');
  if (eqIdx === -1) return null;

  const name = first.slice(0, eqIdx).trim();
  const value = first.slice(eqIdx + 1).trim();

  let path = '/';
  let httpOnly = false;
  let secure = false;
  let sameSite = '';
  let maxAge: number | null = null;

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]!;
    const lower = seg.toLowerCase();

    if (lower === 'httponly') {
      httpOnly = true;
      continue;
    }
    if (lower === 'secure') {
      secure = true;
      continue;
    }

    const attrEq = seg.indexOf('=');
    if (attrEq === -1) continue;

    const attrName = seg.slice(0, attrEq).trim().toLowerCase();
    const attrValue = seg.slice(attrEq + 1).trim();

    switch (attrName) {
      case 'path':
        path = attrValue;
        break;
      case 'samesite':
        sameSite = attrValue;
        break;
      case 'max-age': {
        const parsed = parseInt(attrValue, 10);
        if (!Number.isNaN(parsed)) {
          maxAge = parsed;
        }
        break;
      }
    }
  }

  return { name, value, path, httpOnly, secure, sameSite, maxAge };
}
