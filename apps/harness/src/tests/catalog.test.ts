import { describe, it, expect } from 'bun:test';
import { createClient } from '../helpers/client';
import { CatalogListResponseSchema, CatalogDetailResponseSchema } from '../schemas/catalog';

describe('catalog', () => {
  const client = createClient();

  describe('GET /api/catalog', () => {
    it('returns valid CatalogList shape', async () => {
      const res = await client.get('/api/catalog');
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = CatalogListResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('has exact Cache-Control header', async () => {
      const res = await client.get('/api/catalog');
      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBe('public, max-age=300, stale-while-revalidate=60');
    });

    it('contains at least one catalog entry', async () => {
      const res = await client.get('/api/catalog');
      const body = (await res.json()) as unknown[];
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/catalog/gzclp', () => {
    it('returns valid CatalogDetail shape', async () => {
      const res = await client.get('/api/catalog/gzclp');
      expect(res.status).toBe(200);
      const body = await res.json();
      const result = CatalogDetailResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('has Cache-Control header', async () => {
      const res = await client.get('/api/catalog/gzclp');
      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toBe('public, max-age=300');
    });
  });
});
