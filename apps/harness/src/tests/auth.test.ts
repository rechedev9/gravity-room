import { describe, it, expect, beforeAll } from 'bun:test';
import { seedUser, type SeededUser } from '../helpers/seed';
import { AuthResponseSchema, UserResponseSchema, RefreshResponseSchema } from '../schemas/auth';
import { expectKeys, expectErrorShape, expectEmpty204 } from '../helpers/assertions';

describe('auth', () => {
  let user: SeededUser;

  beforeAll(async () => {
    user = await seedUser();
  });

  describe('POST /api/auth/dev', () => {
    it('returns valid AuthResponse shape', async () => {
      const fresh = await seedUser();
      // Re-call with the same email to get a fresh response we can inspect
      const res = await fresh.client.post('/api/auth/dev', { email: fresh.email });
      expect(res.status).toBe(201);
      const body = await res.json();
      const result = AuthResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('user has strict UserResponse shape', async () => {
      const fresh = await seedUser();
      const res = await fresh.client.post('/api/auth/dev', { email: fresh.email });
      const body = (await res.json()) as { user: Record<string, unknown> };
      const result = UserResponseSchema.safeParse(body.user);
      expect(result.success).toBe(true);
    });

    it('user.name and user.avatarUrl are null for fresh user', async () => {
      const fresh = await seedUser();
      const res = await fresh.client.post('/api/auth/dev', { email: fresh.email });
      const body = (await res.json()) as { user: { name: unknown; avatarUrl: unknown } };
      expect(body.user.name).toBeNull();
      expect(body.user.avatarUrl).toBeNull();
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns valid UserResponse shape', async () => {
      const res = await user.client.get('/api/auth/me', { accessToken: user.accessToken });
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = UserResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('has exact key set', async () => {
      const res = await user.client.get('/api/auth/me', { accessToken: user.accessToken });
      const body = await res.json();
      expectKeys(body, ['avatarUrl', 'email', 'id', 'name']);
    });

    it('name and avatarUrl are present with null value', async () => {
      const res = await user.client.get('/api/auth/me', { accessToken: user.accessToken });
      const body = (await res.json()) as Record<string, unknown>;
      expect('name' in body).toBe(true);
      expect(body['name']).toBeNull();
      expect('avatarUrl' in body).toBe(true);
      expect(body['avatarUrl']).toBeNull();
    });
  });

  describe('GET /api/auth/me — unauthenticated', () => {
    it('returns 401 with exact error shape', async () => {
      const res = await user.client.get('/api/auth/me');
      expect(res.status).toBe(401);
      const body = await res.json();
      expectErrorShape(body);
      expectKeys(body, ['code', 'error']);
      expect((body as { code: string }).code).toBe('UNAUTHORIZED');
    });
  });

  describe('refresh_token cookie attributes', () => {
    it('has correct path, httpOnly, and sameSite', () => {
      const cookie = user.client.jar.getCookie('refresh_token');
      expect(cookie).toBeDefined();
      expect(cookie!.path).toBe('/api/auth');
      expect(cookie!.httpOnly).toBe(true);
      expect(cookie!.sameSite.toLowerCase()).toBe('strict');
    });
  });

  describe('POST /api/auth/signout', () => {
    it('returns 204 empty body', async () => {
      // Use a dedicated user to avoid invalidating shared state
      const signoutUser = await seedUser();
      const res = await signoutUser.client.post('/api/auth/signout', undefined, {
        accessToken: signoutUser.accessToken,
      });
      await expectEmpty204(res);
    });

    it('sets maxAge=0 on refresh_token cookie', async () => {
      const signoutUser = await seedUser();
      await signoutUser.client.post('/api/auth/signout', undefined, {
        accessToken: signoutUser.accessToken,
      });
      const cookie = signoutUser.client.jar.getCookie('refresh_token');
      expect(cookie).toBeDefined();
      expect(cookie!.maxAge).toBe(0);
    });
  });

  describe('DELETE /api/auth/me', () => {
    it('returns 204 empty body', async () => {
      const deleteUser = await seedUser();
      const res = await deleteUser.client.delete('/api/auth/me', {
        accessToken: deleteUser.accessToken,
      });
      await expectEmpty204(res);
    });

    it('clears the refresh_token cookie', async () => {
      const deleteUser = await seedUser();
      await deleteUser.client.delete('/api/auth/me', {
        accessToken: deleteUser.accessToken,
      });
      const cookie = deleteUser.client.jar.getCookie('refresh_token');
      expect(cookie).toBeDefined();
      expect(cookie!.maxAge).toBe(0);
    });

    it('returns 401 after deletion when fetching /api/auth/me with the old token', async () => {
      const deleteUser = await seedUser();
      const delRes = await deleteUser.client.delete('/api/auth/me', {
        accessToken: deleteUser.accessToken,
      });
      await expectEmpty204(delRes);

      const meRes = await deleteUser.client.get('/api/auth/me', {
        accessToken: deleteUser.accessToken,
      });
      expect(meRes.status).toBe(404);
      const body = await meRes.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('USER_NOT_FOUND');
    });
  });

  describe('PATCH /api/auth/me', () => {
    it('updates name and returns valid UserResponse', async () => {
      const patchUser = await seedUser();
      const res = await patchUser.client.patch(
        '/api/auth/me',
        { name: 'Updated Name' },
        { accessToken: patchUser.accessToken }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = UserResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      expect((body as { name: string }).name).toBe('Updated Name');
    });

    it('clears avatar when avatarUrl is null', async () => {
      const patchUser = await seedUser();
      const res = await patchUser.client.patch(
        '/api/auth/me',
        { avatarUrl: null },
        { accessToken: patchUser.accessToken }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { avatarUrl: unknown };
      expect(body.avatarUrl).toBeNull();
    });

    it('rejects invalid avatar format', async () => {
      const patchUser = await seedUser();
      const res = await patchUser.client.patch(
        '/api/auth/me',
        { avatarUrl: 'not-a-data-url' },
        { accessToken: patchUser.accessToken }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('INVALID_AVATAR');
    });

    it('rejects oversized avatar', async () => {
      const patchUser = await seedUser();
      // Build a valid data URL that exceeds 200KB
      const bigBase64 = Buffer.from(new Uint8Array(200_000)).toString('base64');
      const res = await patchUser.client.patch(
        '/api/auth/me',
        { avatarUrl: `data:image/png;base64,${bigBase64}` },
        { accessToken: patchUser.accessToken }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expectErrorShape(body);
      expect((body as { code: string }).code).toBe('AVATAR_TOO_LARGE');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new accessToken via cookie jar replay', async () => {
      const refreshUser = await seedUser();
      // Cookie jar already has the refresh_token from seedUser()
      const res = await refreshUser.client.post('/api/auth/refresh');
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = RefreshResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
      expect((body as { accessToken: string }).accessToken).toBeTruthy();
    });
  });
});
