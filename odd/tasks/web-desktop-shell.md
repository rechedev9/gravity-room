# Feature: web-desktop-shell (artboard 01 "Centro de mando")

Implement the chosen desktop design for the Gravity Room web app (apps/frontend/web) at lg+ (≥1024px). The visual spec is `design/web-desktop-shell/01-centro-de-mando.html`; the tokens come from `design/system.md`.
Branch `feat/web-desktop-shell`, base `35b31e5d`. Below lg nothing changes. Commits are work units of about 400 changed lines, Conventional Commits.

## Specs

- **S1** (handoff, verbatim): "Implement it in the project's real stack. Use the artboard as the visual spec: map its parts to the project's existing components and styles, and do not copy the artboard HTML verbatim."
- **S2** (handoff, verbatim): "Take colors, typography, spacing, radius and shadows from design/system.md, the project's token source."
- **S3** (user decision, verbatim): "Dejarla como está; cambia solo desktop (Recomendado)" — "El teléfono mantiene su barra inferior y vistas actuales; desktop (lg+) recibe el diseño 01."
  - Below 1024px the bottom nav, Home and tracker render exactly as before.
- **S4** (user decision, verbatim): "Sí, versión mínima" — "Paleta para ir a secciones, saltar a un día del programa y buscar ejercicios del catálogo. Una tarea más con su propio commit."
- **S5** (user, verbatim, the motivation): "deberia tener su propia interfaz grafica para la web"; identity: "Mantenerla y pulirla".
- **S6** Shell at lg+, per the artboard:
  - A sidebar with the "GRAVITY ROOM" wordmark and the nav "Hoy" (/app), "Entrenar" (/app/tracker), "Programas" (/app/programs), "Progreso" (/app/insights), "Ejercicios" (/app/exercises), with a gold left edge on the active item.
  - At the bottom: the active-program card ("GZCLP · Día 8 de 90" style, progress bar, "Semana N").
  - An account row that opens the "Cuenta" menu: Perfil, Unidades (kg/lbs), Idioma, Tema, Cerrar sesión.
  - A slim top bar with the page title and the "Buscar o ir a… ⌘K" field.
  - Guests keep the "Crear cuenta" entry, and Progreso/Perfil stay hidden for them as today.
- **S7** Hoy (/app) at lg+, per the artboard:
  - A one-line greeting built from real data (e.g. "Viernes. Toca peso muerto pesado.").
  - Left column:
    - "Sesión de hoy · Día N": T1/T2/T3 rows with name, scheme, weight and rest, plus an "Empezar sesión" button with an Enter hint;
    - "Esta semana": a 7-day strip L M X J V S D;
    - "Cargas T1": a sparkline card per main lift, plus a warn note when a lift changed stage after a failure.
  - Right column: "Próximo hito", "Última sesión · Día N", "Programa" (sessions N/total, volume total).
  - No stacked banners.
- **S8** Entrenar (/app/tracker) at lg+, per the artboard:
  - ONE day selector "‹ Día 8 · Semana 3 ›". Its middle opens a popover of nearby days and the jump-to-day form.
  - Progress "N de M series".
  - A table grouped by exercise: Serie | Objetivo | Kg (input) | Reps (stepper) | ✓.
    - AMRAP rows are marked "3+" / "25+".
    - The active row gets a gold left edge; done rows are muted with an ok check.
  - Right rail: "Descanso" countdown, "Última vez · <ejercicio>", "Regla de progresión", "Discos por lado".
  - Fixed key bar: "Enter confirmar · ↑↓ reps · ← → día · U deshacer · Espacio saltar descanso".
- **S9** Weights on the new desktop surfaces use the language's decimal separator: es "22,5 kg", en "22.5 kg".

## Tasks

| ID  | Specs              | Route                                                                                                                                                                                                                           | Commit                                    | Status                                                                                                    |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| T1  | S2, S3, S9         | Foundations: `useIsDesktop` (lg media query via useSyncExternalStore, SSR false), locale-aware weight formatter for web, primitives (Panel with header, Kbd, TierBadge); i18n keys move to the task that introduces each string | 67470ffe                                  | done                                                                                                      |
| T2  | S1, S2, S3, S5, S6 | Desktop shell: new sidebar, program card, Cuenta menu, top bar with page title (the ⌘K field lands with T3, so no commit ships an inert control)                                                                                | ec877c26                                  | done                                                                                                      |
| T3  | S4, S6             | ⌘K palette: sections, jump to program day, exercise catalog search; ⌘K/Ctrl+K and click open it; Esc closes; full keyboard navigation                                                                                           | e7929209                                  | done                                                                                                      |
| T4  | S1, S2, S3, S7, S9 | Hoy desktop dashboard (lg+ only, phone Home unchanged)                                                                                                                                                                          | 6e3a8f4e                                  | done                                                                                                      |
| T5  | S1, S2, S3, S8, S9 | Entrenar desktop: day selector, series table, right rail, key bar, keyboard map (Enter/↑↓/←→/U/Espacio; S/F/Esc kept as aliases); e2e updated                                                                                   | 748b596f + ee7dc2c9 + 5008e36e + 11266b9f | partial: table, key bar, Espacio, column header and single day selector done; only the right rail pending |
| T6  | all                | Verify: typecheck, lint, unit, affected e2e; visual comparison with the artboard at 1440×900; handoff implemented                                                                                                               | —                                         | pending                                                                                                   |

## Log

- **L1** (user, verbatim): "Implement the design artboard design/web-desktop-shell/01-centro-de-mando.html
  Artboard: design/web-desktop-shell/01-centro-de-mando.html
  Title: 01 · Centro de mando
  Tradeoff: Dense, keyboard-first and fast for regular lifters; heavier first impression and more to learn
  Implement it in the project's real stack. Use the artboard as the visual spec: map its parts to the project's existing components and styles, and do not copy the artboard HTML verbatim.
  Take colors, typography, spacing, radius and shadows from design/system.md, the project's token source.
  Report progress with the gentle_design tool: action "handoff", target "web-desktop-shell/01-centro-de-mando.html", status "in_progress" when you start; status "implemented" when it is done, with previewUrl set to the running app's loopback URL (localhost, 127.0.0.1 or [::1]) when one is running, so the canvas can compare it with the artboard.
  This design is not linked to an ODD feature document: size it under the project's ODD rules as usual.
  This handoff itself commits nothing."
- **L2** (user answers): Pantalla chica = "Dejarla como está; cambia solo desktop (Recomendado)". ⌘K = "Sí, versión mínima".
- **L3** (decisions; no data is invented):
  - The app has no training-day schedule, so "Esta semana" shows completed days and today plus "N de M esta semana" (M = the program's workouts per week). It does not show fixed "planned" weekdays.
  - "Adherencia" is replaced by the existing success rate.
  - "Próximo hito" reuses the PR-road and badges data.
  - Keyboard: the new map is added and the old S/F/Esc keys stay as aliases, so no existing shortcut breaks.
  - The desktop tracker always uses the table; the compact/detailed toggle stays phone-only.
  - The domain `formatWeight` (shared with mobile) is not changed; the web formatter is new.
- **L4** Exploration map (code paths): `layout/app-sidebar.tsx`, `layout/app-layout.tsx`, `layout/avatar-dropdown.tsx`, `hooks/use-keyboard-shortcuts.ts`, `features/dashboard/use-dashboard-data.ts`, `features/tracker/program-app.tsx`, `session-chrome.tsx`, `session-side-panel.tsx`, `rest-timer.tsx`, `features/program-view/detailed-day-view.tsx` (existing table + `confirmOnEnter`), `features/onboarding/plate-breakdown.tsx` (reusable plates), `tracker/session-history.ts` (last time), `failure-explainer.tsx` + `@gzclp/domain/progression-preview`.
  - e2e at the 1280×720 desktop viewport: `tracker-interactions`, `guest-mode`, `workout-recording`, `undo`, `day-completion`, `weight-unit`, `tracker-visual-polish`, `tracker-prescription-ladder`, `progression-rules`, `phone-nav` (phone viewport, must stay green).
- **L5** Local stack: `set -a; source .env; set +a`; API `:3001` (`pnpm run dev:api`), web `:5173` (`pnpm run dev:web`). e2e uses `E2E_API_PORT`/`E2E_WEB_PORT` to avoid the dev ports.
- **L6** T1 done in 67470ffe (496 lines including tests). Vitest: 6 files, 28 tests. typecheck and lint pass.
  - Delivery: one commit per task on `feat/web-desktop-shell`. Push and PR are the user's decision.
  - The pre-commit `format:check` is repo-wide, so the untracked `design/` and `odd/` files were Prettier-formatted. The artboards re-render without errors.
- **L7** T2 implementation (session 2, resumed from Engram + this file; the tree was clean, so T2 started from scratch):
  - Sidebar rewritten per S6: "GRAVITY ROOM" wordmark + "Registro de fuerza", nav Hoy/Entrenar/Programas/Progreso/Ejercicios with `aria-current` and the gold left edge; `/app/explore` and `/app/start` map to Programas/Entrenar. New `desktop_shell.*` i18n keys, so the phone nav labels (`navigation.*`) are unchanged (S3).
  - `DesktopProgramCard`: name, "Semana N", "Día N de M", progress bar; data from `buildProgramProgress` (new, pure) exposed as `useDashboardData().programProgress`. Shares cache keys, no extra requests. Guests get no card (the guest program is local only).
  - `AccountMenu` replaces `AvatarDropdown` (deleted, it had no other user): Perfil, Unidades (kg/lbs), Idioma (Español/English), Tema (Oro/Claro), Cerrar sesión. Values switch in place; arrows/Home/End/Escape; click outside closes. The sidebar theme selector moved into it.
  - `DesktopTopBar` (lg+ only): page title label (pages keep their h1) + the online indicator. The ⌘K field lands with T3.
  - `--sidebar-width` 224px → 232px (artboard; only the desktop sidebar and the rest banner offset use it).
  - e2e updated: account trigger `/^(cuenta de .+|.+ account)$/i` replaces "Menú de usuario"; Insights nav label "Progreso"; theme switched through the Cuenta menu; profile reached through Cuenta → Perfil.
  - Checks: vitest 1251 pass; 3 files fail before running with `Cannot find package 'zod'` from `@hookform/resolvers` (install linking, pre-existing, no dependency touched). typecheck and lint pass.
- **L8** T2 closed in ec877c26 (session 3). The uncommitted tree from session 2 was kept and finished:
  - e2e: 70/70 across auth, auth-guard, auth-user-flows, guest-mode, insights, tracker-visual-polish, phone-nav (fresh preview build, not a reused one).
  - Three defects found and fixed before the commit:
    - Guests at lg+ had lost their only theme control (the Cuenta menu is signed-in only). The footer now shows the compact `ThemeSelector` for guests; the two guest theme specs went back to `[data-theme-option]`.
    - `DesktopProgramCard` rendered a second `role="progressbar"` on tracker pages, breaking "one progress surface". The bar is decorative now (the text states the day).
    - `auth-guard` "just signed out" raced the `window.location.replace('/login')` of sign-out; it now waits for the login heading before the first `goto`.
  - Local environment: `node_modules` was installed with the isolated linker against a stale graph, so three suites died on `Cannot find package 'zod'`. A clean `pnpm install --frozen-lockfile` fixed it; `pnpm --filter web test` is now 156 files / 1259 tests green.
  - The e2e database `gravity_room_e2e` did not exist (dev sign-in returned 500). Created once and migrated + seeded with `DATABASE_URL=<api .env URL, database swapped> pnpm --filter api db:deploy`. This is one-time local setup, not a repo change.
- **L9** T3 done in e7929209 (session 3):
  - `layout/desktop-nav.ts` now owns the five sections (sidebar + palette read the same list).
  - `layout/palette-results.ts` is the pure ranking: nav filter ignoring case/accents, `34` and `día 34` -> day jump, upcoming days before typing, per-section caps, empty sections dropped. 10 unit tests.
  - `layout/command-palette.tsx`: focus stays in the input (combobox + `aria-activedescendant`), arrows/Home/End/Enter/Escape/Tab, click outside closes, focus returns to the trigger. Mounted only while open, so its queries never run in the background.
  - Day jumps are `/app/tracker?day=N` (route `validateSearch`, applied once per value in `program-app`); catalog results are `/app/exercises?q=`, which seeds the catalog browser.
  - e2e `command-palette.spec.ts` (click, Ctrl+K, filtered section + Enter, day jump, Escape). The first attempt pressed the shortcut before hydration; the spec now waits for the top-bar field first.
  - Checks: 157 files / 1270 unit tests, typecheck, lint and the 5 affected e2e specs green.
- **L10** T4 done in 6e3a8f4e (session 3):
  - `features/home/desktop-home.tsx` composes the artboard layout from `desktop-home-view-models.ts` (pure, 13 unit tests): today's slots, week strip, T1 load series, stage warning, last session.
  - `useDashboardData` now also exposes `rows`, `resultTimestamps`, `totalVolume` (lifetime) and `workoutsPerWeek`; no new requests.
  - Decisions kept honest: nothing is marked "planned" in the week strip (L3), future rows never enter the load series, and the stage warning only fires when a primary slot failed and the next stage for that lift differs.
  - Two visual bugs caught on the 1440x900 screenshot: domain tiers are lowercase ("t1"), so the badge needed normalising; the milestone header repeated the lift name and now shows the percentage.
  - Phone Home is untouched: `home-page` returns the desktop tree only before the phone stack, and `home-page.test.tsx` pins `useIsDesktop` to false.
  - e2e `desktop-home.spec.ts` (layout, start button, phone viewport); the shared `navigateToTracker` helper and the dashboard CTA test accept both CTA labels.
  - Checks: 158 files / 1284 unit tests, typecheck, lint, and e2e desktop-home + auth-user-flows + guest-mode + phone-nav + tracker-visual-polish green.
  - Known T4 follow-ups: a guest at lg+ still gets the phone Home, and the no-program state keeps the phone empty card.
- **L11** T5 attempted and deliberately stopped (session 3), with one slice kept in 748b596f:
  - Done: `Espacio` skips the rest countdown (S8 keyboard map); S/F/Esc stay as aliases; the handler never fires while a button/link has focus. Unit-tested.
  - Tried: forcing `DetailedDayView` at lg+ (S8 "the desktop tracker always uses the table", L3). It broke **19 e2e specs** because they encode the compact view's affordances: whole-slot `Marcar T1 como éxito/fallo` buttons, the AMRAP input on the compact card, the Sheiko prescription ladder, and the day-completion screen. The new table alone does not provide parity.
  - Reverted in full (component, key bar, i18n, spec edits). `33/33` tracker e2e are green again after the revert.
  - Consequence: T5 needs a deliberate migration that ports those affordances **and** rewrites that e2e set in the same change. Recommended split:
    - **T5a** — desktop table at lg+ with compact parity (whole-slot actions, AMRAP, ladder, completion) + rewrite of workout-recording, day-completion, tracker-prescription-ladder, tracker-visual-polish, tracker-interactions.
    - **T5b** — one day selector + popover, right rail (rest, last time, rule, plates) and the fixed key bar on top of T5a.
  - Do not re-apply the one-line `effectiveViewMode` switch on its own.
- **L12** T5a done in ee7dc2c9 (session 3): the lg+ tracker renders the set table.
  - Root cause of the earlier 19 failures: `DetailedDayView` runs `SlotResultFooter` in `setFirstMode`, which hides the whole-slot actions. With `setFirstMode={!isDesktop}` the table keeps per-set rows **and** the quick slot outcome, and S/F stay inert at lg like in set-first mode.
  - The compact/detailed toggle is hidden at lg+; `effectiveViewMode` forces the table.
  - Fixed key bar (`desktop-key-bar.tsx`) at lg+, above the content padding.
  - Compact-flow specs are pinned to 390x844: undo, weight-unit, workout-recording, day-completion, tracker-prescription-ladder, the view-toggle test and the compact day-navigator test. `41/41` green after the change; new `desktop-tracker.spec.ts` covers table + slot actions + key bar + no toggle.
  - Visual check at 1440x900: the chrome still carries week chips + day chips, and the three cards are not yet the artboard's single table with columns Serie | Objetivo | Kg | Reps | ✓.
- **L13** T5b (pending): one day selector "‹ Día N · Semana W ›" with a popover of nearby days + jump form; right rail with Descanso countdown, Última vez, Regla de progresión, Discos por lado; consolidate the chrome nav at lg; single table layout with the artboard's column header and the active row's gold edge.
- **L14** Table header in 5008e36e: mono header per exercise (Serie | kg | Reps | check), gold edge on the row waiting for input, AMRAP "+" kept. First column widened to 2.5rem. Verified visually at 1440x900 and `desktop-tracker` + `tracker-visual-polish` green (15/15).
  - Still open for T5b: the single day selector with its popover (the chrome still shows the week rail plus the day chips) and the right rail (rest countdown, last time, progression rule, plates per side). The rail needs the `rest` state and the `previous`/`failPreview` derivations that currently live inside `SessionView`; extracting them into a hook is the first step, before mounting the rail next to the table.
- **L15** Single day selector in 11266b9f: at lg+ the week rail and the day chips are gone from the flow, replaced by one control between the arrows ("Dia N . Semana W"); the calendar toggle and "back to current day" moved into that row (also fixed the orphan button the first cut left above the selector). Phones keep both rails untouched. `session-chrome` unit tests updated (one selector per layout) and `tracker-visual-polish` band test pinned to phone. Verified: chrome tests 18/18, 29/29 e2e over the affected specs.
  - Still open for T5b: the right rail (Descanso countdown, Última vez, Regla de progresión, Discos por lado). The rest state lives in `program-app` (`rest`) and the last-time/rule derivations live inside `SessionView`; extract them into a hook first, then mount the rail beside the table at lg.
