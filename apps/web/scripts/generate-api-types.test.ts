import { describe, expect, it } from 'bun:test';
import { buildGeneratedArtifact } from './generate-api-types-lib';

describe('buildGeneratedArtifact', () => {
  it('preserves endpoint contracts while stripping runtime client code and aliases', () => {
    const raw = `import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core';
import { z } from 'zod';

const patchApiAuthMe_Body = z.object({ avatarUrl: z.string().nullable() }).partial().readonly();

const endpoints = makeApi([
  {
    method: 'get',
    path: '/api/muscle-groups',
    alias: 'getApiMuscle-groups',
    requestFormat: 'json',
    response: z.void(),
  },
  {
    method: 'post',
    path: '/api/auth/mobile/refresh',
    alias: 'postApiAuthMobileRefresh',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ refreshToken: z.string() }).partial().readonly(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 401,
        schema: z.void(),
      },
    ],
  },
]);

export const api = new Zodios(endpoints);
export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
`;

    const result = buildGeneratedArtifact(raw);

    expect(result).toContain("import { z } from 'zod/v4';");
    expect(result).toContain('const patchApiAuthMe_Body');
    expect(result).toContain('export const endpoints = [');
    expect(result).toContain("path: '/api/auth/mobile/refresh'");
    expect(result).toContain('schema: z.object({ refreshToken: z.string() }).partial().readonly()');
    expect(result).toContain('errors: [');
    expect(result).not.toContain('@zodios/core');
    expect(result).not.toContain('makeApi([');
    expect(result).not.toContain('new Zodios');
    expect(result).not.toContain('createApiClient');
    expect(result).not.toContain('alias:');
    expect(result).not.toContain('getApiMuscle-groups');
  });
});
