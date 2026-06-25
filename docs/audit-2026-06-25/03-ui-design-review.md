# UI / Design Review - Gravity Room web app

Date: 2026-06-25
Reviewer: senior product designer + front-end UI review pass
Method: live E2E via Playwright (desktop 1280x800 and mobile 390x844) plus code-level review of the Tailwind 4 theme, shared components, and feature screens.
Scope: design and UI only. Report-only - no code was changed.

Screenshots referenced below live in `.playwright-mcp/` (filenames prefixed `audit-`).

---

## 1. Summary and overall impression

Gravity Room has a genuinely strong, opinionated visual identity.
The "Forged Iron" dark theme is well-codified in `apps/frontend/web/src/styles/globals.css`: a warm-neutral iron surface ladder, a single scarce gold accent, condensed Bebas Neue display type, Barlow body, and JetBrains Mono for data.
The marketing landing page and the in-app Profile and Home dashboards are the high points - confident hierarchy, good display typography, tasteful use of the gold accent, thoughtful microcopy, and a coherent Dragon-Ball-flavoured voice ("ENTRAR AL HIERRO", "Consejo del Sensei").

The system is let down in three repeating ways:

1. The design system's central rule - "gold is the only accent voice" - is broken in code by a separate set of loud, saturated, off-brand category colors (blue / purple / red), which then leak into the landing and the in-app catalog.
2. Action hierarchy is inverted in several primary flows: the secondary action is rendered gold (primary) and the actual primary action is rendered as a ghost/outline.
3. Layout polish is uneven. The core Tracker table is visibly stretched and sparse on desktop, the mobile nav drawer has a real layering/overlap bug, and empty states are inconsistently designed (some are full kicker+heading+CTA compositions, others are bare centered text in a void).

None of these are catastrophic, but for an owner who wants pixel-perfection they are the gap between "good" and "polished".
The single highest-impact improvement is fixing the inverted primary/secondary button hierarchy in the program-start and tracker-setup flows - it actively steers users away from the conversion action and contradicts the whole accent system.

---

## 2. Findings by severity

### High

#### H1. Inverted primary/secondary action hierarchy in the program flows

- Where: `/app/programs` program cards, and the tracker setup screen `/app/tracker/{id}`. Components: `apps/frontend/web/src/features/programs/*`, `apps/frontend/web/src/features/tracker/weight-field`/setup, `apps/frontend/web/src/components/button.tsx`.
- What: On each program card, "VISTA PREVIA" (Preview, a secondary action) is the gold filled button and "INICIAR PROGRAMA" (Start, the primary conversion action) is the outline/secondary button. See `audit-app-programs-desktop.png`. On the tracker setup screen, "Generar Programa" - the only and primary action - is rendered as a transparent/ghost button with plain white text and reads as disabled. See `audit-tracker-setup-form-desktop.png`.
- Why it matters: Gold is defined as the scarce "do this" signal (`globals.css` accent comments, `button.tsx` variant doc). Making Preview gold and Start non-gold inverts that promise, pulls the eye to the wrong action, and undercuts conversion on the most important in-app step.
- Recommendation: Make the true primary action the gold `primary` button in each case (Start Program, Generate Program). Demote Preview to the `default` outline treatment. Audit all screens for one - and only one - gold button per view.

#### H2. Off-palette category colors break the "gold is the only accent" system (systemic)

- Where: `apps/frontend/web/src/lib/category-colors.ts`; rendered on landing program cards (`audit-landing-programs.png`) and the `/app/programs` catalog (`audit-app-programs-desktop.png`) as the "FUERZA" / "HIPERTROFIA" / "POWERLIFTING" tags.
- What: The category palette hard-codes `strength: #4a90d9` (blue), `hypertrophy: #9b59b6` (purple), `powerlifting: #e05050` (red). These are bright, generic web hues with no relation to the Forged-Iron OKLCH ladder. They are the only saturated non-gold colors in the product and they appear on a high-traffic surface.
- Why it matters: The theme's entire thesis (see `globals.css` header comments and the `Tag` component, which only offers `default/gold/ok/fail` tones) is that gold is the single accent and hierarchy is carried by hairline rules. Three loud category hues read as from a different design system and cheapen the otherwise-disciplined palette.
- Recommendation: Re-derive category accents inside the OKLCH system - e.g. a dim warm-gold for the default and muted iron variants for the others, or drop color entirely and differentiate category by the existing mono kicker text. If category color must be retained for scanability, pull all three toward the warm hue family and drop saturation/chroma dramatically so they sit on the iron ladder.

#### H3. Mobile nav drawer has a layering / overlap bug

- Where: `apps/frontend/web/src/components/layout/app-sidebar.tsx` (mobile overlay branch) over the Tracker page. See `audit-mobile-drawer.png`.
- What: With the drawer open over the Tracker, the page's sticky tracker toolbar (DESHACER / "3x" / overflow) bleeds through at the top of the drawer, and the first nav item "INICIO" (Home) is not visible - it is occluded/clipped at the top of the nav list. Separately, Playwright could not click the drawer's "Cerrar menú" (close) button because the drawer-header logo `<img>` intercepts the pointer events over it (the logo and the close affordance overlap).
- Why it matters: The home link being hidden and the close button being un-clickable are functional navigation failures on the primary device class (a gym app is used on a phone). The scrim is also weak (`bg-black/60`) so the page content stays distractingly visible behind the drawer.
- Recommendation: Ensure the drawer overlay sits above any page-level sticky toolbar (raise drawer z-index / lock body scroll while open), guarantee the full nav list including "INICIO" is rendered and not clipped by the header/`overflow-hidden`, and resolve the logo-vs-close-button overlap in the drawer header so the close target is reliably hittable. Consider a darker scrim.

#### H4. Profile progression charts render a full projected trajectory that looks like real data

- Where: `/app/profile` "Progresión de Peso" line charts. See `audit-profile-full-desktop.png`. Components under `apps/frontend/web/src/features/profile/profile-charts-section.tsx` + `components/charts/line-chart.tsx`.
- What: After a single completed workout, the Sentadilla and Press Banca charts draw a smooth diagonal line climbing across "#1 … #89" up to ~115 kg. The one real data point (a gold diamond at #1) sits at the bottom-left; everything above it is the program's planned projection rendered identically to actual data.
- Why it matters: It reads as if the user has already trained to 115 kg. Presenting a forecast in the same visual language as logged history is misleading and erodes trust in the stats. There is also an x-axis tick collision at the origin: "#1#1" / "#3#1" overprint at the bottom-left of both charts.
- Recommendation: Visually distinguish projected vs actual - e.g. a dashed/dimmed line for the forecast and a solid gold line + markers for logged sessions, with a one-line legend. Fix the overlapping origin tick labels (dedupe the first tick or add tick spacing / `minTickGap`).

### Medium

#### M1. Tracker data table is stretched and sparse on desktop

- Where: `/app/tracker/{id}` Programa tab, exercise tables. See `audit-tracker-grid-desktop.png` and `audit-tracker-day-complete.png`; contrast with `audit-tracker-mobile.png`.
- What: On a 1280px desktop the SERIE / KG / REPS columns are spread edge-to-edge with large dead gaps between them; the actual data ("2.5", "3") floats in space and is hard to scan as rows. The same table is well-proportioned at 390px (`audit-tracker-mobile.png`), confirming the layout was tuned for mobile and merely stretched on desktop. There is also a wide unused left margin before the content column begins.
- Why it matters: The Tracker is the core surface. Sparse, stretched tables read as unfinished and make set-by-set scanning harder on desktop.
- Recommendation: Cap the table/data column width (or center the data columns) so KG/REPS sit close to SERIE, and reclaim the dead horizontal space - either narrower centered cards or use the room for extra context (target reps, last session, RPE) rather than empty gap.

#### M2. Completed exercises discard their logged reps in the UI

- Where: Tracker, after marking an exercise success/fail. See `audit-tracker-day-complete.png`.
- What: Once an exercise is marked, the whole table collapses every Reps cell to a dash ("—"). The reps you actually performed are no longer shown; the row is reduced to weight + dashes plus an AMRAP stepper and RPE select.
- Why it matters: Users lose at-a-glance confirmation of what they logged for that session, which is exactly the information a tracker exists to retain.
- Recommendation: Keep the logged reps visible (greyed/struck-through is fine) after completion, or show a compact "5×3 @ 2.5 ✓" summary line, so the completed state still communicates what was done.

#### M3. Empty states are inconsistent and several are under-designed

- Where: Tracker → Estadísticas (`audit-tracker-stats-empty.png`), Insights (`audit-insights-empty-desktop.png`), Home no-program (`audit-app-home-empty-desktop.png`, `audit-login-mobile.png`), Home active "Actividad reciente".
- What: There is no shared empty-state pattern. `home-empty-state.tsx` is a full composition (kicker + Bebas heading + body + gold CTA) and the Insights card is similar and good. But the Tracker stats empty state is just two lines of centered grey text floating in a large black void with no kicker, icon, or anchor. None of the empty states use an icon/illustration, and most leave a very large empty area below a shallow card.
- Why it matters: Empty states are a new user's first impression of each surface; the bare text-only ones look broken/unfinished next to the polished ones.
- Recommendation: Extract one `EmptyState` component (icon or chalk-stamp kicker + display heading + body + optional CTA) and use it everywhere. Vertically center empty states within their viewport area so a single card does not float at the top of a tall void.

#### M4. RPE selector is a raw native `<select>` and clashes with the custom controls

- Where: `apps/frontend/web/src/features/program-view/rpe-select.tsx`; visible in `audit-tracker-day-complete.png`.
- What: RPE uses a bare HTML `<select>` with the OS-native chevron and native dropdown popup, sitting directly beside the bespoke number steppers (custom −/+ buttons). The two controls in the same row look like they belong to different toolkits.
- Why it matters: Native selects render with platform chrome (font, chevron, popup) that ignores the dark theme and breaks the otherwise-custom, consistent control language.
- Recommendation: Reuse the existing styled select (`components/select-field.tsx`) or a small custom popover/segmented control consistent with the steppers and the rest of the tracker.

#### M5. Number-input double controls (native spinner over custom steppers)

- Where: Tracker setup "Pesos Iniciales". See `audit-tracker-setup-form-desktop.png` (focused Sentadilla field).
- What: The weight fields render the browser's native number-input up/down spinner arrows inside the field, on top of the custom −/+ stepper buttons that flank it. The focused field shows both sets of controls at once.
- Why it matters: Duplicate, mismatched controls are a clear polish defect and can confuse tap/click targets.
- Recommendation: Suppress the native spinner (`appearance: none` / `::-webkit-inner-spin-button`) when wrapping number inputs with custom steppers.

#### M6. Landing metrics flash "0" before async data loads

- Where: Landing metrics section. Component `apps/frontend/web/src/features/landing/metrics-section.tsx`. See `audit-landing-problem-metrics.png` (loaded state shows 18 / 1444).
- What: On first paint the catalog stats render as hard zeros ("0 Programas en el Catálogo", "0 Entrenamientos") and then count up to the real values (18 / 1444) once the catalog query resolves. A first-time visitor can briefly see "0 programs", which directly contradicts the page's pitch.
- Why it matters: "0 programs in the catalog" on the marketing page is an actively damaging flash-of-wrong-data on the most important acquisition surface.
- Recommendation: Render a skeleton/placeholder (or hide the numerals) until the count is known, then animate the count-up. Never start the count-up from a literal 0 that reads as real data.

#### M7. `/ejercicios` (Exercise Wiki) drops the app shell for logged-in users

- Where: `/ejercicios` reached from the in-app sidebar "Ejercicios". See `audit-ejercicios-index-desktop.png`.
- What: The exercise wiki uses the public marketing shell (a top banner), not the app sidebar shell. A signed-in user clicking "Ejercicios" in the sidebar lands on a page with no sidebar and loses the app navigation entirely; the content is also narrow/centered with very large empty side margins on desktop.
- Why it matters: Losing the primary nav mid-session is a jarring shell discontinuity and makes the wiki feel like a different site.
- Recommendation: When entered from within `/app`, render the wiki inside the app shell (keep the sidebar), or add a clear "back to app" affordance and widen the content to use the available canvas.

### Low

#### L1. FAQ kicker duplicates the heading text

- Where: Landing FAQ. See `audit-landing-faq.png`. The section label kicker reads "PREGUNTAS FRECUENTES" and the H2 immediately below is also "PREGUNTAS FRECUENTES".
- Why it matters: The kicker/heading pattern elsewhere uses distinct kicker vs title (e.g. "Catálogo de Programas" over "Programas probados…"). Repeating the same words wastes the hierarchy and looks like a placeholder.
- Recommendation: Give the FAQ a distinct kicker (e.g. "Dudas comunes") or drop the kicker for this section.

#### L2. Insights kicker is wrong/leftover copy

- Where: `/app/insights` header. See `audit-insights-empty-desktop.png`.
- What: The kicker above "ANÁLISIS" reads "ÚLTIMAS 12 SEMANAS" (Last 12 weeks) - the dashboard's heatmap kicker - even though this page shows no data and no 12-week window.
- Recommendation: Replace with an Insights-appropriate kicker or remove it.

#### L3. Keyboard-shortcuts modal fires at the wrong moment

- Where: Tracker, on first entry. See `audit-tracker-setup-desktop.png`.
- What: The "ATAJOS DE TECLADO" (keyboard shortcuts) dialog opens immediately on entering the tracker - while the user is still on the starting-weights setup screen, before any program/grid exists for the shortcuts to act on. The dialog body is also left-aligned while its "ENTENDIDO" button is right-aligned.
- Recommendation: Defer the shortcuts hint until the grid is generated (or make it dismissible/non-blocking), and align the action button with the dialog content rhythm.

#### L4. Undo affordances are multiple and the counter desyncs

- Where: Tracker toolbar (`apps/frontend/web/src/features/tracker/toolbar.tsx`), inline "✓ Deshacer" buttons, and the toast "Deshacer".
- What: After marking results there are three different undo affordances (toolbar, inline, toast). The toolbar "DESHACER" stayed disabled after the first confirmed set, and the "Nx" counter lagged the number of actions taken (showed 1x after two actions, 2x after three).
- Why it matters: Multiple competing undo controls plus a counter that does not match user actions is confusing and undermines confidence in undo.
- Recommendation: Settle on one canonical undo surface (toolbar + transient toast is a common, sufficient pairing), and make the counter reflect the true number of undoable steps.

#### L5. Orphaned dashboard footer links

- Where: Home dashboard, bottom. See `audit-app-home-active-desktop.png`.
- What: "Ver estadísticas en Perfil →" and "Cambia el idioma en Perfil →" are tiny plain-text links floating at the bottom-left, visually disconnected from the cards above.
- Recommendation: Either fold these into the relevant cards/settings or give them a deliberate "quick links" treatment so they do not read as leftover.

#### L6. Low-contrast supporting text

- Where: Landing hero sub-line "Sin tarjeta. Sin suscripción. Sin anuncios." and the benefit chips (`audit-landing-mobile-hero.png`); various `text-label`/`text-info` captions.
- What: `--color-label`/`--color-info` is `oklch(0.52 …)` on the near-black body - borderline for small text against WCAG AA for the size used.
- Recommendation: Spot-check the smallest label/caption text against AA (4.5:1 for <18px) and nudge the muted/label tokens up where they fall short, especially the hero reassurance line.

#### L7. Redundant email display in account settings

- Where: Profile → Cuenta. See `audit-profile-full-desktop.png`.
- What: The account email appears twice adjacent - once inside an editable "✎" button and again as a paragraph directly below it.
- Recommendation: Show the email once (the editable control), drop the duplicate paragraph.

### Nice-to-have

- N1. Hero cards (Home "DÍA UNO", landing problem panel) have a heavily weighted left column and a large empty right half; consider rebalancing (art, stat, or quote on the right) - `audit-app-home-active-desktop.png`, `audit-landing-problem-metrics.png`.
- N2. The active-program "RACHA 0 / SESIONES 0" KPI strip on Home reads as empty right after completing a session; verify the dashboard refetches so it reflects logged work, and consider a friendlier zero-state than a literal "0".
- N3. Exercise-wiki index cards are title+description only; a small muscle-group icon or thumbnail would lift them and reinforce the brand.
- N4. The disabled toolbar "DESHACER" is extremely low-contrast and hard to read as a (disabled) control; give disabled buttons a slightly clearer outline.
- N5. Bebas Neue headings show faint sub-pixel color fringing on the dark background at some zooms (no gradient is applied in code - verified there is no `bg-clip-text`/gradient utility). It is a rendering nuance, not a code defect, but worth a glance at heading antialiasing/`text-rendering` if pixel-perfection is the bar.

---

## 3. Systemic / design-system observations

- Token system is a real strength. `globals.css` is a well-thought-out `@theme` with semantic surface/text/border/accent tokens, motion tokens, reduced-motion handling, a global `:focus-visible` ring, and printed design rationale. Most components consume tokens rather than raw colors. Keep this discipline.
- The one big crack in the system is color discipline: the codebase says "gold is the only accent" (theme comments, `Tag` tones limited to default/gold/ok/fail) but `lib/category-colors.ts` introduces an entirely separate saturated blue/purple/red set that surfaces on landing + catalog (H2). This is the most important systemic fix - it is the difference between "one disciplined palette" and "two palettes fighting".
- Action hierarchy needs a documented rule, enforced. The Button component already encodes intent (`primary`/`victory` = gold CTA, `default` = secondary line). The flows just apply them backwards (H1) or skip the gold primary entirely (setup "Generar Programa"). A short "one gold primary per view, and it is the conversion action" guideline would prevent recurrence.
- Empty-state pattern is not shared. Two good implementations (`home-empty-state.tsx`, Insights) coexist with bare text-only ones (Tracker stats). Extract a single `EmptyState` primitive (M3).
- Native form controls leak through in the data-entry surfaces - native `<select>` for RPE (M4) and native number spinners over custom steppers (M5). A `select-field.tsx` already exists; routing all selects/number inputs through styled wrappers would close the consistency gap.
- Responsive strategy is mobile-first and it shows: mobile Tracker/Profile/Home are nicely tuned, while a few desktop layouts are the mobile layout stretched (Tracker table M1, wide empty margins, shallow empty-state cards). Desktop deserves its own max-width/column treatment rather than full-bleed stretch.
- Scroll-reveal on the landing: sections use `motion` `whileInView` from `opacity:0`. This is fine in a real browser, but it means a full-page screenshot (no scroll events) captures most sections as black, and on a JS error or very slow device the content could stay hidden. The resting state is correctly visible for the prerender-safe wiki animations; consider the same "resting state visible" guarantee for landing reveals as defense-in-depth.

---

## 4. Per-screen notes

### Landing `/` (and `/en`)

- Strong hero: condensed display headline, gold pressed-steel primary CTA, ghost secondary, app-preview mockup card. `audit-landing-desktop-hero.png`, `audit-landing-mobile-hero.png`.
- Problem/solution split, metrics counter (18 / 100% / 3 / 1444), 01-02-03 how-it-works timeline with AI icons, features grid, programs catalog, why-it-works, free-trust, comparison table, FAQ accordion, final CTA, footer - a complete, well-sequenced marketing page. `audit-landing-howitworks.png`, `audit-landing-programs.png`, `audit-landing-faq.png`.
- Issues: metrics flash "0" (M6), program category tags off-palette (H2), FAQ kicker duplicates heading (L1), low-contrast reassurance line (L6).

### Login `/login`

- In this session the dev session persisted, so `/login` redirected straight into `/app`. The dev-login entry path works. The login screen itself was not re-exercised; existing `login-clean.png` from earlier in the session shows the standard auth card.

### App Home `/app`

- Empty (no program): single shallow card "SIN PROGRAMA ACTIVO" with gold "VER PROGRAMAS" CTA, floating high in a tall empty viewport (M3 centering). `audit-app-home-empty-desktop.png`, `audit-login-mobile.png`.
- Active: the best in-app surface - "DÍA UNO" hero with corner ticks + gold CTA, KPI strip, 12-week heatmap, Camino al PR, "Del Maestro" quote, Actividad Reciente with good empty microcopy. `audit-app-home-active-desktop.png`. Notes: empty right half of hero (N1), orphaned footer links (L5), KPI zeros after a session (N2).

### Tracker `/app/tracker/{id}`

- Setup ("Pesos Iniciales"): clean grid of stepper fields, but "Generar Programa" is a ghost button not the gold primary (H1), native spinner over custom steppers (H1/M5), validation hint shown only on the first field, shortcuts modal mistimed (L3). `audit-tracker-setup-form-desktop.png`, `audit-tracker-setup-desktop.png`.
- Grid: gold tier badges (T1/T2/T3), accent-left active card, clear active-row highlight, good success (green) state. But stretched/sparse columns on desktop (M1), completed rows lose reps (M2), native RPE select (M4), confusing undo (L4). `audit-tracker-grid-desktop.png`, `audit-tracker-set-completed.png`, `audit-tracker-day-complete.png`.
- Stats tab empty: bare two-line text in a void (M3). `audit-tracker-stats-empty.png`.
- Mobile: noticeably better than desktop - well-proportioned tables, good tap targets, top-bar pattern. `audit-tracker-mobile.png`.

### Programs `/app/programs`

- Well-organized: grouped by level, dismissible "Consejo del Sensei", per-card preview/start. `audit-app-programs-desktop.png`.
- Issues: inverted button hierarchy (H1), off-palette category tags (H2), slight double-heading ("PROGRAMAS" page title + "ELEGIR UN PROGRAMA").

### Insights `/app/insights`

- Good empty-state card (kicker + display heading + helpful body), but the page kicker is leftover "ÚLTIMAS 12 SEMANAS" (L2) and the card floats above a large void (M3). `audit-insights-empty-desktop.png`.

### Profile `/app/profile`

- The showcase page: active-program card, achievement badges (1/5, unlocked vs locked), stats/streak/30-day/PR cards with consistent kicker+data rhythm, weight-progression charts, account settings (kg/lbs, ES/EN, danger zone). `audit-profile-full-desktop.png`, `audit-profile-mobile.png`.
- Issues: projection-as-data charts + x-axis tick collision (H4), Recharts logs `width(-1)/height(-1)` warnings on mount (charts briefly size to -1 - likely a flash of mis-sized chart; worth confirming), duplicated email (L7).

### Exercise Wiki `/ejercicios`

- Loses the app sidebar shell for logged-in users and renders narrow/centered with large empty margins (M7); only three articles (content, not design). Cards are title+description only (N3). `audit-ejercicios-index-desktop.png`.

### Mobile nav drawer

- Functional pattern (hamburger → slide-in drawer, Escape closes), but the layering bug hides "INICIO", lets the tracker toolbar bleed through, and makes the close button un-clickable due to logo overlap (H3). `audit-mobile-drawer.png`.
