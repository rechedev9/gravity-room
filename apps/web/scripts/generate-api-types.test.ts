import { describe, expect, it } from 'bun:test';
import { buildGeneratedArtifact } from './generate-api-types-lib';
import { resolve } from 'path';

describe('buildGeneratedArtifact', () => {
  it('preserves endpoint contracts while stripping runtime client code and aliases', () => {
    const raw = `import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core';
import { z } from 'zod';

const patchApiAuthMe_Body = z.object({ avatarUrl: z.string().nullable() }).partial().readonly();
const mobileAuthUser = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  })
  .passthrough()
  .readonly();

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
    path: '/api/auth/mobile/google',
    alias: 'postApiAuthMobileGoogle',
    requestFormat: 'json',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({ credential: z.string().min(1) }).readonly(),
      },
    ],
    response: z
      .object({
        user: mobileAuthUser,
        accessToken: z.string(),
        refreshToken: z.string(),
      })
      .passthrough()
      .readonly(),
    errors: [
      {
        status: 401,
        schema: z.void(),
      },
    ],
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
    response: z
      .object({
        accessToken: z.string(),
        refreshToken: z.string(),
        user: mobileAuthUser,
      })
      .passthrough()
      .readonly(),
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
    expect(result).toContain('const mobileAuthUser');
    expect(result).toContain('export const endpoints = [');
    expect(result).toContain("path: '/api/auth/mobile/google'");
    expect(result).toContain('user: mobileAuthUser');
    expect(result).toContain('accessToken: z.string()');
    expect(result).toContain('refreshToken: z.string()');
    expect(result).toContain("path: '/api/auth/mobile/refresh'");
    expect(result).toContain('schema: z.object({ refreshToken: z.string() }).partial().readonly()');
    expect(result).toContain('response: z');
    expect(result).toContain('errors: [');
    expect(result).not.toContain('@zodios/core');
    expect(result).not.toContain('makeApi([');
    expect(result).not.toContain('new Zodios');
    expect(result).not.toContain('createApiClient');
    expect(result).not.toContain('alias:');
    expect(result).not.toContain('getApiMuscle-groups');
  });

  it('generated artifact preserves mobile auth response contracts', async () => {
    const generatedPath = resolve(import.meta.dir, '../src/lib/api/generated.ts');
    const generated = await Bun.file(generatedPath).text();

    const mobileGoogleStart = generated.indexOf("path: '/api/auth/mobile/google'");
    const mobileRefreshStart = generated.indexOf("path: '/api/auth/mobile/refresh'");
    const mobileSignoutStart = generated.indexOf("path: '/api/auth/mobile/signout'");

    const mobileGoogleSection = generated.slice(mobileGoogleStart, mobileRefreshStart);
    const mobileRefreshSection = generated.slice(mobileRefreshStart, mobileSignoutStart);
    const mobileSignoutSection = generated.slice(mobileSignoutStart);

    expect(mobileGoogleStart).toBeGreaterThanOrEqual(0);
    expect(mobileRefreshStart).toBeGreaterThanOrEqual(0);
    expect(mobileSignoutStart).toBeGreaterThanOrEqual(0);

    expect(mobileGoogleSection).toContain('response: z');
    expect(mobileGoogleSection).toContain('user: z');
    expect(mobileGoogleSection).toContain('id: z.string()');
    expect(mobileGoogleSection).toContain('email: z.string().email()');
    expect(mobileGoogleSection).toContain('name: z.union([z.string(), z.null()]).nullable()');
    expect(mobileGoogleSection).toContain('avatarUrl: z.union([z.string(), z.null()]).nullable()');
    expect(mobileGoogleSection).toContain('accessToken: z.string()');
    expect(mobileGoogleSection).toContain('refreshToken: z.string()');

    expect(mobileRefreshSection).toContain('response: z');
    expect(mobileRefreshSection).toContain('accessToken: z.string()');
    expect(mobileRefreshSection).toContain('refreshToken: z.string()');
    expect(mobileRefreshSection).toContain('user: z');
    expect(mobileRefreshSection).toContain('id: z.string()');
    expect(mobileRefreshSection).toContain('email: z.string().email()');
    expect(mobileRefreshSection).toContain('name: z.union([z.string(), z.null()]).nullable()');
    expect(mobileRefreshSection).toContain('avatarUrl: z.union([z.string(), z.null()]).nullable()');

    expect(mobileSignoutSection).toContain('response: z.void()');
  });
});
