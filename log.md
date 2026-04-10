# Project Log

Active work log for the current session. Append decisions, discoveries, and constraints here.

---

## 2026-04-10 — Open questions resolved (from roadmap)

- **Twitter/X**: No handle exists. Skipping `twitter:site` / `twitter:creator` meta tags.
- **GitHub**: Repo lives at `https://github.com/rechedev/gravity-room`. Linked from landing page footer.
- **i18n strategy**: Full two-language support is the goal. Implementing parallel English landing page at `/en` with shared, content-prop-driven section components. App UI stays Spanish.
- **Ad blockers**: No custom Plausible proxy needed. Fix CSP instead.

---

## 2026-04-10 — Phase 1–6 implementation

### Phase 1 — Blocker Fixes

- **CSP fixed**: Added `https://plausible.io` to `script-src` and `connect-src` in `security-headers.conf`. Analytics was silently blocked in production.
- **OG image PNG**: Converted `og-image.webp` → `og-image.png` via `sips`. Updated `index.html` to reference PNG + added `og:image:type`. LinkedIn/iMessage were silently dropping the webp preview.
- **VITE_PLAUSIBLE_DOMAIN typed**: Added to `vite-env.d.ts`.

### Phase 2 — English Landing Page

- **Content abstraction**: Extracted all translatable landing page text into `src/features/landing/content.ts`. Defines `LandingContent` interface + `ES_CONTENT` + `EN_CONTENT` objects.
- **Section refactor**: All section components (HeroSection, NavBar, MetricsSection, FeaturesSection, HowItWorksSection, ScienceSection, ProgramsSection, FinalCtaSection, Footer, SkipToContent) now accept a required `content` prop typed from `LandingContent`.
- **landing-page-en.tsx**: New English landing page at `/en` using `EN_CONTENT`. Shares all section components with the Spanish page — no duplication of component logic.
- **Language banner**: Both landing pages show a subtle language-switch banner (Spanish page → "English version available", English page → "Versión en Español disponible") for 5s then fades.
- **useHead hook**: `src/hooks/use-head.ts` — manages `document.title`, `lang`, `description`, `canonical`, `og:*` meta tags. Restores originals on unmount. Used by both landing pages and program preview pages.

### Phase 3 — SEO Hardening

- **Per-route canonical**: `useHead` called in each landing page and program preview pages. Static canonical in `index.html` removed.
- **Per-route OG for program preview**: Program preview pages inject `og:title`, `og:description`, `og:url` per program after data loads.
- **FAQ expanded**: Added 5 more FAQ entries in `index.html` targeting progressive overload, beginner programs, GZCLP vs StrongLifts 5x5.
- **hreflang**: Added `<link rel="alternate" hreflang="es">`, `hreflang="en"`, `hreflang="x-default">` to `index.html`.
- **Sitemap**: Added `/en` URL. Updated `lastmod` to 2026-04-10.

### Phase 4 — GEO

- **llms.txt enhanced**: Added comparison content (GZCLP vs StrongLifts 5x5 vs Phrak's GSLP), progressive overload explanation, technical architecture section. References `/en`.
- **llms-full.txt**: New extended version with full program descriptions and detailed Q&A.
- **robots.txt**: Added `# LLM context: /llms.txt` reference.
- **noscript**: Expanded to cover program list with links.

### Phase 5 — Performance

- **Self-hosted fonts**: Downloaded Bebas Neue, Barlow, JetBrains Mono as woff2. Added `@font-face` in `globals.css`. Removed Google Fonts CDN links from `index.html`. Eliminates GDPR concern and external DNS round-trip.
- **Preloads**: Added `<link rel="preload">` for critical fonts (Bebas Neue, Barlow 400) and hero image in `index.html`.
- **Analytics events**: Added `landing_view`, `landing_cta_click`, `program_preview_view`, `login_page_view` events. Added UTM parameter capture (utm_source, utm_medium, utm_campaign) on landing page mount.
- **PWA PNG icons**: Converted `logo.webp` and `logo-192.webp` to PNG. Updated `manifest.webmanifest`.

### Phase 6 — Launch Content

- **GitHub link**: Added to landing page footer in both ES and EN content. Linked from JSON-LD `sameAs` property.
- **JSON-LD sameAs**: Updated `SoftwareApplication` block with `sameAs: ["https://github.com/rechedev/gravity-room", "https://discord.gg/FXNBrgYf7U"]`.
