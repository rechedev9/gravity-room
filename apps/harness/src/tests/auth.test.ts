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
