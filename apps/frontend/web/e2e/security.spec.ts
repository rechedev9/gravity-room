import { expect, test } from '@playwright/test';
import { createAndAuthUser, createTestProgram } from './helpers/api';

const BASE_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3001';

test.describe('security hardening', () => {
  test('API responses include strict baseline security headers', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/health`);
    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['content-security-policy']).toContain("script-src-attr 'none'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain('upgrade-insecure-requests');
  });

  test('authenticated API responses are marked no-store while public catalog stays cacheable', async ({
    page,
  }) => {
    const { accessToken } = await createAndAuthUser(page);
    await createTestProgram(page, accessToken);

    const privateRes = await page.request.get(`${BASE_URL}/api/programs`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(privateRes.status()).toBe(200);
    expect(privateRes.headers()['cache-control']).toBe('no-store');

    const publicRes = await page.request.get(`${BASE_URL}/api/catalog`);
    expect(publicRes.status()).toBe(200);
    expect(publicRes.headers()['cache-control']).toContain('public');
  });

  test('concurrent refresh requests can only rotate a refresh token once', async ({ page }) => {
    await createAndAuthUser(page);
    const cookies = await page.context().cookies(`${BASE_URL}/api/auth/refresh`);
    const refreshCookie = cookies.find((cookie) => cookie.name === 'refresh_token');
    expect(refreshCookie).toBeDefined();

    const cookieHeader = `refresh_token=${refreshCookie?.value ?? ''}`;
    const [first, second] = await Promise.all([
      page.request.post(`${BASE_URL}/api/auth/refresh`, {
        headers: { Cookie: cookieHeader },
      }),
      page.request.post(`${BASE_URL}/api/auth/refresh`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    expect([first.status(), second.status()].sort()).toEqual([200, 401]);
  });

  test('recording a result rejects workout slots outside the program definition', async ({
    page,
  }) => {
    const { accessToken } = await createAndAuthUser(page);
    const programId = await createTestProgram(page, accessToken);

    const badSlot = await page.request.post(`${BASE_URL}/api/programs/${programId}/results`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        workoutIndex: 0,
        slotId: 'not-a-real-slot',
        result: 'success',
      },
    });
    expect(badSlot.status()).toBe(400);
    await expect(badSlot.json()).resolves.toMatchObject({ code: 'INVALID_DATA' });

    const badWorkout = await page.request.post(`${BASE_URL}/api/programs/${programId}/results`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        workoutIndex: 9999,
        slotId: 'd1-t1',
        result: 'success',
      },
    });
    expect(badWorkout.status()).toBe(400);
    await expect(badWorkout.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
