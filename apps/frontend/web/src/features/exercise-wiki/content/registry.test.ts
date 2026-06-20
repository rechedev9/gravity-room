import { describe, expect, it } from 'bun:test';
import { ExerciseArticleSchema } from '@gzclp/domain/schemas/exercise-article';
import { EXERCISE_ARTICLES, getArticleBySlug } from './registry';

describe('EXERCISE_ARTICLES', () => {
  it('every article passes the schema', () => {
    for (const a of EXERCISE_ARTICLES) {
      const r = ExerciseArticleSchema.safeParse(a);
      expect(r.success, `${a.exerciseId}: ${r.success ? '' : r.error?.message}`).toBe(true);
    }
  });
  it('slugs are unique per language', () => {
    for (const lang of ['es', 'en'] as const) {
      const slugs = EXERCISE_ARTICLES.map((a) => a.slug[lang]);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });
  it('evidence refIndices stay within references bounds', () => {
    for (const a of EXERCISE_ARTICLES) {
      for (const lang of ['es', 'en'] as const) {
        for (const ev of a.content[lang].evidence) {
          ev.refIndices.forEach((i) => expect(i).toBeLessThan(a.references.length));
        }
      }
    }
  });
  it('looks up by localized slug', () => {
    const first = EXERCISE_ARTICLES[0];
    expect(getArticleBySlug('es', first.slug.es)?.exerciseId).toBe(first.exerciseId);
    expect(getArticleBySlug('en', 'does-not-exist')).toBeUndefined();
  });
});
