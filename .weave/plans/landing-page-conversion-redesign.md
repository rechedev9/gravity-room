# Landing Page Conversion Redesign

## TL;DR

> **Summary**: Redesign the Spanish `/` and English `/en` landing pages around a proven conversion narrative: descriptive product hero, problem/solution, early product UI, proxy proof, concrete workflow, benefit-led features, free/pricing trust, comparison, FAQ, and repeated CTAs. Preserve Gravity Room’s dark/gold gym + anime power aesthetic by reusing the existing Tailwind theme, typography, glow treatments, motion primitives, and assets.
> **Estimated Effort**: Medium

## Context

### Original Request

Create a concrete implementation plan for redesigning Gravity Room’s Spanish/English landing page to follow proven high-converting product landing-page patterns, while preserving the current dark/gold gym/Dragon Ball-inspired brand aesthetic. Save the plan to `.weave/plans/landing-page-conversion-redesign.md`.

### Key Findings

- Route `/` renders `LandingPage` from `apps/frontend/web/src/features/landing/index.tsx` with `ES_CONTENT`; route `/en` renders `LandingPageEn` from `apps/frontend/web/src/features/landing/landing-page-en.tsx` with `EN_CONTENT`.
- `apps/frontend/web/src/features/landing/landing-page-shell.tsx` orchestrates the current order: `HeroSection`, `MetricsSection`, `FeaturesSection`, `HowItWorksSection`, `ScienceSection`, `ProgramsSection`, `FinalCtaSection`, then footer.
- Current hero is slogan-first (`Entrena Mejor. Progresa Más Rápido.`), includes vague CTA copy (`Comenzar`), and shows concept art (`/hero.webp`) before product UI. A small app-preview mock exists inside `features-section.tsx`, but it appears too late for conversion.
- `apps/frontend/web/src/features/landing/content.ts` centralizes all bilingual copy and typed content interfaces. Any new section should be added there for ES/EN parity.
- Existing shared primitives in `shared.tsx` include `SECTION_IDS`, `SECTION_PAD`, `SectionHeader`, `SectionLabel`, `GradientDivider`, footer, Discord/GitHub constants, and program-card helpers.
- Brand styling is mostly Tailwind utility classes plus landing-specific CSS in `apps/frontend/web/src/styles/globals.css`; dark/gold tokens already exist (`--color-body`, `--color-card`, `--color-title`, `--color-accent`, glow shadows, `landing-card-glow`, `hero-number-glow`).
- Existing analytics are lightweight Plausible events via `apps/frontend/web/src/lib/analytics.ts`: `landing_view` and `landing_cta_click`. No new external tools are required.
- Available public assets include concept art and icon assets (`hero.webp`, feature icons, `howit-*`, `pattern-bg.webp`, logo) plus some app imagery (`empty-dashboard.webp`, `onboarding-welcome.webp`, etc.). There is no clearly named real landing screenshot asset yet.

### Proposed Revised Page Structure / Order

- [x] 1. `NavBar` — conversion-focused links: `Cómo funciona`, `Programas`, `Gratis`, `FAQ`, plus CTA `Crear mi plan gratis` / `Create my free plan`.
- [x] 2. `HeroSection` — descriptive product-first H1, clear promise, primary CTA, secondary anchor, trust microcopy, and real product UI / high-fidelity tracker preview above the fold; concept art becomes decorative/secondary.
- [x] 3. `ProblemSection` — problem/solution narrative before features.
- [x] 4. `MetricsSection` / proof bar — dynamic catalog stats plus proxy proof: free, proven-program catalog credibility, sync, Discord/GitHub/community/open-source credibility.
- [x] 5. `HowItWorksSection` — concrete 3-step flow before the feature grid.
- [x] 6. `MidPageCtaSection` — repeated CTA after visitors understand the workflow.
- [x] 7. `FeaturesSection` — benefit-led cards tied to outcomes, not generic features.
- [x] 8. `ProgramsSection` — catalog proof and method credibility.
- [x] 9. `ScienceSection` — support the promise with progressive overload/adaptation rationale.
- [x] 10. `FreeTrustSection` — pricing/trust block explaining “free” clearly.
- [x] 11. `ComparisonSection` — compare Gravity Room vs notebook/spreadsheets/generic trackers.
- [x] 12. `FAQSection` — handle objections.
- [x] 13. `FinalCtaSection` — final CTA repeats the hero promise and microcopy.

### Concrete Spanish Copy Direction

Use this as the implementation copy baseline; English must mirror the same claims and specificity, not merely translate the old page.

**Hero**

- Badge: `100% gratis · Sin tarjeta · Sin suscripción`
- H1: `Tu plan de fuerza con progresión automática, gratis.`
- Supporting brand line, optional smaller text: `Entrena mejor. Progresa más rápido.`
- Subtitle: `Gravity Room te dice qué ejercicio hacer, cuánto peso usar y cuándo subir o ajustar la carga. Sigue programas probados de fuerza e hipertrofia sin hojas de cálculo ni adivinanzas.`
- Primary CTA: `Crear mi plan gratis →`
- Secondary CTA: `Ver cómo funciona`
- Microcopy: `Sin tarjeta · Sin suscripción · Listo en 2 minutos`
- Proof chips: `Programas probados`, `Sincroniza entre dispositivos`, `Catálogo listo para empezar`, `Comunidad en Discord`

**Problem / Solution**

- Eyebrow: `El problema`
- Title: `No necesitas más motivación. Necesitas un plan que decida contigo.`
- Problem bullets:
  - `Llegas al gym sin saber si subir peso o repetir.`
  - `Anotas series en notas, hojas de cálculo o apps que no entienden tu programa.`
  - `Cuando fallas reps, no sabes si bajar carga, repetir o cambiar el esquema.`
- Solution title: `Gravity Room convierte tu programa en instrucciones claras para cada sesión.`
- Solution body: `Elige un programa, registra lo que hiciste y la app calcula el siguiente entrenamiento para que la progresión siga avanzando.`

**How It Works**

- Title: `De cero a tu primera semana en 3 pasos.`
- Step 1: `Elige un programa del catálogo` — `Selecciona días por semana, objetivo y nivel.`
- Step 2: `Introduce tus pesos iniciales` — `La app arma tus entrenamientos con series, reps y cargas.`
- Step 3: `Registra tus sets y progresa` — `Si cumples, sube la carga. Si fallas, ajusta sin romper el plan.`

**Benefit-led Features**

- Title: `Diseñado para que no pierdas progreso por decidir de más.`
- Cards:
  - `Siempre sabes qué peso toca` — `Cada sesión muestra ejercicio, series, reps y carga objetivo.`
  - `Los fallos tienen reglas` — `La app aplica el ajuste del programa cuando no completas las reps.`
  - `Ves si realmente estás más fuerte` — `Historial y gráficas muestran tu curva de fuerza por ejercicio.`
  - `Tu plan viaja contigo` — `Sincroniza datos entre dispositivos para entrenar donde estés.`

**Free Trust / Pricing**

- Title: `Gratis de verdad. Sin letra pequeña.`
- Body: `Empieza, crea tu plan y registra entrenamientos sin tarjeta, suscripción ni periodo de prueba.`
- Trust bullets: `Sin tarjeta`, `Sin suscripción`, `Tus datos sincronizados`, `Puedes unirte a Discord si quieres ayuda`.
- CTA: `Crear mi plan gratis →`

**Comparison**

- Title: `Menos fricción que notas, hojas de cálculo o trackers genéricos.`
- Rows: `Te dice qué hacer hoy`, `Ajusta cargas al fallar`, `Incluye programas probados`, `Historial y gráficas`, `Sin tarjeta / gratis`.
- Columns: `Gravity Room`, `Notas / papel`, `Hoja de cálculo`, `Tracker genérico`.

**FAQ**

- `¿De verdad es gratis?` — `Sí. No pedimos tarjeta ni hay suscripción para empezar a entrenar.`
- `¿Necesito conocer los métodos de progresión?` — `No. Puedes elegir un programa y la app te guía sesión por sesión.`
- `¿Sirve si soy principiante?` — `Sí. Empiezas con pesos iniciales realistas y progresión clara.`
- `¿Qué pasa si fallo repeticiones?` — `Registras el resultado y Gravity Room aplica las reglas del programa para la próxima sesión.`
- `¿Puedo usarlo en móvil y desktop?` — `Sí. La landing debe prometer sincronización si el producto mantiene sesión y datos en la nube.`
- `¿Está disponible en español e inglés?` — `Sí. La landing y la experiencia web tienen rutas ES/EN; mantener copy equivalente.`

## Objectives

### Core Objective

Increase landing-page clarity and conversion intent by making the product, user problem, workflow, proof, price/trust, and objections obvious within the first scrolls, without changing backend behavior or diluting the Gravity Room brand.

### Deliverables

- [x] Redesigned bilingual landing page content model in `content.ts` with ES/EN parity for all sections.
- [x] Product-first hero with descriptive H1, specific subtitle, conversion CTA copy, microcopy, proof chips, and early product UI.
- [x] New conversion sections: `ProblemSection`, `MidPageCtaSection`, `FreeTrustSection`, `ComparisonSection`, and `FAQSection`.
- [x] Updated section order in `LandingPageShell` and conversion-focused nav/footer anchors.
- [x] Benefit-led feature copy and concrete three-step flow.
- [x] Reused dark/gold brand styling with no heavy dependencies and no backend changes.
- [x] CTA tracking remains available through existing `landing_cta_click` with distinct `location` props.

### Definition of Done

- [x] `/` communicates “free automatic-progression weightlifting program tracker” within the hero without needing to scroll.
- [x] `/en` has equivalent structure, intent, and specificity to `/`; no Spanish-only section exists.
- [x] Product UI or a high-fidelity in-app tracker preview is visible above the fold; `/hero.webp` is no longer the only early visual.
- [x] Problem/solution appears before the feature grid.
- [x] CTA copy uses the promise (`Crear mi plan gratis`, `Create my free plan`) and microcopy (`Sin tarjeta · Sin suscripción · Listo en 2 minutos`) appears near major CTAs.
- [x] Page includes proof/proxy-proof, free/pricing trust, comparison, FAQ, and repeated CTAs.
- [x] Run `bun run --filter web typecheck` successfully.
- [x] Run `bun run --filter web lint` successfully.
- [x] Run `bun run --filter web build` successfully.
- [x] Manually verify `/` and `/en` on mobile and desktop widths.

### Guardrails (Must NOT)

- Do not add external paid CRO/analytics tools, heatmaps, or heavy dependencies as part of this redesign.
- Do not make backend/API/database changes unless execution discovers an unavoidable frontend contract issue.
- Do not invent testimonials, user counts, revenue claims, or unsupported conversion claims.
- Do not remove the dark/gold gym/anime-inspired aesthetic; improve hierarchy while preserving the brand system.
- Do not reintroduce removed deployment/Docker/CI infrastructure.
- Do not create security-sensitive changes; this is a public marketing-page redesign.

## TODOs

- [x] 1. Expand the landing content model for conversion sections
     **What**: Add typed content interfaces for the new narrative and trust sections, then populate `ES_CONTENT` and `EN_CONTENT` with equivalent copy. Keep copy centralized rather than hard-coded in components. Suggested new interfaces: `ProofItem`, `HeroContent` additions (`kicker`, `microcopy`, `proofItems`, product preview labels), `ProblemContent`, `MidPageCtaContent`, `FreeTrustContent`, `ComparisonContent`, and `FaqContent`.
     **Files**: `apps/frontend/web/src/features/landing/content.ts`
     **Acceptance**: TypeScript content object includes every section consumed by the shell; ES and EN have the same keys and array lengths where sections render parallel UI.

- [x] 2. Create or extract a reusable product preview shown above the fold
     **What**: Move the existing inline `AppPreview` from `features-section.tsx` into a reusable `ProductPreview` component, then upgrade the labels to be content-driven or language-neutral enough for both routes. Prefer a real app screenshot asset if available during execution; otherwise use the high-fidelity tracker preview and make it visually read as actual product UI, not fantasy concept art. Keep `/hero.webp` as optional atmospheric/decorative art below or behind the product frame, not the main explanatory visual.
     **Files**: `apps/frontend/web/src/features/landing/product-preview.tsx`, `apps/frontend/web/src/features/landing/features-section.tsx`, `apps/frontend/web/src/features/landing/hero-section.tsx`; optional manual asset: `apps/frontend/web/public/landing-product-preview.webp` (capture/generate outside code edits if desired)
     **Acceptance**: Hero imports/renders product UI; feature section no longer owns the only app preview; if `landing-product-preview.webp` cannot be created, implementation explicitly uses `ProductPreview` markup or an existing app asset such as `empty-dashboard.webp` / `onboarding-welcome.webp`, and does not reference a missing asset.

- [x] 3. Rewrite and restructure the hero around a descriptive product promise
     **What**: Update `HeroSection` to use a product-first H1, supporting slogan, CTA microcopy, proof chips, and a two-column desktop layout (`copy + preview`) that stacks cleanly on mobile. Track primary CTA clicks with `trackEvent('landing_cta_click', { location: 'hero_primary' })`; track secondary anchor only if it remains a conversion-relevant event using the same existing event type.
     **Files**: `apps/frontend/web/src/features/landing/hero-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`
     **Acceptance**: Above the fold answers what the product is, who it is for, what the user gets, why it is safe to start, and what to click next within 5 seconds.

- [x] 4. Add `ProblemSection` immediately after the hero
     **What**: Build a problem/solution section using the concrete Spanish copy direction and EN parity. Use a split layout: left side pain points, right side solution card showing “before → after” or “improvisar → programa calculado”. Reuse `SectionLabel`, `SECTION_PAD`, `FadeUp`, `StaggerContainer`, and existing dark/gold cards.
     **Files**: `apps/frontend/web/src/features/landing/problem-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`, `apps/frontend/web/src/features/landing/landing-page-shell.tsx`
     **Acceptance**: Problem narrative renders before metrics/features and clearly frames why automatic progression matters before listing product capabilities.

- [x] 5. Reframe `MetricsSection` as proxy proof, not just stats
     **What**: Keep the dynamic catalog-derived counts (`programCount`, `minDaysPerWeek`, `totalWorkouts`) but adjust labels/copy so the row supports credibility and trust: catalog depth, free access, flexible schedule, and workout coverage. Add small supporting text where useful, but do not invent unsupported active-user numbers or testimonials.
     **Files**: `apps/frontend/web/src/features/landing/metrics-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`
     **Acceptance**: The section functions as “proof/proxy proof” directly after the problem or hero area and avoids unsupported social-proof claims.

- [x] 6. Make the 3-step flow concrete and place it earlier
     **What**: Update `HowItWorksSection` copy and layout to focus on the actual user journey: choose a program, enter starting weights, log sets/results so the app adjusts the next session. Reduce abstract motivational quotes if they compete with clarity; keep one brand-flavored line only if hierarchy remains clear.
     **Files**: `apps/frontend/web/src/features/landing/how-it-works-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`, `apps/frontend/web/src/features/landing/landing-page-shell.tsx`
     **Acceptance**: A new visitor can describe the onboarding flow from the section alone; section appears before the feature grid in the final order.

- [x] 7. Add `MidPageCtaSection` after the workflow
     **What**: Add a compact CTA band after `HowItWorksSection` that repeats the promise once the user understands the flow. Suggested Spanish copy: `Tu primera semana puede estar lista en 2 minutos.` CTA `Crear mi plan gratis →`, microcopy `Sin tarjeta · Sin suscripción`. Track clicks with `location: 'mid_page_cta'`.
     **Files**: `apps/frontend/web/src/features/landing/mid-page-cta-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`, `apps/frontend/web/src/features/landing/landing-page-shell.tsx`
     **Acceptance**: Mid-page CTA is visually lighter than the hero/final CTA, accessible, and does not feel like a duplicate hero block.

- [x] 8. Rewrite features as benefit-led outcomes
     **What**: Keep the existing four-card grid and icon assets but replace generic feature names with outcome-driven copy from the Spanish copy direction. If `ProductPreview` was extracted, remove the old preview block from the bottom of the feature section or replace it with a focused “what you see in-session” callout that does not duplicate the hero.
     **Files**: `apps/frontend/web/src/features/landing/features-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`
     **Acceptance**: Each card title states a user benefit; each description names a concrete behavior/output of the app.

- [x] 9. Tune programs and science for credibility without overclaiming
     **What**: Keep `ProgramsSection` dynamic catalog rendering but adjust copy to make it a credibility/catalog section (`Programas probados listos para empezar`) rather than only a library. Keep `ScienceSection`, but position it after product/workflow sections and make body copy support progressive overload, failure handling, and reduced decision fatigue without claiming medical/scientific certification.
     **Files**: `apps/frontend/web/src/features/landing/programs-section.tsx`, `apps/frontend/web/src/features/landing/science-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`, `apps/frontend/web/src/features/landing/landing-page-shell.tsx`
     **Acceptance**: Programs/science support trust and method credibility; they do not block early conversion clarity.

- [x] 10. Add `FreeTrustSection` for pricing/objection handling
      **What**: Create a pricing/trust block that explicitly answers “what does free mean?” Use a card/table visual with `Gratis de verdad`, `0 €`, `Sin tarjeta`, `Sin suscripción`, `Listo en 2 minutos`, and CTA. Keep it honest: no promises about paid tiers unless already product-approved.
      **Files**: `apps/frontend/web/src/features/landing/free-trust-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`, `apps/frontend/web/src/features/landing/landing-page-shell.tsx`
      **Acceptance**: Pricing trust is visible before FAQ/final CTA and resolves the “free trial?” objection without unsupported claims.

- [x] 11. Add `ComparisonSection`
      **What**: Create a responsive comparison table/card stack comparing Gravity Room to `Notas / papel`, `Hoja de cálculo`, and `Tracker genérico`. Rows should focus on conversion-relevant differences: tells you what to do today, adjusts after failure, includes proven programs, sync/history, and free/no card. On small screens, use stacked cards or horizontal-safe layout to avoid overflow.
      **Files**: `apps/frontend/web/src/features/landing/comparison-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`, `apps/frontend/web/src/features/landing/landing-page-shell.tsx`
      **Acceptance**: Table is readable at mobile widths, uses accessible table semantics if rendered as a table, and avoids attacking competitors with unverifiable claims.

- [x] 12. Add `FAQSection`
      **What**: Create an objection-handling FAQ near the bottom. Use native `<details>/<summary>` for lightweight accessible disclosure unless the project already has a preferred accordion primitive. Include at least six ES/EN questions covering free pricing, whether users need to understand progression methods, beginner suitability, failed reps, mobile/desktop sync, and language availability.
      **Files**: `apps/frontend/web/src/features/landing/faq-section.tsx`, `apps/frontend/web/src/features/landing/content.ts`, `apps/frontend/web/src/features/landing/landing-page-shell.tsx`
      **Acceptance**: FAQ is keyboard-accessible, no new dependency is added, and answers stay truthful to existing product behavior.

- [x] 13. Update final CTA and nav/footer anchors for the new conversion path
      **What**: Rewrite `FinalCtaSection` to match the hero promise and microcopy (`Crear mi plan gratis`, not generic “Comienza gratis”). Update `NavBar` labels and links to the most conversion-relevant sections; update `SECTION_IDS` for scroll-spy to match those anchors; ensure footer links mirror the final section IDs without overwhelming the nav.
      **Files**: `apps/frontend/web/src/features/landing/final-cta-section.tsx`, `apps/frontend/web/src/features/landing/nav-bar.tsx`, `apps/frontend/web/src/features/landing/shared.tsx`, `apps/frontend/web/src/features/landing/content.ts`, `apps/frontend/web/src/features/landing/landing-page-shell.tsx`
      **Acceptance**: Desktop and mobile nav links scroll to existing IDs; active-section highlighting still works; CTA text is consistent across hero/mid/final blocks.

- [x] 14. Refresh SEO/head metadata for descriptive positioning
      **What**: Update Spanish and English head titles/descriptions to match the new product-first promise. Suggested ES title: `Gravity Room — Planes de fuerza gratis con progresión automática`; ES description: `Crea un plan de fuerza gratis, sigue programas probados y deja que Gravity Room calcule pesos, series y ajustes de cada entrenamiento.` Suggested EN equivalents should preserve intent and length.
      **Files**: `apps/frontend/web/src/features/landing/index.tsx`, `apps/frontend/web/src/features/landing/landing-page-en.tsx`
      **Acceptance**: Metadata is more descriptive than slogan-first copy and remains accurate for both locales.

- [x] 15. Preserve brand polish and accessibility while adding sections
      **What**: Use existing CSS tokens/classes where possible. Add only small landing-specific CSS if utilities become repetitive (for example, product-frame glow or comparison check/cross styling). Respect reduced-motion patterns already used by `motion/react`. Ensure headings are hierarchical, images have meaningful alt text only when informative, and CTAs have visible focus states.
      **Files**: `apps/frontend/web/src/styles/globals.css`, `apps/frontend/web/src/features/landing/*.tsx`
      **Acceptance**: New sections visually match the current dark/gold system, do not introduce layout shift-heavy media, and remain usable with keyboard and reduced-motion settings.

- [x] 16. Keep analytics lightweight and defer external CRO tooling
      **What**: Reuse `landing_cta_click` with distinct `location` props (`hero_primary`, `hero_secondary`, `mid_page_cta`, `free_trust`, `final_cta`) instead of adding new dependencies. Document optional future analytics/Clarity exploration outside this implementation if desired, but do not install Clarity or a heatmap tool now.
      **Files**: `apps/frontend/web/src/features/landing/hero-section.tsx`, `apps/frontend/web/src/features/landing/mid-page-cta-section.tsx`, `apps/frontend/web/src/features/landing/free-trust-section.tsx`, `apps/frontend/web/src/features/landing/final-cta-section.tsx`, `apps/frontend/web/src/lib/analytics.ts`
      **Acceptance**: CTA tracking compiles with existing `AnalyticsEvent` typing; no new external script is introduced.

- [x] 17. Verify implementation locally
      **What**: Run focused checks and inspect both locale routes at common responsive widths. If failures occur, fix them in the relevant implementation files before marking complete.
      **Acceptance**: `bun run --filter web typecheck`, `bun run --filter web lint`, and `bun run --filter web build` all pass; manual review confirms `/` and `/en` have equivalent sections, no broken anchors, no missing images, and no horizontal overflow on mobile.

## Verification

- [x] Run `bun run --filter web typecheck`.
- [x] Run `bun run --filter web lint`.
- [x] Run `bun run --filter web build`.
- [x] Start the web app with `bun run dev` and inspect `/`.
- [x] Inspect `/en` for English parity and no untranslated Spanish copy.
- [x] Check mobile width around 360–430px for hero layout, comparison table/card behavior, nav menu, CTA visibility, and no horizontal scroll.
- [x] Check desktop width around 1280–1440px for above-the-fold clarity, product preview position, section rhythm, and brand consistency.
- [x] Confirm all nav/footer anchor links target existing IDs after `SECTION_IDS` changes.
- [x] Confirm every major CTA routes to `/login` and uses the updated CTA promise copy.
- [x] Confirm no unsupported testimonials, fake user counts, fake ratings, or paid-tool scripts were added.
- [x] Confirm no backend, database, auth, deployment, Docker, or CI files were changed.

## Risks / Tradeoffs

- Testimonials are unavailable, so the redesign must use honest proxy proof: catalog stats, proven-program/progressive-overload credibility, free/no-card trust, Discord/GitHub/community links, and product UI clarity. Do not fabricate reviews.
- A real product screenshot asset may not be available. Best path is to capture/create `apps/frontend/web/public/landing-product-preview.webp` manually; fallback is extracting and polishing the existing tracker preview component or using an existing app asset such as `empty-dashboard.webp` / `onboarding-welcome.webp`. The fallback is less persuasive than a real screenshot but still better than concept art alone.
- Bilingual copy drift is a risk because `content.ts` will grow. Keep ES/EN arrays structurally parallel and review both routes together.
- Adding more sections can make the page feel long. Mitigate with a clear order, repeated CTAs, concise copy, and nav links to high-intent sections.
- Nav SEO vs conversion tradeoff: fewer nav links improves focus, but footer can retain broader links. Prefer conversion-critical anchors in the sticky nav.
- Comparison tables can overflow on mobile. Use responsive card stacks or carefully constrained table styles.
- Existing dynamic catalog stats may render placeholders (`—`) before API data loads. Keep placeholders graceful and do not make claims dependent on unavailable data.
- More motion/visual polish can hurt performance. Reuse existing reduced-motion-aware primitives and avoid large new assets unless optimized WebP dimensions are appropriate.
