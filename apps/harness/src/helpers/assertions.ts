import { expect } from 'bun:test';
import { ErrorResponseSchema } from '../schemas/error';

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function expectISODate(value: string): void {
  expect(value).toMatch(ISO_DATE_REGEX);
}

export function expectUUID(value: string): void {
  expect(value).toMatch(UUID_V4_REGEX);
}

export function expectKeys(obj: unknown, keys: string[]): void {
  expect(Object.keys(obj as Record<string, unknown>).sort()).toEqual(keys);
}

export function expectCursor(cursor: string): void {
  const lastUnderscore = cursor.lastIndexOf('_');
  expect(lastUnderscore).toBeGreaterThan(0);
  const datePart = cursor.slice(0, lastUnderscore);
  const uuidPart = cursor.slice(lastUnderscore + 1);
  expectISODate(datePart);
  expectUUID(uuidPart);
}

export function expectErrorShape(body: unknown): void {
  const result = ErrorResponseSchema.safeParse(body);
  expect(result.success).toBe(true);
  expectKeys(body, ['code', 'error']);
}

export async function expectEmpty204(response: Response): Promise<void> {
  expect(response.status).toBe(204);
  const text = await response.text();
  expect(text).toBe('');
}
