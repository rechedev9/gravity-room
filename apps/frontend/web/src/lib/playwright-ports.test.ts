import { describe, expect, it } from 'vitest';
import {
  E2E_DATABASE_NAME,
  readDatabaseUrl,
  resolveE2eDatabaseUrl,
  resolvePlaywrightApiUrl,
  resolvePlaywrightEndpoints,
  withDatabaseName,
} from '../../playwright-ports';

describe('resolvePlaywrightEndpoints', () => {
  it('preserves the conventional local ports by default', () => {
    expect(resolvePlaywrightEndpoints({})).toEqual({
      apiPort: '3001',
      apiUrl: 'http://localhost:3001',
      webPort: '5173',
      webUrl: 'http://localhost:5173',
    });
  });

  it('allows an isolated gateway pair for concurrent QA runs', () => {
    expect(
      resolvePlaywrightEndpoints({
        E2E_API_PORT: '3112',
        E2E_WEB_PORT: '5212',
      })
    ).toEqual({
      apiPort: '3112',
      apiUrl: 'http://localhost:3112',
      webPort: '5212',
      webUrl: 'http://localhost:5212',
    });
  });

  it.each(['0', '65536', 'abc', '5173 && echo unsafe'])(
    'rejects invalid or unsafe port values (%s)',
    (value) => {
      expect(() => resolvePlaywrightEndpoints({ E2E_WEB_PORT: value })).toThrow(
        'E2E_WEB_PORT must be an integer between 1 and 65535'
      );
    }
  );

  it('rejects a gateway pair that would bind both servers to the same port', () => {
    expect(() =>
      resolvePlaywrightEndpoints({
        E2E_API_PORT: '3112',
        E2E_WEB_PORT: '3112',
      })
    ).toThrow('E2E_API_PORT and E2E_WEB_PORT must be different');
  });

  it('derives API helper requests from the isolated API port', () => {
    expect(resolvePlaywrightApiUrl({ E2E_API_PORT: '3112' })).toBe('http://localhost:3112');
  });

  it('preserves an explicitly configured external API URL', () => {
    expect(resolvePlaywrightApiUrl({ E2E_API_URL: 'https://qa-api.example.test' })).toBe(
      'https://qa-api.example.test'
    );
  });
});

describe('e2e database resolution', () => {
  const API_ENV_URL = 'postgresql://dev:s3cr3t@localhost:5432/gravity_room';

  it.each([
    {
      name: 'honours an explicit DATABASE_URL verbatim (CI and manual overrides)',
      envUrl: 'postgres://ci:ci@db:5432/anything',
      apiEnvUrl: API_ENV_URL,
      expected: 'postgres://ci:ci@db:5432/anything',
    },
    {
      name: "reuses the API's credentials against the dedicated e2e database",
      envUrl: undefined,
      apiEnvUrl: API_ENV_URL,
      expected: `postgresql://dev:s3cr3t@localhost:5432/${E2E_DATABASE_NAME}`,
    },
    {
      name: 'ignores a blank DATABASE_URL instead of connecting to nothing',
      envUrl: '   ',
      apiEnvUrl: API_ENV_URL,
      expected: `postgresql://dev:s3cr3t@localhost:5432/${E2E_DATABASE_NAME}`,
    },
    {
      name: 'falls back to docker-compose when no API env file exists',
      envUrl: undefined,
      apiEnvUrl: undefined,
      expected: `postgres://postgres:password@localhost:5432/${E2E_DATABASE_NAME}`,
    },
    {
      name: 'falls back to docker-compose when the API url is unparseable',
      envUrl: undefined,
      apiEnvUrl: 'not-a-url',
      expected: `postgres://postgres:password@localhost:5432/${E2E_DATABASE_NAME}`,
    },
  ])('$name', ({ envUrl, apiEnvUrl, expected }) => {
    expect(resolveE2eDatabaseUrl({ envUrl, apiEnvUrl })).toBe(expected);
  });

  it('never resolves to the developer database unless asked explicitly', () => {
    const resolved = resolveE2eDatabaseUrl({ envUrl: undefined, apiEnvUrl: API_ENV_URL });
    expect(resolved).not.toContain('/gravity_room?');
    expect(resolved.endsWith('/gravity_room')).toBe(false);
    expect(resolved).toContain(E2E_DATABASE_NAME);
  });

  it('preserves connection options when repointing the database', () => {
    expect(withDatabaseName('postgresql://u:p@host:5432/dev?sslmode=require', 'e2e')).toBe(
      'postgresql://u:p@host:5432/e2e?sslmode=require'
    );
  });

  it.each([
    {
      name: 'plain assignment',
      contents: 'DATABASE_URL=postgres://a/b',
      expected: 'postgres://a/b',
    },
    {
      name: 'quoted value',
      contents: 'FOO=1\nDATABASE_URL="postgres://a/b"\n',
      expected: 'postgres://a/b',
    },
    { name: 'missing key', contents: 'FOO=1', expected: undefined },
    { name: 'empty value', contents: 'DATABASE_URL=', expected: undefined },
    { name: 'absent file', contents: undefined, expected: undefined },
  ])('reads DATABASE_URL from a dotenv file: $name', ({ contents, expected }) => {
    expect(readDatabaseUrl(contents)).toBe(expected);
  });
});
