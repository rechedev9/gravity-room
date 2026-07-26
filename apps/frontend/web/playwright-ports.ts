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
