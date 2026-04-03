# SEO On-Page & Sitemap Fixes

**Last updated:** 2026-04-03
**Status:** Phase 2 complete — Phase 3 pending

---

## Objective

Patch the minimal set of SEO issues found in the audit that carry zero risk to app logic, visual
design, or Go API behavior. No UI rework. No new pages. No backend changes.

---

## Current State

- `apps/web/index.html` — one shared set of meta tags for every URL. Two minor errors:
  `og:image:alt` is generic ("Gravity Room logo"); `SoftwareApplication` JSON-LD `description`
  is in English while the app is Spanish.
- `apps/web/public/manifest.webmanifest` — `short_name` is "GR"; `description` is in English.
- `apps/web/public/sitemap.xml` — only two entries (`/` and `/privacy`). Missing: `/cookies`
  and all 18 active program preview pages (`/programs/:programId`). No `<lastmod>` on any entry.
- `apps/web/src/features/program-preview/program-preview-page.tsx` — the program name is rendered
  in a `<span>` inside the sticky header and inside a `<summary>`. There is no `<h1>`.
- Per-route `<title>` — none. Every route (`/privacy`, `/cookies`, `/programs/:programId`, 404)
  inherits the homepage title from the static `index.html`.
- Per-route `<meta description>` — same issue; all routes share the homepage description.

Active program IDs from `apps/web/src/lib/shared/catalog.ts` (18 total):
`gzclp`, `hexan-ppl`, `stronglifts-5x5`, `phraks-greyskull-lp`, `531-boring-but-big`,
`531-for-beginners`, `phul`, `nivel-7`, `caparazon-de-tortuga`, `sala-del-tiempo-1`,
`sala-del-tiempo-2`, `sala-del-tiempo-3`, `tenkaichi-budokai-sentadilla`,
`tenkaichi-budokai-press-banca`, `tenkaichi-budokai-peso-muerto`, `tenkaichi-budokai-solo-banca`,
`tenkaichi-budokai-veterano`, `furia-oscura`

---

## Constraints

- No changes to Go API, Python analytics, or Docker/infra config.
- No changes to app-shell routes (`/app/*`), auth flow, or any component shared with the live UI.
- No visual redesign — `ProgramPreviewPage` changes must be semantically additive only.
- No new pages or routes.
- Per-route titles must degrade gracefully when JS is slow/disabled (static `index.html` title
  remains the fallback for non-JS crawlers, which is already acceptable).
- Prefer no new runtime dependency where a simple `useEffect` suffices.

---

## Workstreams

1. **Static file patches** — `index.html`, `manifest.webmanifest`, `sitemap.xml`
2. **Per-route document titles** — `useEffect` in `/privacy`, `/cookies`, `/programs/:programId`
3. **Semantic `<h1>` on program preview** — additive only, no style rework

---

## Step-by-Step Plan

### Phase 1 — Static files (zero-risk, no build required)

**Step 1 — `apps/web/index.html`**
- Fix `og:image:alt`: change from `"Gravity Room logo"` to
  `"Captura de Gravity Room mostrando el tracker de entrenamiento con progresión automática"`
- Translate `SoftwareApplication` JSON-LD `description` to Spanish:
  `"App web gratuita para seguir programas de entrenamiento con progresión automática. Te dice exactamente qué levantar en cada sesión y ajusta el peso, series y repeticiones según tu rendimiento."`

**Step 2 — `apps/web/public/manifest.webmanifest`**
- Change `short_name` from `"GR"` to `"Gravity Room"`
- Translate `description` to Spanish:
  `"Programas de entrenamiento respaldados por la ciencia con progresión automática de peso."`

**Step 3 — `apps/web/public/sitemap.xml`**
- Add `<lastmod>2026-04-03</lastmod>` to existing `/` and `/privacy` entries
- Add `/cookies` entry (`priority 0.3`, `monthly`)
- Add one entry per active program ID (`priority 0.7`, `monthly`):
  `https://gravityroom.app/programs/{id}` for each of the 18 IDs above

---

### Phase 2 — Per-route document titles (low risk, no new dependency)

Each public page sets `document.title` via `useEffect`. The static `index.html` title stays
as-is — it is the correct fallback for `/` and for non-JS crawlers.

**Step 4 — `apps/web/src/features/legal/privacy-page.tsx`**
- Add `useEffect(() => { document.title = 'Política de Privacidad — Gravity Room'; }, [])`

**Step 5 — `apps/web/src/features/legal/cookie-policy-page.tsx`**
- Add `useEffect(() => { document.title = 'Política de Cookies — Gravity Room'; }, [])`

**Step 6 — `apps/web/src/features/program-preview/program-preview-page.tsx`**
- Add `useEffect(() => { if (definition) document.title = \`${definition.name} — Gravity Room\`; }, [definition])`
- Reset on unmount: return `() => { document.title = 'Gravity Room — Programas de Entrenamiento con Progresión Automática'; }`

---

### Phase 3 — Semantic `<h1>` on program preview (low risk, additive)

**Step 7 — `apps/web/src/features/program-preview/program-preview-page.tsx`**
- Add a visually hidden `<h1>` with the program name above the sticky header, or replace the
  `<span>` in the sticky header with an `<h1>` styled identically.
- Recommended: use `<h1 className="sr-only">{definition.name}</h1>` at the top of the page
  content div — zero visual impact, semantically correct.

---

## Files Affected

| File | Change |
|---|---|
| `apps/web/index.html` | Fix `og:image:alt`; translate JSON-LD description |
| `apps/web/public/manifest.webmanifest` | Fix `short_name`; translate `description` |
| `apps/web/public/sitemap.xml` | Add `/cookies` + 18 program entries + `<lastmod>` |
| `apps/web/src/features/legal/privacy-page.tsx` | `useEffect` for `document.title` |
| `apps/web/src/features/legal/cookie-policy-page.tsx` | `useEffect` for `document.title` |
| `apps/web/src/features/program-preview/program-preview-page.tsx` | `useEffect` for `document.title` + `<h1>` |

---

## Risks

- **`document.title` on unmount** — if the user navigates from `/programs/:programId` back to `/`,
  the title must be restored. The unmount cleanup in Step 6 handles this. Verify by navigating
  back and forth in dev.
- **`<h1>` visual regression** — using `sr-only` avoids any layout shift. If the `<span>` in the
  header is replaced instead, verify the sticky header visually at mobile and desktop breakpoints.
- **Sitemap staleness** — the sitemap is now static. When new programs are added to `catalog.ts`,
  the sitemap must be updated manually. Consider a build script later (out of scope here).

---

## Verification

- [ ] `bun run typecheck` passes after Phase 2 and 3 changes
- [ ] `bun run lint` passes
- [ ] Navigate to `/privacy` in browser — tab title reads "Política de Privacidad — Gravity Room"
- [ ] Navigate to `/cookies` — tab title reads "Política de Cookies — Gravity Room"
- [ ] Navigate to any `/programs/:id` — tab title reads "{Program Name} — Gravity Room"
- [ ] Navigate back to `/` — tab title reverts to homepage title
- [ ] View source of `index.html` — confirm `og:image:alt` and JSON-LD description updated
- [ ] Open `manifest.webmanifest` in browser — confirm `short_name` and `description` updated
- [ ] Validate `sitemap.xml` at `/sitemap.xml` — confirm 21 entries (1 + 1 + 1 + 18)
- [ ] Run Lighthouse SEO audit on `/programs/gzclp` — no "Document doesn't have a title" warning

---

## Open Questions

- None. All changes are scoped and self-contained.
