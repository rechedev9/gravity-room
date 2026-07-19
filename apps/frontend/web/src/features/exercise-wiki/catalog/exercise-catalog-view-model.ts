/**
 * Pure, React-free derivations for the exercise catalog browser. Kept isolated
 * from network + rendering so the filter/label/pagination logic is unit-testable.
 */
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import type { ExerciseEntry } from '@/lib/api-functions';
import { getArticleByExerciseId } from '../content/registry';

// ---------------------------------------------------------------------------
// Filter option value sets
// ---------------------------------------------------------------------------
//
// These mirror the distinct values seeded in the `exercises` table. They are a
// small, stable enum-like set, so we localize each value through i18next
// (`exerciseCatalog.attributes.*`) rather than surfacing the raw DB string.
// Ordered for sensible presentation (e.g. training level low → high).

export const EQUIPMENT_VALUES = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'kettlebells',
  'bands',
  'body only',
  'bodyweight',
  'e-z curl bar',
  'exercise ball',
  'medicine ball',
  'other',
] as const;

export const LEVEL_VALUES = ['beginner', 'intermediate', 'expert'] as const;

export const CATEGORY_VALUES = [
  'strength',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
] as const;

/** Number of catalog rows fetched per page. The API caps `limit` at 1000. */
export const CATALOG_PAGE_SIZE = 20;

/**
 * Convert a raw attribute value into a stable i18next key segment.
 * e.g. "body only" → "body_only", "e-z curl bar" → "e_z_curl_bar".
 */
export function attributeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ---------------------------------------------------------------------------
// Guide linking
// ---------------------------------------------------------------------------

/**
 * When a catalog exercise is documented by one of the curated guides (the three
 * guides map to catalog ids `squat`, `bench`, `deadlift`), returns the guide's
 * localized slug so the row can deep-link to the in-app article. Undefined
 * otherwise.
 */
export function guideSlugForExercise(
  exercise: ExerciseEntry,
  lang: ArticleLang
): string | undefined {
  const article = getArticleByExerciseId(exercise.id);
  return article?.slug[lang];
}

/** Distinct, order-preserving secondary muscle ids for an exercise. */
export function uniqueSecondaryMuscles(exercise: ExerciseEntry): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of exercise.secondaryMuscles ?? []) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface CatalogPageInfo {
  /** 1-indexed position of the first item on the current page (0 when empty). */
  readonly from: number;
  /** 1-indexed position of the last item on the current page (0 when empty). */
  readonly to: number;
  readonly total: number;
  /** 1-indexed current page (1 when empty). */
  readonly page: number;
  /** Total number of pages (0 when empty). */
  readonly pageCount: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
}

/**
 * Derive display-ready pagination state from the API's paginated envelope.
 * `limit` must be a positive integer; `offset`/`total` are clamped to be safe.
 */
export function computePageInfo(total: number, offset: number, limit: number): CatalogPageInfo {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const safeTotal = Math.max(0, Math.trunc(total));
  const safeOffset = Math.max(0, Math.trunc(offset));

  if (safeTotal === 0) {
    return { from: 0, to: 0, total: 0, page: 1, pageCount: 0, hasPrev: false, hasNext: false };
  }

  const from = safeOffset + 1;
  const to = Math.min(safeOffset + safeLimit, safeTotal);
  const page = Math.floor(safeOffset / safeLimit) + 1;
  const pageCount = Math.ceil(safeTotal / safeLimit);

  return {
    from,
    to,
    total: safeTotal,
    page,
    pageCount,
    hasPrev: safeOffset > 0,
    hasNext: safeOffset + safeLimit < safeTotal,
  };
}
