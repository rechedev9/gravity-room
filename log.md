# Project Log

Active work log for the current session. Append decisions, discoveries, and constraints here.

---

## 2026-04-11 — Animation system: discovered state and chosen approach

Inspected `apps/web` animation surface for the fluid-UX initiative. Key findings that are not obvious from code:

- **`motion` v12 (Framer Motion successor) is already installed** and used only in `src/features/landing/**` via `src/lib/motion-primitives.tsx` (`FadeUp`, `StaggerContainer`, `StaggerItem`). No need to add a dependency — the rest of the app just hasn't adopted it.
- **Radix UI primitives are mounted but their `data-state` attributes are unused by CSS.** No file in `src/` contains a `data-[state=open]` or `data-[state=closed]` selector. This is free leverage: Radix defers unmount automatically when `element.getAnimations()` is non-empty, so adding CSS `@keyframes`-based exits on `data-[state=closed]` gives clean exit animations without any component logic changes. **Important caveat:** this only works for `animation-*`, not `transition-*`. Radix checks `getAnimations()` which does not report CSS transitions.
- **The `ToastContainer` (`src/components/toast.tsx`) is the only component in the app with a working enter+exit pair**, managed via a `t.exiting` flag + `fadeSlideDown` keyframe. It's the reference for how everything else should feel. The rest of the overlays (`DialogContent`, dropdowns, mobile drawer) animate on open but snap closed.
- **Mobile sidebar drawer** (`src/components/layout/app-sidebar.tsx`) conditionally renders `{isOpen && <aside animate-[slideInFromLeft_0.2s] />}` — the drawer simply vanishes on close, no exit animation. Probably the jankiest moment on mobile.
- **`globals.css:607` has a blanket `prefers-reduced-motion` override** with `animation-duration: 0.01ms !important` and `transition-duration: 0.01ms !important` on `*, *::before, *::after`. This is correct for accessibility but has two implications: (1) any new CSS animation we add is automatically handled by this rule; (2) it does **not** affect JS-driven `motion/react` animations, so every `motion.*` component in the app must call `useReducedMotion()` and provide a no-op fallback. Make this a codebase rule going forward.
- **TanStack Router v1 routes all use per-component `<Suspense fallback={<Skeleton />}>`** rather than the router's `pendingComponent` + `defaultPendingMs` + `defaultPendingMinMs`. Switching to the router's pending system lets us gate skeleton appearance (only show skeleton if load >200 ms), which eliminates ~80% of the perceived flash without any animation work.
- **No `AnimatePresence` wraps `<Outlet>`.** Route changes are instant re-renders. To cross-fade routes, wrap the outlet with `AnimatePresence mode="wait"` keyed on `pathname` from `useRouterState`.
- **There are 11 custom `@keyframes` in `globals.css`** (`modal-enter`, `fadeSlideUp`, `dropdown-enter`, `pop-in`, `highlight-pulse`, `slideInFromLeft`, `slideInFromRight`, `fadeSlideDown`, `card-enter`, `glow-pulse`, `progress-shimmer`). `progress-shimmer` appears to be dead code (defined but not referenced by any component).
- **No design tokens for motion.** Each file hardcodes its own easing and duration. The only shared token is `--sidebar-transition: 250ms cubic-bezier(0.4, 0, 0.2, 1)`. Centralizing easing/duration in `@theme {}` is the prerequisite for coherence.
- **No `will-change` hints and no `view-transition-name`.** The View Transitions API is not used anywhere. Leave it as a possible future progressive enhancement — Safari iOS coverage still uneven as of this date.

**Approach chosen:** Radix `data-state` CSS keyframes for overlays (dialog, dropdown, tooltip) + `motion/react` `AnimatePresence` for non-Radix unmounts (mobile drawer, route outlet) + shared tokens in `@theme {}`. Rejected: adding `tailwindcss-animate`, migrating all overlays to `motion/react`, building horizontally layer-by-layer. Tracer-bullet plan: one route + one dialog + mobile drawer end-to-end before replicating to the rest of the app.

**Performance rule locked in:** only animate `transform`, `opacity`, `filter` — never `width`/`height`/`top`/`left`. Exception: the desktop sidebar `width` transition is pre-existing and works; leave it alone.

**E2E gotcha to watch:** adding close animations (even ~180 ms) can flake Playwright tests that do `click` → `expect(...).not.toBeVisible()` back-to-back. Mitigation: prefer `toBeHidden()`/`waitFor` in tests, or run Playwright with `prefers-reduced-motion: reduce` via launch args.

---

## 2026-04-11 — Fase 0 cerrada (tracer bullet end-to-end)

Implementación de Fase 0 del animation refactor. 5 archivos, 0 dependencias nuevas, ningún TODO pendiente en el código.

**Archivos:**

- `apps/web/src/styles/globals.css` — +7 motion tokens en `@theme` (easings, duraciones) +3 keyframes (`modal-exit`, `overlay-in`, `overlay-out`). No se añadieron `dropdown-exit` ni `fadeSlideLeftOut` por ser trabajo de Fase 1 y código muerto respectivamente.
- `apps/web/src/components/ui/dialog.tsx` — `DialogOverlay` y `DialogContent` con `data-[state=open]:animate-[...] data-[state=closed]:animate-[...]`. `DialogContent` centering migrado de `left-1/2 top-1/2 -translate-*` a `fixed inset-0 m-auto h-fit` para liberar `transform` para las keyframes.
- `apps/web/src/components/layout/app-sidebar.tsx` — drawer móvil envuelto en `AnimatePresence`, `<aside>` y backdrop migrados a `motion.aside` / `motion.div`, `useReducedMotion()` respetado, `willChange: 'transform'` scoped al drawer.
- `apps/web/src/components/layout/app-layout.tsx` — `<Outlet />` envuelto en `<AnimatePresence mode="wait">` + `motion.div` keyed por `pathname`. Cross-fade 180 ms, respeta reduced motion.
- `apps/web/src/router.tsx` — `defaultPendingMs: 200`, `defaultPendingMinMs: 400` en `createRouter`. No-op hasta Fase 4 (cuando migremos Suspense fallbacks), documentado como comentario inline.

**Descubrimientos de implementación (no obvios, vale la pena recordar):**

- **`DialogContent` tenía un bug de centering latente.** El componente se centraba con `-translate-x-1/2 -translate-y-1/2` y luego `.modal-box` aplicaba `animation: modal-enter ... forwards`. Una animación CSS sobreescribe el `transform` completo del elemento mientras corre, y `forwards` mantiene el estado final. El diálogo perdía el centering durante la animación y se quedaba descentrado al terminar. Nadie lo había notado porque la animación duraba 200 ms y el `modal-enter` era casi vertical. Al migrar el centering a `inset-0 m-auto h-fit` (patrón que ya usaban 4 modales nativos del proyecto), el `transform` queda libre para las keyframes y el bug desaparece automáticamente.
- **Radix difiere unmount con `getAnimations()`, pero solo para `animation-*`, no `transition-*`.** Si por error se usa `transition: opacity 200ms` en `data-[state=closed]`, Radix desmonta instantáneo y la animación de salida nunca corre. Documentar como norma: para overlays Radix, siempre `@keyframes` + `animate-[...]`, nunca transitions.
- **`defaultPendingMs` y `defaultPendingMinMs` de TanStack Router son no-op sin `defaultPendingComponent`.** Los flags controlan cuándo el router muestra su propio `pendingComponent`, no los fallbacks de React `<Suspense>`. El proyecto hoy envuelve cada ruta en su propio `<Suspense fallback={<Skeleton />}>`, así que los flags no hacen nada. Se dejan puestos porque es la configuración correcta y Fase 4 va a necesitarlos cuando migre los Suspense fallbacks al sistema del router.
- **Working tree con WIP ajeno al empezar.** `app-sidebar.tsx` y `app-layout.tsx` ya tenían cambios de una migración de i18n en curso antes de que empezara Fase 0. Mis ediciones apilaron encima sin conflicto. Importante para commits: un `git add <file>` en estos dos archivos trae también el WIP de i18n, así que commits atómicos requieren `git add -p`.

**Gate de verificación — estado al cerrar:**

- `bun run typecheck`: verde.
- `bun run lint` sobre los 5 archivos tocados: verde.
- `bun run lint` completo: 2 errores pre-existentes en WIP i18n (`delete-account-dialog.tsx`, `language-selector.tsx`), ajenos a Fase 0. Usuario autorizó saltar.
- `bun run format:check`: 10 warnings pre-existentes, todos del WIP i18n.
- `bun run test`: 469 pass / 12 fail. Las 12 en componentes i18n WIP (`confirm-dialog.test.tsx`, `guest-banner.test.tsx`, `login-page.test.tsx`), todas buscando literales español que los componentes ahora renderizan como `t('...')` keys. Ningún test de Fase 0 falla. El test `should have modal-box class on dialog element` sigue pasando (el refactor no rompió la assertion porque `.modal-box` CSS class se preservó — la consumen todavía 4 `<dialog>` nativos).
- `bun run build`: verde. `vendor-motion` bundle sin cambio de peso (134 kB / gzip 44 kB) — motion ya estaba en el grafo, Fase 0 solo añadió superficies de uso.
- `bun run e2e`: bloqueado. El webServer de Playwright arranca el go-api y pide `DATABASE_URL`; infra local no estaba levantada y no se autorizó levantarla en esta sesión.

**Cerrado como aceptable** con conocimiento de que la verificación final (E2E con infra + QA manual en iPhone Safari real) queda pendiente para cuando se retome Fase 1. El código está listo para que Fase 1 replique el patrón al resto de overlays Radix (dropdowns, tooltip, avatar-dropdown).
