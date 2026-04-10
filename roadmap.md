# Gravity Room — Roadmap

**Last updated:** 2026-04-10
**Status:** All phases complete — ready for launch

---

## Objective

Prepare Gravity Room for public launch on HackerNews, ProductHunt, Y Combinator, and similar English-speaking tech communities. The app currently targets Spanish-speaking users only. This roadmap covers: English landing page, SEO hardening, Generative Engine Optimization (GEO), performance tuning, social sharing improvements, analytics hardening, and infrastructure fixes that would embarrass on launch day.

---

## Current State

**What exists (strong foundation):**
- Static SEO in `index.html`: `<title>`, `<meta description>`, Open Graph, Twitter Cards, 3 JSON-LD blocks (WebSite, SoftwareApplication, FAQPage with bilingual Q&A)
- `robots.txt`: well-configured — blocks `/app`, `/login`, AI training bots; allows AI retrieval bots (ChatGPT-User, Claude-SearchBot, PerplexityBot)
- `sitemap.xml`: 19 URLs (root + 2 legal + 16 program preview pages), hand-maintained, hardcoded `lastmod`
- `llms.txt`: bilingual (EN/ES), covers app purpose, features, technical details
- `manifest.webmanifest`: PWA-ready with standalone display
- `noscript` fallback: meaningful HTML for non-JS crawlers
- Plausible Analytics: privacy-focused, 4 custom events (signup, guest_start, program_start, program_complete)
- Sentry error tracking
- PWA via `vite-plugin-pwa` with workbox runtime caching
- Code splitting per route via `lazyWithRetry`
- nginx: gzip, immutable cache for hashed assets, no-cache for HTML

**What's broken or missing:**
- **Language**: entire landing page, legal pages, and all UI copy is Spanish-only. No i18n framework. HN/PH/YC audiences are predominantly English-speaking.
- **CSP blocks Plausible**: `plausible.io` is not in `script-src` or `connect-src` in `security-headers.conf`. The injected Plausible script is silently blocked in production.
- **Per-route meta tags**: every URL shares the same OG title/description/image/canonical. Program preview pages (`/programs/gzclp`, etc.) show the generic landing page preview when shared on social media.
- **Canonical URL**: hardcoded to `https://gravityroom.app/` for all routes. Crawlers see the root canonical on `/programs/gzclp`, `/privacy`, etc.
- **OG image format**: `og-image.webp` — some platforms (LinkedIn, older Facebook crawlers, iMessage) don't reliably render `.webp` OG images. PNG/JPEG is safer.
- **Twitter handles missing**: `twitter:site` and `twitter:creator` not set.
- **No Brotli compression**: nginx only serves gzip. Brotli saves 15-25% additional on JS/CSS.
- **Google Fonts not self-hosted**: external dependency adds latency and has GDPR implications (German court precedent). Three font families loaded from `fonts.googleapis.com`.
- **No `<link rel="preload">`**: no preloading of critical font files or hero image.
- **Sitemap is static**: `lastmod` hardcoded to `2026-04-03`, won't reflect new programs automatically.
- **PWA manifest icons are `.webp`**: Safari and some older install flows prefer PNG.
- **`VITE_PLAUSIBLE_DOMAIN` not typed**: not in `vite-env.d.ts`, reads as `string | undefined` without type narrowing.
- **No conversion funnel tracking**: Plausible has 4 events but no funnel (landing → login → signup → first workout). No UTM parameter capture for attribution.
- **No English content**: no way for English-speaking HN/PH visitors to read what the app does.
- **No social proof**: no testimonials, user count, or community size on landing page.
- **No changelog/what's new page**: nothing to share on launch day to show momentum.
- **Only Discord for community**: no Twitter/X handle, no GitHub stars badge.

---

## Approach

**Chosen strategy: fix blockers first (CSP, OG format, canonical), then build the English landing page, then layer SEO/GEO improvements, then performance.**

The English landing page is the highest-leverage item — without it, sharing on HN/PH is pointless because the audience can't read the page. But CSP and OG fixes are prerequisite because they affect whether the shared links even preview correctly.

**Alternatives considered and rejected:**
- *Full i18n with react-intl/i18next*: rejected for launch timeline. Extracting ~200 UI strings across 50+ files into translation keys is weeks of work. Instead: add a parallel English landing page at `/en` (or auto-detect `Accept-Language`) and keep the app UI Spanish for now. The app's value proposition is clear from the landing page; users who sign up will figure out the Spanish UI (it's a gym tracker, not a legal document).
- *SSR/prerendering for per-route meta*: rejected. Adding SSR (Next.js, Vite SSR, Astro) is a massive migration. Instead: inject per-route `<meta>` tags client-side via a lightweight `useHead` hook + ensure the `noscript` fallback covers program preview pages. For social crawlers that don't execute JS, add a minimal prerender middleware at the Caddy layer (or nginx) that serves static meta for known public routes.
- *Full prerender service (prerender.io, rendertron)*: rejected as overkill for 19 public URLs. A static approach (build-time generation of per-route `index.html` variants or Caddy-level HTML snippets) is simpler and has zero runtime cost.

---

## Constraints

- `bun run ci` must be green at every checkpoint.
- No new runtime dependencies unless they solve a clear problem.
- The Go API is not touched in this wave — all changes are frontend + infrastructure.
- The app UI stays Spanish for now; only public-facing marketing pages get English.
- Launch timeline is soon — prioritize impact over perfection.

---

## Workstreams

Three parallel tracks after the initial blocker fixes:

1. **English Landing + Content** — the English landing page and content for HN/PH audiences
2. **SEO + GEO Hardening** — per-route meta, structured data, sitemap automation, social sharing
3. **Performance + Infrastructure** — font self-hosting, Brotli, preloads, CSP fixes, analytics hardening

---

## Step-by-Step Plan

### Phase 1 — Fix Blockers (Done)

**Step 1.1 — Fix CSP to allow Plausible** ✅
- Added `https://plausible.io` to `script-src` and `connect-src` in `security-headers.conf`.
- Removed Google Fonts from `style-src` and `font-src` (now self-hosted).

**Step 1.2 — Add OG image in PNG format** ✅
- Generated `og-image.png` via `sips`. Updated `index.html` with PNG path + `og:image:type`.

**Step 1.3 — Type `VITE_PLAUSIBLE_DOMAIN` in env** ✅
- Added `readonly VITE_PLAUSIBLE_DOMAIN?: string` to `vite-env.d.ts`.

**Step 1.4 — Twitter handles** ✅
- No Twitter/X handle. Skipped `twitter:site` / `twitter:creator`.

#### Checkpoint 1 ✅
- [x] `bun run ci` green
- [x] CSP allows Plausible
- [x] OG image is PNG

---

### Phase 2 — English Landing Page (Done)

**Step 2.1 — Content abstraction** ✅
- Extracted all translatable text into `src/features/landing/content.ts`. Defines `LandingContent` interface + `ES_CONTENT` + `EN_CONTENT`.
- All section components refactored to accept required `content` prop.

**Step 2.2 — English landing page route** ✅
- `landing-page-en.tsx` at `/en`. Shares all section components with Spanish page.

**Step 2.3 — Language banner** ✅
- Both pages show a subtle language-switch banner with a 5s fade.

**Step 2.4 — English meta tags via `useHead`** ✅
- `src/hooks/use-head.ts` manages per-route title, lang, description, canonical, og:* tags. Restores on unmount.

**Step 2.5 — hreflang** ✅
- Added `hreflang="es"`, `hreflang="en"`, `hreflang="x-default"` to `index.html`.

**Step 2.6 — Sitemap** ✅
- Added `/en` URL to `sitemap.xml`.

**Step 2.7 — llms.txt** ✅
- `llms.txt` references `/en`. `llms-full.txt` created.

#### Checkpoint 2 ✅
- [x] `bun run ci` green
- [x] `/en` renders English landing page
- [x] Language switch banner works both directions
- [x] English meta tags set correctly
- [x] Sitemap includes `/en`

---

### Phase 3 — SEO Hardening (Done)

**Step 3.1 — Per-route canonical URLs** ✅
- `useHead` manages canonical per route. Static canonical removed from `index.html`.

**Step 3.2 — Per-route OG for program preview pages** ✅
- `useProgramHead` in `program-preview-page.tsx` sets og:title, og:description, og:url per program.

**Step 3.3 — Dynamic OG image generation** — skipped for launch (generic image acceptable).

**Step 3.4 — Structured data per program preview** — deferred post-launch.

**Step 3.5 — Expand FAQ JSON-LD** ✅
- Expanded from 7 to 11 entries targeting progressive overload, beginner programs, GZCLP vs StrongLifts.

**Step 3.6 — hreflang** ✅ (done in Phase 2)

**Step 3.7 — Sitemap automation** — deferred. Static sitemap is sufficient for launch (19 URLs, low churn).

#### Checkpoint 3 ✅
- [x] `bun run ci` green
- [x] Each public route has its own canonical URL
- [x] Program preview pages have unique OG title/description
- [x] FAQ expanded with launch-relevant questions

---

### Phase 4 — GEO (Done)

**Step 4.1 — Enhance `llms.txt`** ✅
- Added GZCLP vs StrongLifts comparison, progressive overload explanation, technical architecture, `/en` reference.

**Step 4.2 — Add `llms-full.txt`** ✅
- Full program catalog descriptions + FAQ + architecture for AI context.

**Step 4.3 — noscript program coverage** ✅
- Expanded noscript block with bilingual content and program links.

**Step 4.4 — robots.txt references llms.txt** ✅

#### Checkpoint 4 ✅
- [x] `llms.txt` expanded with comparison content
- [x] `llms-full.txt` exists
- [x] Program preview pages have noscript coverage
- [x] robots.txt references llms.txt

---

### Phase 5 — Performance and Infrastructure (Done)

**Step 5.1 — Self-host Google Fonts** ✅
- Downloaded Bebas Neue, Barlow (400/500/600/700), JetBrains Mono variable as woff2. `@font-face` in `globals.css`. Google Fonts CDN removed.

**Step 5.2 — Preload critical fonts** ✅
- Added preload for `bebas-neue-400.woff2`, `barlow-400.woff2`.

**Step 5.3 — Preload hero image** ✅
- Added `<link rel="preload" href="/hero.webp" as="image">`.

**Step 5.4 — Brotli** — deferred. No `ngx_brotli` module in current nginx image. Not worth a Docker rebuild for launch.

**Step 5.5 — Convert PWA manifest icons to PNG** ✅
- `logo.png`, `logo-192.png`, `logo-maskable.png` generated. `manifest.webmanifest` updated.

**Step 5.6 — Analytics events** ✅
- Added `landing_view`, `landing_cta_click`, `program_preview_view`, `login_page_view` events.
- Added `getUtmProps()` for UTM attribution capture.
- All four events wired up in their respective components.

**Step 5.7 — Caddy improvements** — deferred. Caddy config is adequate for launch.

**Step 5.8 — Fix build VITE_API_URL guard** ✅
- Moved guard inside `defineConfig(({ mode }) => { ... })` using `loadEnv`. Top-level guard was running before Vite loaded `.env` files.

#### Checkpoint 5 ✅
- [x] `bun run ci` green
- [x] Fonts load from `/fonts/` (no Google Fonts CDN)
- [x] PWA icons are PNG
- [x] Analytics events fire for conversion funnel
- [x] UTM params captured

---

### Phase 6 — Launch Content and Social Polish (Done)

**Step 6.1 — Social media links** ✅
- GitHub link added to footer in both ES and EN content.
- `SoftwareApplication` JSON-LD updated with `sameAs: [github, discord]`.
- No Twitter/X handle — skipped.

**Step 6.2 — Social proof** — deferred. Numbers are small; will add after launch when there's real data.

**Step 6.3 — Changelog page** — deferred post-launch.

**Step 6.4 — HN/PH preparation** — content ready; `/en` is the primary share link.

#### Checkpoint 6 ✅
- [x] Social links present in footer (Discord, GitHub)
- [x] English landing page tells a clear story

---

## Completed

All six phases shipped on 2026-04-10. `bun run ci` green (typecheck + lint + format + test + build: 481 tests, 0 fail).

**Post-launch follow-ups (not blocking):**
- Brotli compression (requires `ngx_brotli` in Docker image)
- Per-program OG image generation (satori/sharp build script)
- Structured data JSON-LD per program preview page
- Sitemap generation script (auto-updates from API catalog)
- Caddy config improvements
- Social proof section once real usage numbers exist
- Changelog page

---

## Risks

| Risk | Phase | Mitigation |
|---|---|---|
| English landing page copy is awkward or off-brand | 2 | User reviews the English copy before shipping. Keep the same structure as Spanish — just translate, don't redesign |
| `useHead` hook causes meta tag flicker or race conditions | 2, 3 | Set defaults in `index.html` that are acceptable for any page. Per-route overrides happen on mount — crawlers that don't execute JS see the defaults (acceptable for SPA) |
| Self-hosting fonts increases bundle/public size | 5 | woff2 is compact (~50KB total for 3 families). Worth it for the latency and GDPR win |
| Brotli requires custom nginx Docker image | 5 | Fallback: use build-time pre-compression with `vite-plugin-compression` and `brotli_static on` |
| Sitemap generation script breaks if Go API is down at build time | 3 | Fallback: read catalog from a committed JSON snapshot. Regenerate snapshot periodically |
| OG preview caching: social platforms cache OG tags aggressively | 1, 3 | After changes, use each platform's cache-clearing tool (Twitter Card Validator, Facebook Sharing Debugger) to re-scrape |

---

## Verification

After each phase:
- `bun run ci` (typecheck + lint + format + test + build)
- Manual verification of the phase's acceptance criteria
- After Phase 2: screenshot the English landing page on mobile and desktop
- After Phase 5: Lighthouse audit (target: Performance 90+, SEO 95+, Accessibility 90+, Best Practices 90+)
- After Phase 6: paste `https://gravityroom.app/en` into Twitter, LinkedIn, Slack → verify OG preview shows English title, description, and image
