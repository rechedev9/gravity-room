import { z } from 'zod/v4';

export const UserResponseSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
  })
  .transform((data) => ({
    id: data.id,
    email: data.email,
    name: data.name ?? undefined,
    avatarUrl: data.avatarUrl ?? undefined,
  }));

export type UserInfo = z.infer<typeof UserResponseSchema>;

export function parseUserSafe(data: unknown): UserInfo | null {
  const result = UserResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}
