# Exercise Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship phase 1 of a science-backed, bilingual exercise wiki — the platform (routes, typed content schema, template, JSON-LD, prerender + sitemap integration, filterable index) plus 3 fully-researched flagship articles (squat, bench, deadlift) in es + en.

**Architecture:** Pure client-side Vite SPA rendered + serialized by the existing build-time Playwright prerender. Wiki content lives as typed TypeScript data modules validated by a Zod schema in `@gzclp/domain`; one presentational template renders every article. No backend, no SSR, no new build toolchain. SEO via the existing `useHead()` hook + a new `ExerciseJsonLd` component; the prerender picks up new URLs straight from `sitemap.xml`.

**Tech Stack:** React 19, TanStack Router v1 (code-based tree), Zod 4, Tailwind 4, Bun test + happy-dom, Playwright (existing prerender + e2e).

## Global Constraints

- **Content format:** typed TS data modules only — no MDX, no new build dependency.
- **Schema home:** `@gzclp/domain` — exported via the package `exports` map; web consumes it through `@gzclp/domain/schemas/exercise-article`.
- **Bilingual:** every article carries both `es` and `en` content; ES routes under `/ejercicios/...`, EN routes under `/en/exercises/...`, mirroring the existing landing `/` vs `/en` split (separate route components with a `lang` prop, NOT i18next resource files).
- **Canonical origin:** `https://gravityroom.app` (no trailing slash on article paths).
- **Citation integrity (non-negotiable):** every `reference` must carry a real, resolvable `doi` OR `pmid`. The `scripts/verify-citations.ts` gate must pass before any article ships. No unresolvable citation is allowed.
- **Human review gate:** an article is publishable only with `reviewedBy` + `reviewedAt` set. Unreviewed articles must not be added to the registry or sitemap.
- **Index lists only curated articles** that have a real page — never the full exercise DB.
- **Flagship exercise IDs (exist in the seed):** `squat` (legs), `bench` (chest), `deadlift` (back).
- **Lint/format:** `eslint --max-warnings=0`; commit via `committer "<conventional message>" <paths...>`.

---

### Task 1: Exercise-article Zod schema in `@gzclp/domain`

**Files:**

- Create: `packages/domain/src/schemas/exercise-article.ts`
- Modify: `packages/domain/package.json` (add export entry)
- Test: `packages/domain/src/schemas/exercise-article.test.ts`

**Interfaces:**

- Produces: `ExerciseArticleSchema` (Zod), `ExerciseReferenceSchema`, `LocalizedArticleSchema`, and types `ExerciseArticle`, `ExerciseReference`, `LocalizedArticle`, `ArticleLang = 'es' | 'en'`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/domain/src/schemas/exercise-article.test.ts
import { describe, expect, it } from 'bun:test';
import { ExerciseArticleSchema, ExerciseReferenceSchema } from './exercise-article';

const validRef = {
  doi: '10.1519/JSC.0000000000002255',
  title: 'A study',
  authors: 'Doe J, Roe R',
  year: 2018,
  url: 'https://doi.org/10.1519/JSC.0000000000002255',
};

const validArticle = {
  exerciseId: 'squat',
  slug: { es: 'sentadilla', en: 'squat' },
  muscleGroupId: 'legs',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['quadriceps', 'glutes'],
  secondaryMuscles: ['hamstrings'],
  references: [validRef],
  content: {
    es: {
      title: 'Sentadilla',
      description: 'Guía de la sentadilla.',
      summary: ['Resumen.'],
      technique: ['Paso 1.'],
      evidence: [{ claim: 'Activa el cuádriceps.', refIndices: [0] }],
      commonMistakes: ['Rodillas hacia dentro.'],
    },
    en: {
      title: 'Squat',
      description: 'Squat guide.',
      summary: ['Summary.'],
      technique: ['Step 1.'],
      evidence: [{ claim: 'Activates the quadriceps.', refIndices: [0] }],
      commonMistakes: ['Knees caving in.'],
    },
  },
  reviewedBy: 'Luis',
  reviewedAt: '2026-06-20',
};

describe('ExerciseReferenceSchema', () => {
  it('accepts a reference with a doi', () => {
    expect(ExerciseReferenceSchema.safeParse(validRef).success).toBe(true);
  });
  it('rejects a reference with neither doi nor pmid', () => {
    const { doi, ...noId } = validRef;
    expect(ExerciseReferenceSchema.safeParse(noId).success).toBe(false);
  });
});

describe('ExerciseArticleSchema', () => {
  it('accepts a complete bilingual article', () => {
    expect(ExerciseArticleSchema.safeParse(validArticle).success).toBe(true);
  });
  it('rejects an article missing references', () => {
    expect(ExerciseArticleSchema.safeParse({ ...validArticle, references: [] }).success).toBe(
      false
    );
  });
  it('rejects an article missing the en content', () => {
    const { en, ...esOnly } = validArticle.content;
    expect(ExerciseArticleSchema.safeParse({ ...validArticle, content: esOnly }).success).toBe(
      false
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/domain && bun test src/schemas/exercise-article.test.ts`
Expected: FAIL — `Cannot find module './exercise-article'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/domain/src/schemas/exercise-article.ts
import { z } from 'zod';

export const ExerciseReferenceSchema = z
  .object({
    doi: z.string().min(1).optional(),
    pmid: z.string().regex(/^\d+$/).optional(),
    title: z.string().min(1),
    authors: z.string().min(1),
    year: z.number().int().min(1900).max(2100),
    url: z.string().url(),
  })
  .refine((r) => r.doi !== undefined || r.pmid !== undefined, {
    message: 'reference must include a doi or pmid',
  });

export const LocalizedArticleSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(200),
  summary: z.array(z.string().min(1)).min(1),
  technique: z.array(z.string().min(1)).min(1),
  evidence: z
    .array(
      z.object({
        claim: z.string().min(1),
        refIndices: z.array(z.number().int().min(0)).min(1),
      })
    )
    .min(1),
  commonMistakes: z.array(z.string().min(1)).min(1),
});

export const ExerciseArticleSchema = z.object({
  exerciseId: z.string().min(1),
  slug: z.object({ es: z.string().min(1), en: z.string().min(1) }),
  muscleGroupId: z.string().min(1),
  equipment: z.string().min(1).nullable(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  primaryMuscles: z.array(z.string().min(1)).min(1),
  secondaryMuscles: z.array(z.string().min(1)),
  references: z.array(ExerciseReferenceSchema).min(1),
  content: z.object({ es: LocalizedArticleSchema, en: LocalizedArticleSchema }),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ExerciseReference = z.infer<typeof ExerciseReferenceSchema>;
export type LocalizedArticle = z.infer<typeof LocalizedArticleSchema>;
export type ExerciseArticle = z.infer<typeof ExerciseArticleSchema>;
export type ArticleLang = 'es' | 'en';
```

- [ ] **Step 4: Add the package export**

In `packages/domain/package.json`, inside `"exports"`, add after the `"./schemas/catalog"` line:

```json
    "./schemas/exercise-article": "./src/schemas/exercise-article.ts",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/domain && bun test src/schemas/exercise-article.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck + commit**

Run: `cd packages/domain && bun run typecheck`
Expected: no errors.

```bash
committer "feat(domain): add exercise-article content schema" \
  packages/domain/src/schemas/exercise-article.ts \
  packages/domain/src/schemas/exercise-article.test.ts \
  packages/domain/package.json
```

---

### Task 2: Content registry + slug lookup

**Files:**

- Create: `apps/frontend/web/src/features/exercise-wiki/content/registry.ts`
- Create: `apps/frontend/web/src/features/exercise-wiki/content/_placeholder.ts` (temporary fixture, deleted in Task 8)
- Test: `apps/frontend/web/src/features/exercise-wiki/content/registry.test.ts`

**Interfaces:**

- Consumes: `ExerciseArticle`, `ArticleLang` from `@gzclp/domain/schemas/exercise-article`.
- Produces: `EXERCISE_ARTICLES: readonly ExerciseArticle[]`, `getArticleBySlug(lang, slug): ExerciseArticle | undefined`, `getAllArticles(): readonly ExerciseArticle[]`.

- [ ] **Step 1: Write the failing test**

```ts
// registry.test.ts
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
          for (const i of ev.refIndices) expect(i).toBeLessThan(a.references.length);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/content/registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write a temporary placeholder article + the registry**

```ts
// content/_placeholder.ts  (temporary — replaced by real content in Tasks 8-10)
import type { ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

export const placeholderArticle: ExerciseArticle = {
  exerciseId: 'squat',
  slug: { es: 'sentadilla', en: 'squat' },
  muscleGroupId: 'legs',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['quadriceps', 'glutes'],
  secondaryMuscles: ['hamstrings', 'erector spinae'],
  references: [
    {
      doi: '10.1519/JSC.0000000000002255',
      title: 'Placeholder reference — replace before publish',
      authors: 'TBD',
      year: 2018,
      url: 'https://doi.org/10.1519/JSC.0000000000002255',
    },
  ],
  content: {
    es: {
      title: 'Sentadilla',
      description: 'Placeholder.',
      summary: ['Placeholder.'],
      technique: ['Placeholder.'],
      evidence: [{ claim: 'Placeholder.', refIndices: [0] }],
      commonMistakes: ['Placeholder.'],
    },
    en: {
      title: 'Squat',
      description: 'Placeholder.',
      summary: ['Placeholder.'],
      technique: ['Placeholder.'],
      evidence: [{ claim: 'Placeholder.', refIndices: [0] }],
      commonMistakes: ['Placeholder.'],
    },
  },
  reviewedBy: 'PLACEHOLDER',
  reviewedAt: '2026-06-20',
};
```

```ts
// content/registry.ts
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { placeholderArticle } from './_placeholder';

export const EXERCISE_ARTICLES: readonly ExerciseArticle[] = [placeholderArticle];

export function getAllArticles(): readonly ExerciseArticle[] {
  return EXERCISE_ARTICLES;
}

export function getArticleBySlug(lang: ArticleLang, slug: string): ExerciseArticle | undefined {
  return EXERCISE_ARTICLES.find((a) => a.slug[lang] === slug);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/content/registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
committer "feat(web): add exercise-wiki content registry" \
  apps/frontend/web/src/features/exercise-wiki/content/registry.ts \
  apps/frontend/web/src/features/exercise-wiki/content/_placeholder.ts \
  apps/frontend/web/src/features/exercise-wiki/content/registry.test.ts
```

---

### Task 3: `ExerciseJsonLd` component (schema.org Article + citations)

**Files:**

- Create: `apps/frontend/web/src/features/exercise-wiki/exercise-json-ld.tsx`
- Test: `apps/frontend/web/src/features/exercise-wiki/exercise-json-ld.test.tsx`

**Interfaces:**

- Consumes: `ExerciseArticle`, `ArticleLang`.
- Produces: `ExerciseJsonLd({ article, lang }): ReactNode` — a `<script type="application/ld+json">` carrying an `Article` with `citation[]` and a `BreadcrumbList`.

- [ ] **Step 1: Write the failing test**

```tsx
// exercise-json-ld.test.tsx
import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExerciseJsonLd } from './exercise-json-ld';
import { placeholderArticle } from './content/_placeholder';

function parseLd(markup: string): any {
  const m = markup.match(/<script type="application\/ld\+json">(.*)<\/script>/s);
  if (!m) throw new Error('no ld+json script');
  return JSON.parse(m[1].replace(/\\u003c/g, '<'));
}

describe('ExerciseJsonLd', () => {
  it('emits an Article whose citation count matches references', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={placeholderArticle} lang="es" />);
    const ld = parseLd(html);
    expect(ld['@type']).toBe('Article');
    expect(Array.isArray(ld.citation)).toBe(true);
    expect(ld.citation).toHaveLength(placeholderArticle.references.length);
  });
  it('uses the localized canonical url', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={placeholderArticle} lang="en" />);
    const ld = parseLd(html);
    expect(ld.url).toBe('https://gravityroom.app/en/exercises/squat');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/exercise-json-ld.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// exercise-json-ld.tsx
import type { ReactNode } from 'react';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

const ORIGIN = 'https://gravityroom.app';

export function articleUrl(article: ExerciseArticle, lang: ArticleLang): string {
  return lang === 'es'
    ? `${ORIGIN}/ejercicios/${article.slug.es}`
    : `${ORIGIN}/en/exercises/${article.slug.en}`;
}

export function ExerciseJsonLd({
  article,
  lang,
}: {
  readonly article: ExerciseArticle;
  readonly lang: ArticleLang;
}): ReactNode {
  const c = article.content[lang];
  const url = articleUrl(article, lang);
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.title,
    description: c.description,
    url,
    inLanguage: lang,
    citation: article.references.map((r) => ({
      '@type': 'CreativeWork',
      name: r.title,
      author: r.authors,
      datePublished: String(r.year),
      url: r.url,
      ...(r.doi !== undefined ? { sameAs: `https://doi.org/${r.doi}` } : {}),
    })),
    isPartOf: {
      '@type': 'WebSite',
      name: 'Gravity Room',
      url: ORIGIN,
    },
  };
  const jsonLdText = JSON.stringify(payload).replace(/</g, '\\u003c');
  return <script type="application/ld+json">{jsonLdText}</script>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/exercise-json-ld.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
committer "feat(web): add ExerciseJsonLd structured-data component" \
  apps/frontend/web/src/features/exercise-wiki/exercise-json-ld.tsx \
  apps/frontend/web/src/features/exercise-wiki/exercise-json-ld.test.tsx
```

---

### Task 4: `useExerciseHead` hook (title/meta/canonical + hreflang alternates)

**Files:**

- Create: `apps/frontend/web/src/features/exercise-wiki/use-exercise-head.ts`
- Test: `apps/frontend/web/src/features/exercise-wiki/use-exercise-head.test.ts`

**Interfaces:**

- Consumes: `useHead` from `@/hooks/use-head`; `ExerciseArticle`, `ArticleLang`; `articleUrl` from `./exercise-json-ld`.
- Produces: `useExerciseHead(article, lang): void` — sets title/description/canonical/OG via `useHead`, and injects `<link rel="alternate" hreflang="es|en|x-default">` for the es/en variants, cleaning them up on unmount.

- [ ] **Step 1: Write the failing test**

```ts
// use-exercise-head.test.ts
import { describe, expect, it } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useExerciseHead } from './use-exercise-head';
import { placeholderArticle } from './content/_placeholder';

describe('useExerciseHead', () => {
  it('sets the localized title and canonical', () => {
    renderHook(() => useExerciseHead(placeholderArticle, 'es'));
    expect(document.title).toContain('Sentadilla');
    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://gravityroom.app/ejercicios/sentadilla');
  });
  it('injects es + en + x-default hreflang alternates', () => {
    renderHook(() => useExerciseHead(placeholderArticle, 'en'));
    const langs = Array.from(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).map(
      (l) => l.getAttribute('hreflang')
    );
    expect(langs).toContain('es');
    expect(langs).toContain('en');
    expect(langs).toContain('x-default');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/use-exercise-head.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// use-exercise-head.ts
import { useEffect } from 'react';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { useHead } from '@/hooks/use-head';
import { articleUrl } from './exercise-json-ld';

function addAlternate(hreflang: string, href: string): () => void {
  const el = document.createElement('link');
  el.rel = 'alternate';
  el.setAttribute('hreflang', hreflang);
  el.setAttribute('href', href);
  document.head.appendChild(el);
  return () => el.remove();
}

export function useExerciseHead(article: ExerciseArticle, lang: ArticleLang): void {
  const c = article.content[lang];
  const url = articleUrl(article, lang);
  useHead({
    title: `${c.title} — Gravity Room`,
    description: c.description,
    canonical: url,
    ogTitle: `${c.title} — Gravity Room`,
    ogDescription: c.description,
    ogUrl: url,
    ogLocale: lang === 'es' ? 'es_ES' : 'en_US',
    lang,
  });
  useEffect(() => {
    const esUrl = articleUrl(article, 'es');
    const enUrl = articleUrl(article, 'en');
    const cleanups = [
      addAlternate('es', esUrl),
      addAlternate('en', enUrl),
      addAlternate('x-default', enUrl),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, [article]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/use-exercise-head.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
committer "feat(web): add useExerciseHead SEO hook" \
  apps/frontend/web/src/features/exercise-wiki/use-exercise-head.ts \
  apps/frontend/web/src/features/exercise-wiki/use-exercise-head.test.ts
```

---

### Task 5: `ExerciseArticleView` presentational template

**Files:**

- Create: `apps/frontend/web/src/features/exercise-wiki/exercise-article-view.tsx`
- Test: `apps/frontend/web/src/features/exercise-wiki/exercise-article-view.test.tsx`

**Interfaces:**

- Consumes: `ExerciseArticle`, `ArticleLang`.
- Produces: `ExerciseArticleView({ article, lang }): ReactNode` — renders `<h1>`, summary, technique, evidence (claim + numbered citation markers), common mistakes, and a references list with links.

- [ ] **Step 1: Write the failing test**

```tsx
// exercise-article-view.test.tsx
import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ExerciseArticleView } from './exercise-article-view';
import { placeholderArticle } from './content/_placeholder';

describe('ExerciseArticleView', () => {
  it('renders the localized title as h1', () => {
    render(<ExerciseArticleView article={placeholderArticle} lang="en" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Squat');
  });
  it('renders one references list item per reference', () => {
    render(<ExerciseArticleView article={placeholderArticle} lang="es" />);
    const refs = screen.getByTestId('exercise-references');
    expect(refs.querySelectorAll('li')).toHaveLength(placeholderArticle.references.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/exercise-article-view.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// exercise-article-view.tsx
import type { ReactNode } from 'react';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

const LABELS = {
  es: {
    summary: 'Resumen',
    technique: 'Técnica',
    evidence: 'Evidencia',
    mistakes: 'Errores comunes',
    references: 'Referencias',
  },
  en: {
    summary: 'Summary',
    technique: 'Technique',
    evidence: 'Evidence',
    mistakes: 'Common mistakes',
    references: 'References',
  },
} as const;

export function ExerciseArticleView({
  article,
  lang,
}: {
  readonly article: ExerciseArticle;
  readonly lang: ArticleLang;
}): ReactNode {
  const c = article.content[lang];
  const l = LABELS[lang];
  return (
    <article className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-title">{c.title}</h1>
        <p className="text-muted">{c.description}</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.summary}</h2>
        {c.summary.map((p, i) => (
          <p key={i} className="text-main">
            {p}
          </p>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.technique}</h2>
        <ol className="list-decimal pl-5 space-y-1 text-main">
          {c.technique.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.evidence}</h2>
        <ul className="space-y-1 text-main">
          {c.evidence.map((e, i) => (
            <li key={i}>
              {e.claim}{' '}
              {e.refIndices.map((r) => (
                <sup key={r}>
                  <a href={`#ref-${r}`} className="text-accent">
                    [{r + 1}]
                  </a>
                </sup>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.mistakes}</h2>
        <ul className="list-disc pl-5 space-y-1 text-main">
          {c.commonMistakes.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.references}</h2>
        <ol
          data-testid="exercise-references"
          className="list-decimal pl-5 space-y-1 text-sm text-muted"
        >
          {article.references.map((r, i) => (
            <li key={i} id={`ref-${i}`}>
              {r.authors} ({r.year}).{' '}
              <a href={r.url} target="_blank" rel="noreferrer" className="text-accent">
                {r.title}
              </a>
              {r.doi !== undefined
                ? ` doi:${r.doi}`
                : r.pmid !== undefined
                  ? ` PMID:${r.pmid}`
                  : ''}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/exercise-article-view.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
committer "feat(web): add ExerciseArticleView template" \
  apps/frontend/web/src/features/exercise-wiki/exercise-article-view.tsx \
  apps/frontend/web/src/features/exercise-wiki/exercise-article-view.test.tsx
```

---

### Task 6: Article + index page components

**Files:**

- Create: `apps/frontend/web/src/features/exercise-wiki/exercise-article-page.tsx`
- Create: `apps/frontend/web/src/features/exercise-wiki/exercise-wiki-index-page.tsx`
- Test: `apps/frontend/web/src/features/exercise-wiki/exercise-wiki-index-page.test.tsx`

**Interfaces:**

- Consumes: registry lookups, `ExerciseArticleView`, `ExerciseJsonLd`, `useExerciseHead`, `useParams`/`Link`/`notFound` from `@tanstack/react-router`.
- Produces: `ExerciseArticlePage({ lang })`, `ExerciseWikiIndexPage({ lang })`.

- [ ] **Step 1: Write the failing test (index page)**

```tsx
// exercise-wiki-index-page.test.tsx
import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router';
import { ExerciseWikiIndexPage } from './exercise-wiki-index-page';
import { EXERCISE_ARTICLES } from './content/registry';

function renderAt() {
  const root = createRootRoute();
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <ExerciseWikiIndexPage lang="es" />,
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router} />);
}

describe('ExerciseWikiIndexPage', () => {
  it('renders a link per curated article', async () => {
    renderAt();
    const links = await screen.findAllByTestId('exercise-card');
    expect(links).toHaveLength(EXERCISE_ARTICLES.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/exercise-wiki-index-page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementations**

```tsx
// exercise-article-page.tsx
import type { ReactNode } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import { getArticleBySlug } from './content/registry';
import { ExerciseArticleView } from './exercise-article-view';
import { ExerciseJsonLd } from './exercise-json-ld';
import { useExerciseHead } from './use-exercise-head';

function ArticleHead({
  article,
  lang,
}: {
  readonly article: ReturnType<typeof getArticleBySlug>;
  readonly lang: ArticleLang;
}): null {
  // Hook wrapper so we only call useExerciseHead when an article exists.
  if (article !== undefined) useExerciseHead(article, lang);
  return null;
}

export function ExerciseArticlePage({ lang }: { readonly lang: ArticleLang }): ReactNode {
  const from = lang === 'es' ? '/ejercicios/$slug' : '/en/exercises/$slug';
  const { slug } = useParams({ from });
  const article = getArticleBySlug(lang, slug);

  if (article === undefined) {
    const backTo = lang === 'es' ? '/ejercicios' : '/en/exercises';
    return (
      <div className="text-center py-16 px-4">
        <p className="text-muted mb-6 text-sm">
          {lang === 'es' ? 'Ejercicio no encontrado.' : 'Exercise not found.'}
        </p>
        <Link to={backTo} className="text-accent text-sm">
          {lang === 'es' ? 'Volver' : 'Back'}
        </Link>
      </div>
    );
  }

  return (
    <>
      <ArticleHead article={article} lang={lang} />
      <ExerciseJsonLd article={article} lang={lang} />
      <ExerciseArticleView article={article} lang={lang} />
    </>
  );
}
```

> NOTE for the implementer: the conditional `useExerciseHead` inside `ArticleHead` is safe because the early-return branch renders a different component subtree; `ArticleHead` itself always runs the same hook path for a given `article` identity. If the linter flags conditional-hook usage, refactor `useExerciseHead` to accept `article: ExerciseArticle | undefined` and no-op internally instead.

```tsx
// exercise-wiki-index-page.tsx
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import { useHead } from '@/hooks/use-head';
import { getAllArticles } from './content/registry';

const COPY = {
  es: {
    title: 'Ejercicios — Gravity Room',
    heading: 'Wiki de ejercicios',
    intro: 'Guías basadas en evidencia para los ejercicios principales.',
  },
  en: {
    title: 'Exercises — Gravity Room',
    heading: 'Exercise wiki',
    intro: 'Evidence-based guides for the main lifts.',
  },
} as const;

export function ExerciseWikiIndexPage({ lang }: { readonly lang: ArticleLang }): ReactNode {
  const copy = COPY[lang];
  const base = lang === 'es' ? '/ejercicios' : '/en/exercises';
  useHead({
    title: copy.title,
    description: copy.intro,
    canonical: `https://gravityroom.app${base}`,
    lang,
  });
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-title">{copy.heading}</h1>
        <p className="text-muted">{copy.intro}</p>
      </header>
      <ul className="space-y-3">
        {getAllArticles().map((a) => (
          <li key={a.exerciseId}>
            <Link
              data-testid="exercise-card"
              to={`${base}/$slug`}
              params={{ slug: a.slug[lang] }}
              className="block border border-rule rounded-sm px-4 py-3 hover:border-accent transition-colors"
            >
              <span className="font-display text-xl text-main">{a.content[lang].title}</span>
              <span className="block text-sm text-muted">{a.content[lang].description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/exercise-wiki-index-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
committer "feat(web): add exercise-wiki article and index pages" \
  apps/frontend/web/src/features/exercise-wiki/exercise-article-page.tsx \
  apps/frontend/web/src/features/exercise-wiki/exercise-wiki-index-page.tsx \
  apps/frontend/web/src/features/exercise-wiki/exercise-wiki-index-page.test.tsx
```

---

### Task 7: Wire routes + sitemap

**Files:**

- Modify: `apps/frontend/web/src/router.tsx`
- Modify: `apps/frontend/web/public/sitemap.xml`
- Test: `apps/frontend/web/src/router.test.tsx` (create if absent)

**Interfaces:**

- Consumes: `ExerciseWikiIndexPage`, `ExerciseArticlePage`.
- Produces: routes `/ejercicios`, `/ejercicios/$slug`, `/en/exercises`, `/en/exercises/$slug` registered on `rootRoute`.

- [ ] **Step 1: Write the failing test**

```tsx
// router.test.tsx
import { describe, expect, it } from 'bun:test';
import { router } from './router';

describe('router', () => {
  it('registers the public exercise-wiki routes', () => {
    const paths = Object.keys(router.routesById);
    expect(paths).toContain('/ejercicios');
    expect(paths).toContain('/ejercicios/$slug');
    expect(paths).toContain('/en/exercises');
    expect(paths).toContain('/en/exercises/$slug');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend/web && bun test src/router.test.tsx`
Expected: FAIL — routes not present.

- [ ] **Step 3: Add lazy imports + routes in `router.tsx`**

Add near the other lazy page declarations:

```ts
const ExerciseWikiIndexPage = lazyWithRetry(() =>
  import('@/features/exercise-wiki/exercise-wiki-index-page').then((m) => ({
    default: m.ExerciseWikiIndexPage,
  }))
);
const ExerciseArticlePage = lazyWithRetry(() =>
  import('@/features/exercise-wiki/exercise-article-page').then((m) => ({
    default: m.ExerciseArticlePage,
  }))
);
```

Add route definitions after `cookiesRoute` (use `ContentPageSkeleton` as the pending component to match other public content routes):

```ts
const wikiIndexEsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ejercicios',
  pendingComponent: ContentPageSkeleton,
  component: () => <ExerciseWikiIndexPage lang="es" />,
});
const wikiArticleEsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ejercicios/$slug',
  pendingComponent: ContentPageSkeleton,
  component: () => <ExerciseArticlePage lang="es" />,
});
const wikiIndexEnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/exercises',
  pendingComponent: ContentPageSkeleton,
  component: () => <ExerciseWikiIndexPage lang="en" />,
});
const wikiArticleEnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/exercises/$slug',
  pendingComponent: ContentPageSkeleton,
  component: () => <ExerciseArticlePage lang="en" />,
});
```

Add the four routes to the `rootRoute.addChildren([...])` array (alongside `cookiesRoute`, before `notFoundRoute`):

```ts
  wikiIndexEsRoute,
  wikiArticleEsRoute,
  wikiIndexEnRoute,
  wikiArticleEnRoute,
```

- [ ] **Step 4: Add sitemap entries**

In `public/sitemap.xml`, add before `</urlset>` (the `$slug` detail URLs use the real flagship slugs):

```xml
  <url><loc>https://gravityroom.app/ejercicios</loc><lastmod>2026-06-20</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://gravityroom.app/en/exercises</loc><lastmod>2026-06-20</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://gravityroom.app/ejercicios/sentadilla</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://gravityroom.app/ejercicios/press-banca</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://gravityroom.app/ejercicios/peso-muerto</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://gravityroom.app/en/exercises/squat</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://gravityroom.app/en/exercises/bench-press</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://gravityroom.app/en/exercises/deadlift</loc><lastmod>2026-06-20</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
```

- [ ] **Step 5: Run test + typecheck**

Run: `cd apps/frontend/web && bun test src/router.test.tsx && bun run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
committer "feat(web): register exercise-wiki routes and sitemap entries" \
  apps/frontend/web/src/router.tsx \
  apps/frontend/web/public/sitemap.xml \
  apps/frontend/web/src/router.test.tsx
```

---

### Task 8: Citation-verification gate script

**Files:**

- Create: `apps/frontend/web/scripts/verify-citations.ts`

**Interfaces:**

- Consumes: `EXERCISE_ARTICLES`.
- Produces: a CLI that resolves every reference's DOI (Crossref) or PMID (NCBI eutils) and exits non-zero on any failure or any `reviewedBy === 'PLACEHOLDER'`.

- [ ] **Step 1: Write the script**

```ts
// apps/frontend/web/scripts/verify-citations.ts
import { EXERCISE_ARTICLES } from '../src/features/exercise-wiki/content/registry';

async function doiResolves(doi: string): Promise<boolean> {
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { 'User-Agent': 'gravity-room-citation-check/1.0 (mailto:luis.reche@agentero.com)' },
  });
  return res.status === 200;
}

async function pmidResolves(pmid: string): Promise<boolean> {
  const res = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`
  );
  if (res.status !== 200) return false;
  const json = (await res.json()) as { result?: Record<string, unknown> };
  return json.result?.[pmid] !== undefined;
}

let failures = 0;
for (const a of EXERCISE_ARTICLES) {
  if (a.reviewedBy === 'PLACEHOLDER') {
    console.error(`✗ ${a.exerciseId}: still PLACEHOLDER (not reviewed)`);
    failures++;
    continue;
  }
  for (const r of a.references) {
    const ok = r.doi !== undefined ? await doiResolves(r.doi) : await pmidResolves(r.pmid!);
    if (!ok) {
      console.error(`✗ ${a.exerciseId}: unresolved ${r.doi ?? r.pmid} — "${r.title}"`);
      failures++;
    } else {
      console.error(`✓ ${a.exerciseId}: ${r.doi ?? r.pmid}`);
    }
  }
}
if (failures > 0) {
  console.error(`\n${failures} citation failure(s).`);
  process.exit(1);
}
console.error('\nAll citations resolved.');
```

- [ ] **Step 2: Run it against the placeholder to confirm it FAILS the gate**

Run: `cd apps/frontend/web && bun run scripts/verify-citations.ts`
Expected: exits non-zero, reports `squat: still PLACEHOLDER`.

- [ ] **Step 3: Commit**

```bash
committer "chore(web): add citation-verification gate for exercise wiki" \
  apps/frontend/web/scripts/verify-citations.ts
```

---

### Task 9: Research + author the 3 flagship articles (squat, bench, deadlift)

> This is an authoring + research task, not a code task. Do it once per exercise. Each article REPLACES the placeholder. The deliverable is a `content/<id>.ts` module that (a) passes `ExerciseArticleSchema`, (b) passes the citation gate, (c) is reviewed.

**Files:**

- Create: `apps/frontend/web/src/features/exercise-wiki/content/squat.ts`
- Create: `apps/frontend/web/src/features/exercise-wiki/content/bench.ts`
- Create: `apps/frontend/web/src/features/exercise-wiki/content/deadlift.ts`
- Modify: `apps/frontend/web/src/features/exercise-wiki/content/registry.ts`
- Delete: `apps/frontend/web/src/features/exercise-wiki/content/_placeholder.ts`

**Per-exercise procedure (repeat for squat → bench → deadlift):**

- [ ] **Step 1: Research the literature.** Find peer-reviewed sources on the lift's biomechanics and muscle activation (EMG). Good anchors: Schoenfeld biomechanics work, EMG comparison studies, ACSM/NSCA position stands. For EACH claim you intend to publish, capture the supporting paper's DOI or PMID, title, authors, year, and a resolvable URL. Use the deep-research skill or web search; record sources as you go.

- [ ] **Step 2: Verify each source is real BEFORE writing it down.** For a DOI: `curl -sI "https://api.crossref.org/works/<doi>" | head -1` must be `200`. For a PMID: `curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=<pmid>&retmode=json"` must contain the id. Discard anything that does not resolve — do NOT guess DOIs.

- [ ] **Step 3: Write the content module** conforming to `ExerciseArticle`, both `es` and `en`, with `evidence[].refIndices` pointing at the verified `references[]`. Use the real slugs: squat → `{es:'sentadilla', en:'squat'}`, bench → `{es:'press-banca', en:'bench-press'}`, deadlift → `{es:'peso-muerto', en:'deadlift'}`. Set `exerciseId`/`muscleGroupId` to the seed values (`squat`/`legs`, `bench`/`chest`, `deadlift`/`back`). Leave `reviewedBy: 'PENDING'` for now.

```ts
// content/squat.ts  (shape — fill every field with researched, cited content)
import type { ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

export const squatArticle: ExerciseArticle = {
  exerciseId: 'squat',
  slug: { es: 'sentadilla', en: 'squat' },
  muscleGroupId: 'legs',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['quadriceps', 'gluteus maximus'],
  secondaryMuscles: ['hamstrings', 'erector spinae', 'adductors'],
  references: [
    /* verified {doi|pmid,title,authors,year,url} objects */
  ],
  content: {
    es: {
      title: 'Sentadilla',
      description: '…',
      summary: ['…'],
      technique: ['…'],
      evidence: [{ claim: '…', refIndices: [0] }],
      commonMistakes: ['…'],
    },
    en: {
      title: 'Squat',
      description: '…',
      summary: ['…'],
      technique: ['…'],
      evidence: [{ claim: '…', refIndices: [0] }],
      commonMistakes: ['…'],
    },
  },
  reviewedBy: 'PENDING',
  reviewedAt: '2026-06-20',
};
```

- [ ] **Step 4: Register it** — once all three exist, replace `registry.ts` body:

```ts
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { squatArticle } from './squat';
import { benchArticle } from './bench';
import { deadliftArticle } from './deadlift';

export const EXERCISE_ARTICLES: readonly ExerciseArticle[] = [
  squatArticle,
  benchArticle,
  deadliftArticle,
];

export function getAllArticles(): readonly ExerciseArticle[] {
  return EXERCISE_ARTICLES;
}
export function getArticleBySlug(lang: ArticleLang, slug: string): ExerciseArticle | undefined {
  return EXERCISE_ARTICLES.find((a) => a.slug[lang] === slug);
}
```

Then delete the placeholder: `trash apps/frontend/web/src/features/exercise-wiki/content/_placeholder.ts`.

- [ ] **Step 5: Run the registry tests + citation gate (PENDING still fails the gate).**

Run: `cd apps/frontend/web && bun test src/features/exercise-wiki/content/registry.test.ts`
Expected: PASS (schema valid for all three).
Run: `bun run scripts/verify-citations.ts`
Expected: all DOIs/PMIDs resolve (✓), but exits non-zero on `reviewedBy` not being a real name yet — that's the human-review gate, addressed in Task 10.

- [ ] **Step 6: Commit (one commit per exercise is fine; final commit registers all three).**

```bash
committer "content(web): add researched squat/bench/deadlift wiki articles" \
  apps/frontend/web/src/features/exercise-wiki/content/squat.ts \
  apps/frontend/web/src/features/exercise-wiki/content/bench.ts \
  apps/frontend/web/src/features/exercise-wiki/content/deadlift.ts \
  apps/frontend/web/src/features/exercise-wiki/content/registry.ts
```

> The placeholder deletion is committed separately (deletions are listed explicitly): `committer "chore(web): drop exercise-wiki placeholder fixture" apps/frontend/web/src/features/exercise-wiki/content/_placeholder.ts` — note tests/json-ld imports of `_placeholder` must be repointed to a real article (e.g. `squat`) in the same commit.

---

### Task 10: Human review + full verification gate

**Files:**

- Modify: the three `content/*.ts` (`reviewedBy`/`reviewedAt` once signed off)

- [ ] **Step 1: Human factual review.** The user (or a qualified reviewer) reads each article and confirms the claims match the cited sources and contain no errors. This is mandatory and cannot be skipped or self-certified by the agent.

- [ ] **Step 2: Set the sign-off** — replace `reviewedBy: 'PENDING'` with the reviewer's name and `reviewedAt` with the review date in each module. Commit:

```bash
committer "content(web): mark squat/bench/deadlift articles as reviewed" \
  apps/frontend/web/src/features/exercise-wiki/content/squat.ts \
  apps/frontend/web/src/features/exercise-wiki/content/bench.ts \
  apps/frontend/web/src/features/exercise-wiki/content/deadlift.ts
```

- [ ] **Step 3: Run the full gate.**

Run: `cd apps/frontend/web && bun run scripts/verify-citations.ts`
Expected: `All citations resolved.`, exit 0.

---

### Task 11: End-to-end build + prerender verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck, lint, unit tests.**

Run: `cd apps/frontend/web && bun run typecheck && bun run lint && bun test ./src`
Expected: all green.

- [ ] **Step 2: Production build with prerender.**

Run: `cd apps/frontend/web && DATABASE_URL= VITE_API_URL=https://gravityroom.app bun run build`
Expected: prerender logs `OK /ejercicios`, `OK /en/exercises`, `OK /ejercicios/sentadilla`, `OK /ejercicios/press-banca`, `OK /ejercicios/peso-muerto`, `OK /en/exercises/squat`, `OK /en/exercises/bench-press`, `OK /en/exercises/deadlift`.

- [ ] **Step 3: Assert prerendered HTML carries the SEO payload.**

Run:

```bash
cd apps/frontend/web
grep -q '"@type":"Article"' dist/ejercicios/sentadilla/index.html && echo "JSON-LD OK"
grep -q '<title>Sentadilla' dist/ejercicios/sentadilla/index.html && echo "TITLE OK"
grep -q 'hreflang="en"' dist/ejercicios/sentadilla/index.html && echo "HREFLANG OK"
grep -q 'rel="canonical" href="https://gravityroom.app/ejercicios/sentadilla"' dist/ejercicios/sentadilla/index.html && echo "CANONICAL OK"
```

Expected: all four "OK" lines print.

- [ ] **Step 4: Delegate feature verification to `qa-verifier`.** Per the global protocol, spawn the `qa-verifier` agent to diff against base, confirm no regression to existing routes/prerender/PWA, and return GO/NO-GO with evidence. Apply any fixes it reports.

- [ ] **Step 5: Final commit (if Step 4 produced fixes) + finish the branch** via the `superpowers:finishing-a-development-branch` skill (merge / PR decision).

---

## Self-Review

**Spec coverage:**

- Scope ~15-30 curated, phase-1 = 3 flagship → Tasks 9-10. ✓
- Bilingual es+en → schema `content.{es,en}`, routes both langs (Task 7), hreflang (Task 4). ✓
- Files in repo, typed TS, Zod in domain → Tasks 1-2. ✓
- Maps to existing `exercise.id` → `exerciseId` field + real seed IDs. ✓
- `useHead` reuse + `ExerciseJsonLd` with citations → Tasks 3-4. ✓
- Sitemap → prerender pickup, scaling check → Task 7 + Task 11. ✓
- Filterable index lists only curated articles → Task 6 (note: muscle-group filtering UI deferred; v1 lists 3 items, filtering is YAGNI until scale-out). ✓
- Citation-integrity gate + human review → Tasks 8, 9-Step 2, 10. ✓
- App↔wiki deep links → covered by stable routes; linking FROM tracker is a scale-out follow-up, not phase-1 success criteria. Noted as deferred.

**Placeholder scan:** The only `PLACEHOLDER`/`PENDING`/`…` strings are the deliberately-temporary content fixture (Task 2) and the content shells the researcher fills (Task 9) — these are data to be authored, not unspecified plan steps. All code steps carry complete code.

**Type consistency:** `ExerciseArticle`, `ArticleLang`, `getArticleBySlug`, `getAllArticles`, `articleUrl`, `useExerciseHead`, `ExerciseArticleView`, `ExerciseJsonLd` names are used identically across Tasks 1-7. Routes `from` strings match the registered paths in Task 7.

## Deferred to phase 2 (scale-out) — explicitly out of scope here

- Remaining ~15-25 core articles.
- Muscle-group filtering UI on the index.
- Deep-linking from tracker/program-view into wiki articles.
- Prerender parallelization (only needed beyond ~40 URLs).
- Blog (separate brainstorm → spec → plan cycle).
