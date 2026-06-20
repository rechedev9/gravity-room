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

/**
 * SEO-optimised, keyword-led title for a program page (e.g. "GZCLP Linear
 * Progression…"). Returns undefined when no SEO override exists so the caller
 * falls back to the themed program name.
 */
export function localizedProgramSeoTitle(t: TFunction, id: string): string | undefined {
  const value = t(`catalog.programs.${id}.seoTitle`, { defaultValue: '' });
  return value !== '' ? value : undefined;
}

/**
 * SEO-optimised, factual meta description for a program page. Returns undefined
 * when no SEO override exists so the caller falls back to the themed
 * description.
 */
export function localizedProgramSeoDescription(t: TFunction, id: string): string | undefined {
  const value = t(`catalog.programs.${id}.seoDescription`, { defaultValue: '' });
  return value !== '' ? value : undefined;
}

export interface ProgramFaqEntry {
  readonly question: string;
  readonly answer: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFaqEntry(value: unknown): value is ProgramFaqEntry {
  return isRecord(value) && typeof value.question === 'string' && typeof value.answer === 'string';
}

/**
 * Per-program FAQ entries (localized). Feeds both the visible FAQ section and
 * the FAQPage JSON-LD on the program page — single source so the rendered text
 * matches the structured data (Google policy requirement). Returns [] when none.
 */
export function localizedProgramFaq(t: TFunction, id: string): readonly ProgramFaqEntry[] {
  const raw: unknown = t(`catalog.programs.${id}.faq`, { returnObjects: true, defaultValue: [] });
  return Array.isArray(raw) ? raw.filter(isFaqEntry) : [];
}
