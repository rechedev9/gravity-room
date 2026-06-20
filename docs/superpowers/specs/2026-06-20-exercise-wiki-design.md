# Exercise Wiki — Design Spec

> Status: approved design, pending implementation plan.
> Date: 2026-06-20.
> Scope: v1 of a science-backed exercise wiki for the Gravity Room web app.
> Companion (future, separate cycle): blog.

## 1. Goal & rationale

Add a public, indexable **exercise wiki** to the web app to (a) deliver real value
to users — academically grounded, cross-checked guidance per exercise — and
(b) improve organic SEO with unique, citation-backed content.

This is intentionally a **quality-over-quantity** effort. We do NOT attempt to cover
the full ~870-exercise dataset. Scientific literature (EMG, biomechanics) only exists
for a minority of movements; fabricating depth for the rest would be dishonest and
hurt credibility.

## 2. Scope (v1)

- **~15-30 curated exercises**: the core where real literature exists (main compound
  lifts + key accessories).
- **Bilingual es + en**, mirroring the existing landing pattern (`/` vs `/en`) with
  `hreflang`.
- Content lives as **version-controlled files in the repo**, prerendered at build time.
- Each article maps to an existing `exercise.id` so the app and wiki link both ways
  (e.g. tracker slot → exercise page).
- **Out of scope for v1**: the long tail of exercises, a CMS/DB-backed editor, a blog,
  user-generated content, comments.

## 3. Architecture

Pure client-side Vite SPA + build-time prerender (Playwright serializes each
`sitemap.xml` URL after hydration). The wiki rides this existing machinery — no SSR,
no backend changes for content.

### 3.1 Content model

One structured file per exercise **per language**: **MDX with typed frontmatter**,
validated at build time by a **Zod schema in `@gzclp/domain`**. Invalid frontmatter
must fail the build. Proposed standard sections:

1. Summary — what it is / what it's for
2. Primary & secondary muscles (reusing DB muscle-group data where possible)
3. Execution technique (setup, cues, range of motion)
4. **Evidence** (EMG activation, biomechanics) — with inline citations
5. Common mistakes / variations / contraindications
6. **References** — citation list with DOI/PMID

Frontmatter (indicative): `exerciseId`, `slug` (per language), `lang`, `title`,
`description`, `primaryMuscles`, `secondaryMuscles`, `equipment`, `level`,
`references[]` (each: `doi` | `pmid`, `title`, `authors`, `year`, `url`),
`reviewedBy`, `reviewedAt`.

> **Why Zod + frontmatter:** guarantees every article shares the same structure,
> references are well-formed, and JSON-LD generates without gaps.

### 3.2 Routing

Public (unauthenticated) routes added to the hand-maintained tree in `src/router.tsx`,
following the landing-page pattern (lazy-loaded, not auth-guarded):

- `/ejercicios` and `/en/exercises` — filterable index (reuses `/api/exercises` +
  `/api/muscle-groups`).
- `/ejercicios/$slug` and `/en/exercises/$slug` — article detail.

Slugs are stable, human-readable, language-specific, and map to an `exerciseId`.

### 3.3 SEO / indexability

- Reuse the existing `useHead()` hook for title/description/canonical/OG/Twitter.
- New `ExerciseJsonLd` component emitting schema.org structured data (likely `Article`
  with `citation[]` pointing to the referenced papers, plus `BreadcrumbList`).
- Wiki URLs added to `public/sitemap.xml` so the prerender script serializes them
  automatically.
- **Verify the prerender scales** to ~40+ pages (≤30 exercises × 2 languages) without
  blowing build times; if needed, parallelize or batch the Playwright pass.
- `hreflang` linking es ↔ en for each article.

## 4. Content pipeline (the delicate part)

The real risk is fabricated citations. The pipeline must make that structurally
impossible to ship.

- **Per-exercise research workflow** with a **citation-verification gate**: every
  proposed paper is validated against a real resolver (Crossref/DOI, PubMed/PMID).
  If the DOI/PMID does not resolve, or the abstract does not support the claim it is
  attached to, the citation is dropped. No unverifiable citation passes the gate.
- **Mandatory human review:** the workflow can find real papers and draft prose, but a
  human (the user, or a qualified reviewer) must sign off each article before publish.
  AI cannot guarantee zero error on scientific claims; `reviewedBy`/`reviewedAt`
  frontmatter records the sign-off, and unreviewed articles are excluded from the
  sitemap/build.

## 5. Phasing

1. **Platform + pilot** (this first plan): routes, article template, Zod schema,
   `ExerciseJsonLd`, sitemap + prerender integration, filterable index — plus **3
   flagship exercises** (e.g. squat, deadlift, bench press) fully written, bilingual,
   with verified citations. Validates SEO/prerender/quality end-to-end.
2. **Content scale-out**: remaining core (~15-25 articles) reusing the proven pipeline.
3. **Future**: blog — its own brainstorm → spec → plan cycle.

## 6. Success criteria (v1, phase 1)

- `/ejercicios` and `/en/exercises` render a filterable index; `/ejercicios/$slug`
  renders a complete article for each of the 3 flagship exercises in both languages.
- Build-time Zod validation rejects malformed frontmatter/references.
- Prerendered HTML for each new URL contains route-specific title/description/OG and
  valid `ExerciseJsonLd`; URLs present in `sitemap.xml` with correct `hreflang`.
- Every citation in the 3 pilot articles resolves to a real DOI/PMID and is marked
  `reviewedBy`.
- App ↔ wiki deep links work (tracker/program view → exercise page).
- No regression to existing routes, prerender, or PWA behavior.

## 7. Open questions for the implementation plan

- Exact schema.org type for an exercise page (`Article` + `citation[]` vs
  `ExerciseAction`/custom) — decide during plan.
- MDX toolchain choice in a Vite + React 19 SPA (e.g. `@mdx-js/rollup`) and how it
  interacts with lazy route chunks and the prerender pass.
- Final list of the 3 flagship exercises and the curated ~15-30 core.
- Whether the index page needs its own JSON-LD (`ItemList`) for SEO.
