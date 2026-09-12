import { buildApiRequestUrl, resolveApiBaseUrl } from './api-url';

describe('API base configuration policy', () => {
  it.each([undefined, '', '  '])('uses local development fallback for %j', (configured) => {
    expect(resolveApiBaseUrl(configured, true)).toBe('http://localhost:3001');
    expect(() => resolveApiBaseUrl(configured, false)).toThrow('required');
  });

  it.each(['localhost', '127.0.0.1', '[::1]', '10.0.2.2'])(
    'permits cleartext development host %s',
    (host) => {
      expect(resolveApiBaseUrl(`http://${host}:3001`, true)).toBe(`http://${host}:3001`);
      expect(() => resolveApiBaseUrl(`http://${host}:3001`, false)).toThrow('https');
    }
  );

  it.each(['localhost.example.test', '192.168.1.5', 'api.example.test'])(
    'rejects unapproved cleartext development host %s',
    (host) => {
      expect(() => resolveApiBaseUrl(`http://${host}`, true)).toThrow('local development hosts');
    }
  );

  it.each([true, false])(
    'accepts HTTPS and trims surrounding configuration in development=%s',
    (development) => {
      expect(resolveApiBaseUrl(' https://example.test/gateway/api/ ', development)).toBe(
        'https://example.test/gateway/api/'
      );
    }
  );

  it.each([
    'https://user:password@example.test',
    'https://example.test?token=secret',
    'https://example.test#fragment',
  ])('rejects credentials, query or fragment in %s', (configured) => {
    for (const development of [false, true])
      expect(() => resolveApiBaseUrl(configured, development)).toThrow(
        'credentials, query, or fragment'
      );
  });

  it.each(['relative/path', '/api', 'not a url'])(
    'rejects nonabsolute configuration %j',
    (configured) => {
      expect(() => resolveApiBaseUrl(configured, false)).toThrow('valid absolute URL');
    }
  );
});

describe('pure API URL composition', () => {
  it.each([
    ['https://example.test', '/api/programs'],
    ['https://example.test/', '/api/programs'],
    ['https://example.test/gateway', '/gateway/programs'],
    ['https://example.test/gateway/', '/gateway/programs'],
    ['https://example.test/gateway/api', '/gateway/api/programs'],
  ])('uses the configured route prefix of %s', (configured, pathname) => {
    expect(buildApiRequestUrl('/programs', configured, false)).toBe(
      `https://example.test${pathname}`
    );
  });

  it('normalizes a leading route slash without losing queries or encoded IDs', () => {
    const path = 'programs/a%2Fb?cursor=a%2Bb&filter=one&filter=two';
    expect(buildApiRequestUrl(path, 'https://example.test', false)).toBe(
      `https://example.test/api/${path}`
    );
    expect(buildApiRequestUrl(`/${path}`, 'https://example.test', false)).toBe(
      `https://example.test/api/${path}`
    );
  });

  it('keeps the configured origin even for network-path-shaped input', () => {
    const result = new URL(
      buildApiRequestUrl('//other.test/programs?x=1', 'https://example.test:8443/gateway', false)
    );
    expect(result.origin).toBe('https://example.test:8443');
    expect(result.pathname).toBe('/gateway/programs');
    expect(result.search).toBe('?x=1');
  });

  it('does not copy route fragments into requests', () => {
    expect(buildApiRequestUrl('/programs?x=1#local', 'https://example.test', false)).toBe(
      'https://example.test/api/programs?x=1'
    );
  });

  it('does not retain configuration between calls', () => {
    expect(buildApiRequestUrl('/programs', undefined, true)).toBe(
      'http://localhost:3001/api/programs'
    );
    expect(buildApiRequestUrl('/programs', 'https://example.test/v2', false)).toBe(
      'https://example.test/v2/programs'
    );
    expect(() => buildApiRequestUrl('/programs', undefined, false)).toThrow('required');
  });

  it('preserves encoded Unicode and query delimiters through URL normalization', () => {
    const path = '/catalog/sentadilla%20%F0%9F%8F%8B%EF%B8%8F?cursor=%23%3F%26';
    expect(buildApiRequestUrl(path, 'https://example.test', false)).toBe(
      `https://example.test/api${path}`
    );
  });
});
