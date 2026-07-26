import { describe, expect, it } from 'vitest';
import { resolvePlaywrightApiUrl, resolvePlaywrightEndpoints } from '../../playwright-ports';

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
