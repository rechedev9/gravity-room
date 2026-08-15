const DEFAULT_API_PORT = '3001';
const DEFAULT_WEB_PORT = '5173';

function readPort(value: string | undefined, fallback: string, name: string): string {
  const port = value ?? fallback;
  const parsed = Number(port);

  if (!/^\d{1,5}$/.test(port) || !Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return port;
}

export interface PlaywrightEndpoints {
  apiPort: string;
  apiUrl: string;
  webPort: string;
  webUrl: string;
}

export function resolvePlaywrightEndpoints(
  env: Readonly<Record<string, string | undefined>>
): PlaywrightEndpoints {
  const apiPort = readPort(env['E2E_API_PORT'], DEFAULT_API_PORT, 'E2E_API_PORT');
  const webPort = readPort(env['E2E_WEB_PORT'], DEFAULT_WEB_PORT, 'E2E_WEB_PORT');

  if (apiPort === webPort) {
    throw new Error('E2E_API_PORT and E2E_WEB_PORT must be different');
  }

  return {
    apiPort,
    apiUrl: `http://localhost:${apiPort}`,
    webPort,
    webUrl: `http://localhost:${webPort}`,
  };
}

export function resolvePlaywrightApiUrl(env: Readonly<Record<string, string | undefined>>): string {
  return env['E2E_API_URL'] ?? resolvePlaywrightEndpoints(env).apiUrl;
}

/** Dedicated database for the e2e stack — never the developer's dev database. */
export const E2E_DATABASE_NAME = 'gravity_room_e2e';

/** docker-compose credentials; the only sane guess when nothing else is known. */
const DOCKER_COMPOSE_URL = `postgres://postgres:password@localhost:5432/${E2E_DATABASE_NAME}`;

/** Repoint a postgres connection URL at another database, preserving credentials and options. */
export function withDatabaseName(url: string, database: string): string | null {
  try {
    const parsed = new URL(url);
    parsed.pathname = `/${database}`;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Read DATABASE_URL out of a dotenv file's raw contents. */
export function readDatabaseUrl(envFileContents: string | undefined): string | undefined {
  if (envFileContents === undefined) return undefined;
  for (const line of envFileContents.split(/\r?\n/)) {
    const match = /^\s*DATABASE_URL\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    const value = match[1].trim().replace(/^["']|["']$/g, '');
    if (value !== '') return value;
  }
  return undefined;
}

/**
 * Connection string the e2e stack runs against, in precedence order:
 *
 * 1. An explicit `DATABASE_URL` — CI sets it, and it stays the local escape hatch.
 * 2. The API's own `DATABASE_URL` repointed at {@link E2E_DATABASE_NAME}, so a cold
 *    local run reuses real credentials without ever touching the developer's data.
 * 3. The docker-compose default.
 *
 * The previous hardcoded fallback guessed both the credentials and the database, so
 * on any machine not running docker-compose it silently connected to nothing (or to
 * a stale schema) and every auth-dependent test failed with an opaque 500.
 */
export function resolveE2eDatabaseUrl(options: {
  readonly envUrl?: string | undefined;
  readonly apiEnvUrl?: string | undefined;
}): string {
  const explicit = options.envUrl?.trim();
  if (explicit !== undefined && explicit !== '') return explicit;

  const derived =
    options.apiEnvUrl !== undefined ? withDatabaseName(options.apiEnvUrl, E2E_DATABASE_NAME) : null;

  return derived ?? DOCKER_COMPOSE_URL;
}
