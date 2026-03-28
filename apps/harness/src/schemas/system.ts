// http-contract.md §8 — System response shapes
// Verified against create-app.ts /health handler
// db and redis are objects (not strings): {status, latencyMs?} or {status, error?}
import { z } from 'zod/v4';

const DbStatusOk = z.object({ status: z.literal('ok'), latencyMs: z.number() }).strict();
const DbStatusError = z.object({ status: z.literal('error'), error: z.string() }).strict();
const DbStatusSchema = z.union([DbStatusOk, DbStatusError]);

const RedisStatusOk = z.object({ status: z.literal('ok'), latencyMs: z.number() }).strict();
const RedisStatusDisabled = z.object({ status: z.literal('disabled') }).strict();
const RedisStatusError = z.object({ status: z.literal('error'), error: z.string() }).strict();
const RedisStatusSchema = z.union([RedisStatusOk, RedisStatusDisabled, RedisStatusError]);

export const HealthResponseSchema = z
  .object({
    status: z.string(),
    timestamp: z.string(),
    uptime: z.number(),
    db: DbStatusSchema,
    redis: RedisStatusSchema,
  })
  .strict();

// Verified against routes/stats.ts — returns {count: number | null}
export const StatsOnlineResponseSchema = z
  .object({
    count: z.number().nullable(),
  })
  .strict();
