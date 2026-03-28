// http-contract.md §8 — Auth response shapes
// Verified against routes/auth.ts userResponse() which returns {id, email, name, avatarUrl}
import { z } from 'zod/v4';

export const UserResponseSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  })
  .strict();

export const AuthResponseSchema = z
  .object({
    user: UserResponseSchema,
    accessToken: z.string(),
  })
  .strict();

export const RefreshResponseSchema = z
  .object({
    accessToken: z.string(),
  })
  .strict();
