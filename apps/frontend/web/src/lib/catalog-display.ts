import type { TFunction } from 'i18next';

/** Resolves a catalog program's display name to the current UI language. */
export function localizedProgramName(t: TFunction, id: string, fallback: string): string {
  return t(`catalog.programs.${id}.name`, { defaultValue: fallback });
}

/** Resolves a catalog program's description to the current UI language. */
export function localizedProgramDescription(t: TFunction, id: string, fallback: string): string {
  return t(`catalog.programs.${id}.description`, { defaultValue: fallback });
}

/** Resolves a category enum to its translated label. Falls back to the raw key. */
export function localizedCategoryLabel(t: TFunction, category: string): string {
  return t(`catalog.category.${category}`, { defaultValue: category });
}
