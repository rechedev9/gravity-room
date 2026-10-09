import type { TFunction } from 'i18next';

export type ExerciseAttribute =
  | 'muscle'
  | 'equipment'
  | 'level'
  | 'mechanic'
  | 'force'
  | 'category';

/** Catalog values arrive as raw API strings ("body only"); fold them into catalog keys. */
export function attributeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Known values translate; anything new from the API shows as sent instead of a missing key. */
export function attributeLabel(
  t: TFunction,
  attribute: ExerciseAttribute,
  value: string,
  apiName?: string
): string {
  return t(`exercises.${attribute}.${attributeKey(value)}`, { defaultValue: apiName ?? value });
}
