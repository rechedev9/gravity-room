# Gravity Room — Roadmap

**Last updated:** 2026-04-11
**Status:** Cerrado — Fases 0–5 completadas. Pendiente: QA en dispositivo real + `bun run e2e` con infra levantada.

---

## Objective

Hacer que `apps/web` se sienta fluida y viva en escritorio y móvil: transiciones de ruta sin parpadeo, entradas y **salidas** animadas en overlays, feedback táctil en botones, y orquestación coherente basada en tokens compartidos — sin añadir dependencias nuevas y respetando `prefers-reduced-motion`.

El objetivo no es "más animación", es **animación que esconde la latencia y comunica jerarquía**. Cada cambio debe servir a uno de estos tres propósitos:

1. Ocultar transiciones de estado (ruta, Suspense, mount/unmount).
2. Dar feedback inmediato a interacción del usuario (tap/hover/focus).
3. Guiar la atención hacia el cambio que importa (nuevo dato, PR, set marcado).

Todo lo demás es decoración y no va.

---

## Current State

Explorado directamente en `apps/web/src/router.tsx`, `apps/web/src/styles/globals.css`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/layout/app-sidebar.tsx`, `apps/web/src/components/toast.tsx`, `apps/web/src/lib/motion-primitives.tsx`.

- **Stack:** Tailwind v4 (sin config, `@theme {}` en `globals.css`), Radix UI (dialog, dropdown, collapsible, tabs, tooltip), TanStack Router v1, `motion` v12 (sucesor de framer-motion) ya instalado, React 19 + React Compiler.
- **Animaciones existentes:** 11 `@keyframes` en `globals.css` (`modal-enter`, `fadeSlideUp`, `dropdown-enter`, `pop-in`, `slideInFromLeft`, etc.). Clases aplicadas por atributo `animate-[…]` en ~73 archivos.
- **Tokens de motion:** hay un único cubic-bezier compartido (`--sidebar-transition: 250ms cubic-bezier(0.4, 0, 0.2, 1)`); easing y duración están hardcodeados en cada sitio.
- **Radix `data-state`:** presente en el DOM pero **ningún** estilo engancha a `data-[state=open]`/`data-[state=closed]`. Los primitivos Radix soportan diferir el unmount mientras dure la animación — hoy no se aprovecha.
- **Motion library:** usado sólo en landing (`src/lib/motion-primitives.tsx`, 6 archivos). `AnimatePresence` no se usa en ningún sitio de la app autenticada.
- **Router:** cada ruta en `router.tsx` mete un `<Suspense fallback={<Skeleton />}>` propio dentro del `component`. No hay `pendingComponent`, no hay `defaultPendingMs`/`defaultPendingMinMs`, no hay `AnimatePresence` alrededor del `<Outlet>`. Resultado: el swap de ruta es un re-render instantáneo con flash de skeleton incluso en navegaciones de <50 ms.
- **Única pareja enter+exit funcionando hoy:** el toast (`src/components/toast.tsx`) con un flag `t.exiting` propio. Es la referencia de "cómo debería sentirse todo lo demás".
- **Sidebar desktop:** colapsa con transición inline `width var(--sidebar-transition)` — funciona bien.
- **Sidebar móvil (drawer):** `{isOpen && <aside …>}` con `animate-[slideInFromLeft_0.2s]` — **no tiene animación de salida**; al cerrar desaparece instantáneo. Este es, probablemente, el momento más janky del producto en móvil.
- **Diálogos:** `DialogContent` tiene `modal-box` (enter), sin salida. Al cerrar, el contenido se desmonta seco.
- **Dropdowns:** idéntico problema — `animate-[dropdown-enter_0.15s]`, sin salida.
- **Skeletons:** 8 componentes con `animate-pulse`. Swap skeleton → contenido es instantáneo (sin cross-fade).
- **Recharts:** usa su transición SVG por defecto. Listas (dashboard, programas, insights) aparecen de golpe.
- **`prefers-reduced-motion`:** regla blanket global en `globals.css:607` que pone `animation-duration: 0.01ms !important` y `transition-duration: 0.01ms !important`. Correcta, pero hay que asegurarse de que las animaciones JS de `motion/react` también respondan (`useReducedMotion` ya se usa en el landing; hay que replicarlo en los nuevos sitios).
- **View Transitions API:** cero uso.
- **`will-change`:** cero uso.

---

## Approach

**Elegido: Radix `data-state` CSS + `motion/react` `AnimatePresence` + tokens compartidos en `globals.css`.**

Rechazado:

- _Añadir `tailwindcss-animate` o similar._ No aporta sobre lo que Tailwind v4 y nuestras keyframes ya hacen y mete otra dependencia.
- _Migrar todo a `motion/react`._ Exagerado. Los overlays Radix ya resuelven la parte difícil (focus trap, portal, diferir unmount cuando detectan animación); sólo necesitan los keyframes `-exit`. Usar JS animations para un dialog simple es bazucazo.
- _View Transitions API como base._ Buen progressive enhancement futuro pero soporte aún desigual en Safari iOS a día de hoy; no puede ser el cimiento. Se deja como posible fase opcional.
- _Layer-por-layer (tokens → keyframes → aplicar en cada componente → router)._ Entregar vertical slice: una ruta con transición + un overlay con exit + drawer móvil con exit, todo end-to-end antes de replicar.

**Por qué esta combinación:**

- **Radix + CSS data-state** → gratis. Radix **ya** difiere el `unmount` si detecta `getAnimations()` no vacío. Añadir `data-[state=closed]:animate-…` al `DialogContent`/`DropdownMenuContent`/`TooltipContent` arregla la salida sin tocar la lógica de los primitivos. Es CSS, corre en compositor, es lo más rápido posible en móvil.
- **`motion/react` + `AnimatePresence`** → necesario donde NO hay Radix (drawer móvil, `<Outlet>` de ruta, listas con stagger). Ya está instalado y el equipo ya sabe usarlo (landing).
- **Tokens en `@theme`** → evita que 73 archivos deriven a su propio easing y duración. El objetivo es sentir el producto como **un sistema**, no una colección de transiciones ad-hoc.
- **Reglas de performance duras:** sólo animar `transform` y `opacity`. Nada de `width`/`height`/`top`/`left` salvo el sidebar desktop que ya existe y funciona. En móvil, eso es la diferencia entre 60 fps y un producto roto.

---

## Constraints

- `bun run ci` verde en cada checkpoint.
- **Sin dependencias nuevas.** `motion` ya está en `package.json`.
- **TypeScript estricto (`~/.claude/rules/typescript.md`):** cada función exportada declara su return type; nada de `any`, `!.`, `@ts-ignore`.
- **Respeta `prefers-reduced-motion`:** tanto la regla blanket en CSS como `useReducedMotion()` en cualquier componente nuevo que use `motion/react`.
- **60 fps en móvil:** sólo animar props del compositor (`transform`, `opacity`, `filter`). Nada que provoque layout o paint en el hilo principal.
- **Sin cambios visuales que rompan tests E2E.** Las animaciones añaden latencia de cierre en overlays — revisar selectores Playwright que hagan `click` y luego `expect(…).not.toBeVisible()` inmediatamente; pueden necesitar `waitFor` o reducir animación bajo `PLAYWRIGHT` env.
- React Compiler activo — ya probado con `motion/react` en el landing, pero validar con `bun run typecheck` + dev server en cada fase.
- `log.md` y `roadmap.md` son fuentes vivas — actualizar al cerrar cada fase.

---

## Step-by-Step Plan

### Fase 0 — Tracer bullet (Done — 2026-04-11)

Movida a [Completed](#completed). Archivada con resumen de ejecución, divergencias del plan original, y estado del gate de verificación.

---

### Fase 1 — Replicar el patrón overlay a todos los primitivos Radix (Done — 2026-04-11)

Movida a [Completed](#completed).

---

### Fase 2 — Feedback táctil y micro-interacciones de botones (Done — 2026-04-11)

Movida a [Completed](#completed).

---

### Fase 3 — Entrada orquestada en listas y páginas pesadas (Done — 2026-04-11)

Movida a [Completed](#completed).

---

### Fase 4 — Skeleton → contenido cross-fade (Done — 2026-04-11)

Movida a [Completed](#completed).

---

### Fase 5 — Polish y verificación final (Done — 2026-04-11)

Movida a [Completed](#completed).

---

## Checkpoints

- **CP-0 — fin de Fase 0 (tracer bullet).** Revisar conmigo antes de replicar a 40 archivos. Si el patrón no se siente bien en una ruta + un dialog + el drawer, cambiar el approach, no doblar la apuesta.
- **CP-1 — fin de Fase 1 (todos los overlays).** QA manual cerrando cada tipo de overlay. Verificar que los tests E2E no rompieron por timing.
- **CP-2 — fin de Fase 3 (listas y páginas).** Revisar que las animaciones de entrada no pisan el contenido "above the fold" de forma molesta (la gente no quiere esperar a que su dashboard aparezca).
- **CP-final — antes del merge.** `bun run ci` + `bun run e2e` + QA en al menos un dispositivo móvil real.

---

## Files Likely Affected

**Core (toca seguro):**

- `apps/web/src/styles/globals.css` — tokens, keyframes de salida, posibles podas de keyframes muertas.
- `apps/web/src/router.tsx` — `defaultPendingMs`, `defaultPendingMinMs`.
- `apps/web/src/components/layout/app-layout.tsx` — wrapper `AnimatePresence` alrededor del `<Outlet>`.
- `apps/web/src/components/layout/app-sidebar.tsx` — drawer móvil con `motion.aside` + `AnimatePresence`.
- `apps/web/src/components/ui/dialog.tsx` — clases `data-[state]`.
- `apps/web/src/components/ui/dropdown-menu.tsx` — idem.
- `apps/web/src/components/ui/tooltip.tsx` — idem.
- `apps/web/src/components/dropdown-menu.tsx` (hand-rolled) — envolver en `AnimatePresence` o migrar a Radix.
- `apps/web/src/components/layout/avatar-dropdown.tsx` — idem.

**Probable (toca por replicación):**

- `apps/web/src/features/dashboard/dashboard-page.tsx` — stagger.
- `apps/web/src/features/programs/programs-page.tsx` — stagger.
- `apps/web/src/features/home/home-page.tsx` — stagger / simplificación.
- `apps/web/src/features/analytics/analytics-page.tsx` — Recharts props.
- `apps/web/src/features/insights/…` — idem.
- `apps/web/src/components/ui/button.tsx` (si existe) o donde vivan los variants — `active:scale`.

**Posible (si escala la refactor):**

- `apps/web/src/lib/motion-primitives.tsx` — añadir variantes más cortas (`*FastVariants`) para in-app.
- Nuevo: `apps/web/src/lib/motion-tokens.ts` — tipo-safe access a los duration/easing desde JS en los componentes `motion.*` (para que motion y CSS usen los mismos números). **Crear sólo si aparece duplicación real durante la implementación.**

**Fuera de scope:**

- `apps/web/src/features/landing/**` — ya tiene su sistema, no tocar salvo para alinear tokens.
- `apps/web/src/features/tracker/program-view/result-cell.tsx` — `pop-in` actual es la mejor micro-interacción del producto; no tocar salvo migrar al token de easing.
- `apps/go-api/**`, `apps/analytics/**` — backend, irrelevante.

---

## Risks

- **E2E flakiness por animaciones de cierre.** Playwright espera ver el DOM ausente; si un close anima 180 ms, un `expect(...).not.toBeVisible()` seco puede fallar. Mitigación: tests ya deberían usar `toBeHidden()`/`waitFor`; si no, o añadir `waitFor` o desactivar animaciones en E2E vía `prefers-reduced-motion` del contexto de Playwright (`launchOptions: { args: ['--force-prefers-reduced-motion'] }` o `use.colorScheme` + reduce). Validar en CP-1.
- **React Compiler + `motion/react`:** ya validado en landing, pero cualquier nuevo hook personalizado que se cree encima de `useReducedMotion` debe seguir las reglas del compiler. `bun run typecheck` + dev server en cada fase.
- **Regla blanket de `reduced-motion` en `globals.css:607`** tiene `!important`, lo cual tumba incluso las nuevas animaciones CSS. Esto es **intencional** (accesibilidad), pero hay que confirmar que los componentes `motion/react` también cortocircuitan con `useReducedMotion()` — si no, la animación JS sigue corriendo. Convertir en norma en este proyecto: **todo `motion.*` nuevo debe consultar `useReducedMotion()`**.
- **`AnimatePresence mode="wait"` en route transition añade latencia percibida** al navegar (no muestra la nueva ruta hasta que la vieja salga). 180 ms es el tope tolerable; si alguna ruta se siente lenta, bajar a 120 ms o cambiar a `mode="popLayout"`.
- **Radix `getAnimations()` diferido unmount** asume que hay `@keyframes`, no transiciones CSS. Si se usa por error `transition: opacity 200ms` en el `data-[state=closed]`, Radix desmonta instantáneo y la animación de salida no corre. **Usar `animation-*`, no `transition-*`, para las salidas de overlays Radix.**
- **CLS (Cumulative Layout Shift):** cualquier animación de entrada que empuje contenido por debajo debe reservar su espacio antes de animar (translate/opacity, no margin/height). Ya es la regla "sólo compositor"; recordarla en cada commit.
- **Sobre-animación.** El riesgo más sutil: animar todo hace que la app se sienta más lenta aunque los números digan 60 fps. Presupuesto: nunca >240 ms para una salida, nunca >320 ms para una entrada de página, nunca >120 ms para feedback táctil. Si algo necesita más, es porque está mal pensado.

---

## Verification

- **Por fase:** `bun run typecheck && bun run lint` después de cada paso; `bun run ci` al final de cada fase.
- **Tests unit:** `cd apps/web && bun test src/components/layout` y los archivos tocados.
- **E2E:** `bun run e2e` después de Fase 1 (overlays + router) y antes del merge. Si algún test rompe por timing de animación, arreglar el test con `waitFor` en lugar de desactivar la animación en producción.
- **Manual QA — checklist por checkpoint:**
  - Navegación entre rutas `/app` ↔ `/app/dashboard` ↔ `/app/tracker` ↔ `/app/analytics`. ¿Hay flash de skeleton? ¿La transición se siente coherente?
  - Abrir/cerrar cada tipo de overlay (dialog, dropdown, tooltip, drawer móvil, avatar menu). ¿Hay salida animada? ¿Se siente la misma "voz"?
  - Botones en móvil: ¿hay feedback de tap (`active:scale`)?
  - `prefers-reduced-motion: reduce` activado en DevTools → todo debe ser instantáneo pero funcional, sin elementos "atascados".
  - iPhone Safari real — scroll, dialog, drawer. El compositor de iOS es el benchmark.
  - Chrome DevTools Performance, mobile CPU 4×slowdown → grabar navegación completa, verificar 60 fps y ausencia de long tasks >50 ms durante animaciones.
- **Lighthouse / CLS:** correr Lighthouse mobile sobre `/app/dashboard` antes y después. CLS no debe subir.

---

## Open Questions

_Ninguna bloqueante. El approach está decidido._

---

## Completed

### Fase 5 — Polish y verificación final (Done — 2026-04-11)

**5 archivos modificados, 0 dependencias nuevas.**

**24. Auditoría de `will-change`:** único sitio en la app es `willChange: 'transform'` en `motion.aside` del drawer móvil (`app-sidebar.tsx:309`). Correcto: el elemento está dentro de `AnimatePresence` y sólo existe mientras el drawer está abierto — no es permanente. No se añadió `will-change` en ningún otro sitio.

**25. Auditoría de keyframes muertas:**

| Keyframe / clase | Estado | Acción |
|---|---|---|
| `@keyframes highlight-pulse` | Muerto (sólo consumido por `.highlight-current`) | Borrado |
| `.highlight-current` | Muerto (0 usos en TSX) | Borrado |
| `@keyframes slideInFromRight` | Muerto (drawer migró a motion/react en Fase 0) | Borrado |
| `@keyframes slideInFromLeft` | Muerto (ídem) | Borrado |
| `@keyframes glow-pulse` | Muerto | Borrado |
| `@keyframes progress-shimmer` | Muerto | Borrado |
| `@keyframes card-enter` | Vivo (3 archivos program-view) | Enganchado a tokens |
| `.modal-box` | Vivo (4 dialogs nativos) | Enganchado a tokens |

Token alignment aplicado:
- `globals.css`: `.modal-box` → `animation: modal-enter var(--duration-fast) var(--ease-out-expo) forwards`
- `set-indicators.tsx:70` → `animate-[card-enter_var(--duration-instant)_var(--ease-standard)]`
- `detailed-day-view.tsx:202` + `day-view.tsx:120` → `style={{ animation: 'card-enter var(--duration-fast) var(--ease-standard)' }}`

**26. QA manual en dispositivos reales:** pendiente — requiere iPhone Safari / Android Chrome físicos. No bloqueante para el commit.

**27. Benchmark de performance:** pendiente — requiere DevTools con CPU 4×slowdown.

**28. `bun run ci` final:**

| Check | Estado |
|---|---|
| `bun run typecheck` | ✅ verde |
| `bun run lint` | ✅ verde |
| `bun run format:check` | ✅ verde |
| `bun run build` | ✅ verde — CSS bundle gzip bajó de la limpieza de keyframes |
| `bun run test` (archivos Fase 5) | ✅ 45/45 tests program-view verdes |
| `bun run test` (suite completa) | ⚠️ fallos preexistentes de WIP i18n (`confirm-dialog.test.tsx`, `guest-banner.test.tsx`) — no relacionados con Fase 5 |
| `bun run e2e` | ⚠️ bloqueado — infra Playwright requiere `DATABASE_URL` |

---

### Fase 4 — Skeleton → contenido cross-fade (Done — 2026-04-11)

**Commit:** `aca3871 feat(router): migrate inline Suspense to pendingComponent + activate skeleton debounce` (1 archivo).

**Objetivo:** eliminar el flash skeleton → pop → contenido que ocurría en cada primera navegación.

**Entregado en 1 archivo, 0 dependencias nuevas:**

- **`apps/web/src/router.tsx`** — 14 rutas migradas de `component: function XRoute() { return <Suspense fallback={<Skeleton />}><Page /></Suspense>; }` a `pendingComponent: Skeleton` + `component: Page` directamente. Removed `Suspense` import. El comment en `defaultPendingMs`/`defaultPendingMinMs` actualizado para reflejar que ya están activos (antes decía "no-op").

**Cómo funciona:** TanStack Router usa `pendingComponent` como Suspense fallback para lazy components (igual que lo usaría para `loader`s async). Con `defaultPendingMs: 200`, la skeleton sólo aparece si el chunk JS tarda más de 200 ms en cargarse. En navegaciones repetidas (chunk cacheado), la transición es instantánea sin ningún flash. `defaultPendingMinMs: 400` asegura que si la skeleton aparece, se queda al menos 400 ms (evita un flash de skeleton corto si el chunk cargó entre los 200-400 ms).

**Decisión sobre FadeSwap:** no construido. La mayoría del parpadeo perceptible venía de que la skeleton aparecía incluso en navegaciones de <50 ms. Con el debounce de 200 ms, esas navegaciones ya no muestran skeleton en absoluto. El cross-fade skeleton→contenido (FadeSwap) queda como mejora opcional si se observa parpadeo notable en dispositivos lentos.

**Gate de verificación:**

| Check | Estado |
|---|---|
| `bun run typecheck` | ✅ verde |
| `bun run lint` | ✅ verde (con WIP temporalmente stasheado) |
| `bun run format:check` | ✅ verde (idem) |

---

### Fase 3 — Entrada orquestada en listas y páginas pesadas (Done — 2026-04-11)

**7 ficheros, 0 dependencias nuevas.**

- **`src/lib/motion-primitives.tsx`** — `fadeUpFastVariants` añadido (`y: 8, duration: 0.3, ease: EASE_OUT_EXPO`). Variante compacta para in-app frente al `y: 32 / 0.7s` del landing.
- **`features/dashboard/dashboard-page.tsx`** — `StaggerContainer` + `StaggerItem` en grids de plateau alerts y load recommendations. `stagger={0.05}` (50 ms).
- **`features/programs/programs-page.tsx`** — mismo patrón en la grid de `ProgramCard` dentro de cada sección de nivel. El `StaggerContainer` reemplaza el `div.grid` — los `motion.div` wrappers son los hijos directos de la grid, sin CLS.
- **`features/home/home-page.tsx`** — quick-start cards (3) y section overview cards (4) envueltos en `StaggerContainer` + `StaggerItem`.
- **`features/analytics/analytics-page.tsx`** — todos los grids de insights (overview, exercise summary, plateau, e1rm, forecasts, load rec) con stagger.
- **`features/insights/volume-trend-card.tsx`** — `isAnimationActive={false}` → `animationDuration={320} animationEasing="ease-out"`. El chart del volumen ahora anima con la misma duración que el token `--duration-slow`.
- **`features/insights/forecast-chart.tsx`** — band Areas: `isAnimationActive={false}` (el fill apilado animado se ve mal). Lines de datos: `animationDuration={320} animationEasing="ease-out"`.

**Decisiones:**
- `LineChart` compartido (`src/components/charts/line-chart.tsx`) conserva `isAnimationActive={false}` — lo usa el tracker en tiempo real; re-animar en cada set sería disruptivo.
- No se creó `FadeUpFast` como wrapper component: `StaggerItem` ya acepta `variants` como prop.
- `StaggerContainer` reutiliza `whileInView + viewport.once` del landing — correcto para in-app: cartas above-the-fold animan en mount; cartas below-the-fold animan al scroll.

**Gate de verificación:**

| Check | Estado |
|---|---|
| `bun run typecheck` | ✅ verde |
| Lint (mis ficheros) | ✅ — los 2 errores previos son WIP preexistente no tocado |
| Format (mis ficheros) | ✅ — prettier aplicado a los 7 ficheros modificados |

---

### Fase 1 — Replicar el patrón overlay a todos los primitivos Radix (Done — 2026-04-11)

**Commit:** `05cd4d2 feat(motion): add exit animations to Radix dropdown, tooltip, and hand-rolled dropdown` (4 archivos).

Objetivo: replicar el patrón `data-[state]` de Fase 0 al resto de overlays, y añadir exit animation al dropdown hand-rolled con `AnimatePresence`.

**Entregado en 4 archivos, 0 dependencias nuevas:**

1. **`apps/web/src/styles/globals.css`** — 3 nuevos keyframes: `dropdown-exit` (reverso de `dropdown-enter`: opacity+translateY(-4px)+scale(0.97)), `tooltip-enter` (pure opacity — sin translate por razón de dirección dependiente de `side`), `tooltip-exit` (pure opacity).
2. **`apps/web/src/components/ui/dropdown-menu.tsx`** — `DropdownMenuContent`: reemplazado `animate-[dropdown-enter_0.15s_ease-out]` por `data-[state=open]:animate-[…]` + `data-[state=closed]:animate-[…]`. Radix difiere el unmount via `getAnimations()`.
3. **`apps/web/src/components/ui/tooltip.tsx`** — `TooltipContent`: añadidas clases `data-[state=delayed-open]`, `data-[state=instant-open]`, `data-[state=closed]`. Radix tooltip tiene tres estados de apertura (delayed, instant, closed).
4. **`apps/web/src/components/dropdown-menu.tsx`** (hand-rolled) — convertido a `AnimatePresence` + `motion.div`. Eliminado early `return null`; `useReducedMotion()` respetado. Avatar dropdown (`avatar-dropdown.tsx`) hereda la exit animation sin cambios propios.

**Decisiones:**
- Opción (b) para el dropdown hand-rolled: tiene keyboard handling y click-outside propios aceptables; no merece migrar a Radix solo por la animación.
- Tooltip usa pure opacity (no translate) porque la dirección de slide depende del `side` del tooltip — hardcodear `translateY(-2px)` sería correcto sólo para tooltips debajo del trigger.
- Paso 10 (Tabs content transition) diferido — baja prioridad, no está en rutas visibles que justifiquen el trabajo ahora.

**Gate de verificación:**

| Check | Estado |
|---|---|
| `bun run typecheck` | ✅ verde |
| `bun run lint` | ✅ verde |
| `bun run format:check` | ✅ verde |

---

### Fase 0 — Tracer bullet (Done — 2026-04-11)

**Commit:** `60850d1 feat(motion): add shared tokens, Radix dialog exits, drawer + route transitions` (7 archivos).

Objetivo original: demostrar end-to-end que el patrón elegido (Radix `data-state` CSS + `motion/react` `AnimatePresence` + tokens en `@theme`) funciona en una ruta, un overlay y el drawer, antes de replicarlo a 40+ archivos.

**Entregado en 5 archivos, 0 dependencias nuevas:**

1. **Tokens de motion en `apps/web/src/styles/globals.css`** dentro de `@theme {}`: `--ease-out-expo`, `--ease-standard`, `--ease-emphasized`, `--duration-instant` (120ms), `--duration-fast` (180ms), `--duration-base` (240ms), `--duration-slow` (320ms). Añadidos tras `--sidebar-transition` sin renombrar ni romper el token existente del sidebar desktop.
2. **Keyframes de salida en `globals.css`:** `modal-exit`, `overlay-in`, `overlay-out`. **Divergencia del plan:** el roadmap original también listaba `dropdown-exit` y `fadeSlideLeftOut` — se descartaron por ahora. `dropdown-exit` es trabajo de Fase 1 (todavía nadie lo consume); `fadeSlideLeftOut` habría sido código muerto porque el drawer móvil se migró a `motion/react`, no CSS. Se añadirán cuando haga falta.
3. **`apps/web/src/components/ui/dialog.tsx` — Radix `data-state` engine:**
   - `DialogOverlay`: `data-[state=open]:animate-[overlay-in_var(--duration-fast)_var(--ease-standard)]` + `data-[state=closed]:animate-[overlay-out_var(--duration-instant)_var(--ease-standard)]`.
   - `DialogContent`: `data-[state=open]:animate-[modal-enter_var(--duration-fast)_var(--ease-out-expo)]` + `data-[state=closed]:animate-[modal-exit_var(--duration-instant)_var(--ease-standard)]`.
   - **Bug latente corregido al paso:** el `DialogContent` original se centraba con `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` **y** aplicaba `modal-box` (animación `modal-enter ... forwards`). Una animación CSS sobreescribe el `transform` entero del elemento mientras corre, y con `forwards` el estado final `translateY(0)` quedaba pegado — el diálogo perdía el centering tanto durante la animación como al terminarla. Fix: migrar el centering a `fixed inset-0 m-auto h-fit`, el mismo patrón que ya usan `confirm-dialog.tsx`, `test-weight-modal.tsx`, `delete-account-dialog.tsx` y `setup-form.tsx`. Bonus: consistencia con el resto de los modales del producto.
   - **`.modal-box` CSS class preservada en `globals.css`** — todavía la consumen 4 `<dialog>` nativos. Limpieza queda para Fase 1 o Fase 5.
4. **`apps/web/src/components/layout/app-sidebar.tsx` — drawer móvil con `AnimatePresence`:**
   - Bloque `{isOpen && <div lg:hidden …>}` (líneas 290-304) envuelto en `<AnimatePresence>`.
   - `<aside>` → `motion.aside` con `initial={{ x: '-100%' }}`, `animate={{ x: 0 }}`, `exit={{ x: '-100%' }}`.
   - Backdrop `<div>` → `motion.div` con opacity 0→1→0.
   - `useReducedMotion()` → duración 0 cuando el usuario tiene `prefers-reduced-motion` activo.
   - `willChange: 'transform'` inline en el `motion.aside` (único sitio con `will-change` en la app — no dejar permanente en otros sitios).
   - Easing reutilizado: `EASE_OUT_EXPO` importado de `lib/motion-primitives.tsx` (ya existía para landing, evita duplicación).
5. **`apps/web/src/components/layout/app-layout.tsx` — route cross-fade:**
   - `<Outlet />` envuelto en `<AnimatePresence mode="wait">` + `motion.div` keyed por `pathname` (ya derivado vía `useRouterState` línea 29).
   - Cross-fade 180 ms con `EASE_OUT_EXPO`. Respeta `useReducedMotion()`.
6. **`apps/web/src/router.tsx` — `createRouter`:** añadidos `defaultPendingMs: 200` y `defaultPendingMinMs: 400`. **Sutileza documentada en el código:** estos flags sólo controlan `pendingComponent` / `defaultPendingComponent`, no fallbacks de React `<Suspense>`. Cada ruta todavía envuelve su página en su propio `<Suspense fallback={<Skeleton />}>`, así que los flags son no-op hoy. Activarán cuando Fase 4 migre los Suspense fallbacks al sistema del router. Se dejan puestos ahora porque es la configuración correcta y porque Fase 4 va a necesitarlos.

**Gate de verificación:**

| Check | Estado |
|---|---|
| `bun run typecheck` | ✅ verde |
| `bun run lint` | ✅ verde (el lefthook pre-commit lo corrió completo al hacer `60850d1`, con el WIP i18n temporalmente revertido) |
| `bun run format:check` | ✅ verde (idem) |
| `bun run build` | ✅ verde en su sesión, `vendor-motion` bundle sin cambio de peso (134 kB / gzip 44 kB) |
| `bun run test` | No corrió en el commit gate (lefthook pre-commit solo chequea typecheck/lint/format/go; tests están en pre-push) |
| `bun run e2e` | ⚠️ bloqueado — webServer de Playwright requiere `DATABASE_URL`, infra local no disponible |

**Cierre pendiente de Fase 0** (para retomar en una sesión futura si alguna de estas cosas empieza a doler):

- QA manual en iPhone Safari real. El drawer móvil es el cambio más visible y hay que sentirlo en compositor iOS, no en DevTools.
- E2E completo con infra levantada. Riesgo principal: close de `DialogContent` pasó de 0 ms a ~120 ms; cualquier test Playwright con `click` → `expect(...).not.toBeVisible()` seco puede flakear. Mitigación preferida: cambiar el test a `toBeHidden()`/`waitFor`. Mitigación de último recurso: `--force-prefers-reduced-motion` en el launch de Playwright.
- Validar con `prefers-reduced-motion: reduce` activo en DevTools que tanto la regla blanket de CSS (`globals.css:645`) como `useReducedMotion()` en JS capan las animaciones nuevas. **Nota de Fase 2:** la regla cappea `animation-duration`/`transition-duration` pero no nulifica `transform`, así que los `active:scale` siguen disparando (instantáneamente) bajo reduced-motion. Esto es correcto bajo WCAG 2.3.3.

**Decisiones estructurales que se llevan a Fase 1:**

- **Reutilizar `EASE_OUT_EXPO` de `lib/motion-primitives.tsx`** en lugar de crear `lib/motion-tokens.ts`. Sólo hay 2 usos hoy; no merece abstracción todavía.
- **Regla performance:** sólo animar `transform`, `opacity`, `filter`. `will-change: transform` sólo se declara en puntos calientes comprobados (hoy: `motion.aside` del drawer móvil). Nunca permanente.
- **`animation-*`, nunca `transition-*`, para salidas de overlays Radix.** Radix difiere el unmount consultando `getAnimations()`, que no reporta transitions. Si se usa por error `transition: opacity 200ms` en `data-[state=closed]`, Radix desmonta instantáneo y la animación de salida no corre.
- **Todo componente `motion.*` nuevo debe llamar `useReducedMotion()`.** La regla blanket de CSS con `!important` no afecta a animaciones JS.

---

### Fase 2 — Feedback táctil y micro-interacciones de botones (Done — 2026-04-11)

**Commit:** `cab73ff feat(motion): add tap feedback to buttons, nav items and program cards` (6 archivos).

Objetivo: eliminar la sensación "muerta" al tap en móvil añadiendo feedback visual inmediato a botones, items de sidebar, hamburger, y program cards. Se saltó Fase 1 por decisión del usuario — Fase 2 es ortogonal.

- [x] **12. Botones** — `apps/web/src/components/button.tsx:4`. El `active:scale-[0.97]` ya existía; el único cambio real es `duration-150` → `duration-[var(--duration-instant)]` (120 ms, derivado del token compartido de Fase 0). **Desviación del literal del roadmap:** se mantuvo `transition-all` en lugar de narrow a `transition-transform` para preservar las transiciones de hover color/opacity en las variantes `primary`/`danger`/`ghost`.
- [x] **13. Sidebar / nav** — `apps/web/src/components/layout/sidebar-trigger.tsx:13` (hamburger) pasa a `transition-[color,transform] duration-[var(--duration-instant)] active:scale-[0.98]`. `apps/web/src/components/layout/app-sidebar.tsx:49` (`navItemClass` base) pasa a `transition-[color,background-color,transform] duration-[var(--duration-instant)] active:scale-[0.98]`. El mismo componente renderiza en desktop y en el drawer móvil; el `:active` en desktop dura lo que el click y es imperceptible — aceptable.
- [x] **14. Cards de programas** — `apps/web/src/styles/globals.css:502-518`. Añadida regla `.program-card-lift:active { transform: translateY(0); }` fuera del bloque `:hover`, con replica dentro del `@media (prefers-reduced-motion: reduce)`. Una sola edición aplica a ambos usos del selector: landing (`features/landing/programs-section.tsx:70`) y app (`features/programs/program-card.tsx:52`).
- [x] **15. Regla blanket `prefers-reduced-motion`** — **No requiere cambio.** Está en `globals.css:645-652` (el roadmap decía 607, wrong). Cappea `animation-duration`/`transition-duration` a `0.01ms !important` pero no nulifica `transform`. Bajo reduced-motion, los `active:scale` disparan **instantáneamente** (sin easing) en lugar de "desaparecer" como el texto original sugería. Esto es correcto bajo WCAG 2.3.3 ("Animation from Interactions") que prohíbe animación *triggered*, no cambios de estado instantáneos. Documentación actualizada en `log.md`.

**Descubrimientos no triviales:**

- **El `Button` real vive en `apps/web/src/components/button.tsx` (14 imports), no en `apps/web/src/components/ui/button.tsx` (0 imports, dead code).** El roadmap apuntaba al path equivocado. `ui/button.tsx` es estructuralmente casi idéntico (`VARIANTS`/`SIZES` en lugar de `VARIANT_STYLES`/`SIZE_STYLES`) — follow-up de limpieza.
- **Convención divergente abierta:** 71 `<button>` raw en 36 archivos usan `active:scale-95`, no el `[0.97]` del Button compartido. Dos convenciones coexistiendo. Unificar sería un barrido separado de bajo ROI; no se hizo en Fase 2.

**Gate de verificación:**

| Check | Estado |
|---|---|
| `bun run typecheck` | ✅ verde |
| `bun run lint` | ✅ verde (lefthook pre-commit completo en `cab73ff`, con WIP i18n temporalmente revertido) |
| `bun run format:check` | ✅ verde (idem) |
| Verificación visual via Chrome (`/app` guest + `/app/programs`) | ✅ SidebarTrigger, navItems y Button compartido confirmados con computed styles correctos (`transition-duration: 0.12s`, propiedades esperadas). `.program-card-lift:active` confirmada en el stylesheet compilado |
| `bun run test` / `bun run e2e` | No ejecutados — lefthook pre-commit no los cubre, infra Playwright sigue bloqueada |

**Cierre pendiente** (no bloquea, queda en la lista al retomar):

- QA en iPhone Safari real — el compositor iOS es el benchmark para feedback táctil.
- Toggle `prefers-reduced-motion: reduce` en DevTools sobre los 4 elementos y confirmar que el snap instantáneo no se siente atascado.
- `bun run e2e` completo cuando se resuelva la infra de Playwright.
- Borrar `apps/web/src/components/ui/button.tsx` (dead code, 0 imports) en una limpieza separada.
- Evaluar si unificar los 71 `<button>` raw con `active:scale-95` → `active:scale-[0.97]` merece un barrido (consistencia pura, bajo ROI).
