# Plan UX Onboarding y Calendario

## TL;DR

> **Summary**: Mejorar la sensación de “app viva” incorporando un mentor/tutorial ligero en Home y reducir drásticamente la fricción de navegación en programas largos con jump-to-day, vista semanal, mensual y calendario de programa reutilizable en preview y tracker.
> **Estimated Effort**: Large

## Context

### Original Request

El usuario, en español, quiere mantener el onboarding actual al entrar a Gravity Room pero hacer que la app se sienta más viva con un widget o pequeño agente virtual estilo maestro/mentor anciano inspirado en Muten Roshi en Home, con un botón tipo “Bienvenido, ¿quieres un pequeño tutorial?”. Si hacen falta imágenes, quiere prompts para GPT Image 2.0 para generarlas manualmente. Además detecta que la vista previa de programas y el tracker abierto tienen demasiada navegación diaria: actualmente solo hay prev/next, por lo que ver el entrenamiento 1 desde el 150 requiere 149 clicks. Quiere vista semanal, mensual y acceso como calendario. También pide sugerir otras mejoras que valgan la pena.

### Key Findings

- Home vive en `apps/frontend/web/src/features/home/home-page.tsx` y ya compone `HomeHeader`, `HomeKpiStrip`, `ActiveProgramCard` y `HomeEmptyState` dentro de `StaggerContainer`/`StaggerItem`, así que el widget debe entrar como una tarjeta ligera sin romper el layout actual.
- El preview de programa está en `apps/frontend/web/src/features/program-preview/program-preview-page.tsx`; es una ruta standalone sin `AppLayout`, con `ProgramAboutSection`, `ProgramOverview`, `DayNavigator` y `DayView`/`DetailedDayView`.
- El tracker está en `apps/frontend/web/src/features/tracker/tracker-page.tsx` → `apps/frontend/web/src/features/tracker/program-app.tsx` → `apps/frontend/web/src/features/tracker/program-tab-content.tsx`; también usa `DayNavigator` y `DayView`/`DetailedDayView`.
- `apps/frontend/web/src/hooks/use-day-navigation.ts` centraliza la navegación del tracker, pero hoy solo expone `prev`, `next`, `goToCurrent` y toggle compact/detailed; necesita `selectDay`, `selectWeek`, preferencia de modo de navegación y bounds robustos.
- `apps/frontend/web/src/features/program-view/day-navigator.tsx` es el punto de dolor visible: botones anterior/siguiente, día actual, estado completado/pendiente, pero sin salto directo.
- El candidato más limpio para no inflar `DayNavigator` es crear `apps/frontend/web/src/features/program-view/calendar-navigator.tsx` y usarlo junto a `DayNavigator` en preview y tracker.
- Los textos i18n se concentran en `apps/frontend/web/src/lib/i18n/locales/es/translation.json` y `apps/frontend/web/src/lib/i18n/locales/en/translation.json`; ya existen claves `home.*`, `tracker.day_navigator.*`, `tracker.tab_content.*` y `calendar.*`.
- Hay tests con Bun + Testing Library en `apps/frontend/web/src/**/*.test.tsx`; scripts útiles: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` desde `apps/frontend/web`.
- `resultTimestamps` existe en tracker (`useProgram`, `useGuestProgram`, `StatsPanel`, `ActiveProgramCard`) como `Record<workoutIndex, ISO date>`, útil para pintar sesiones completadas en una vista de calendario real sin backend nuevo.
- `metadata` ya fluye por `ProgramApp` y existe `updateMetadata`; si en una fase futura se quisiera guardar una fecha de inicio/calendario real planificado, puede hacerse en metadata JSON sin migración, pero no es necesario para P0.
- El bug del mobile sidebar ya fue corregido por Loom moviendo `useTranslation` al nivel de `AppSidebar`; typecheck web OK. No incluirlo en este plan salvo como verificación de no regresión.

### Prompts GPT Image 2.0 para assets manuales

Usar estos prompts solo si se decide añadir assets generados. Evitar nombres, logos, símbolos o copias literales de personajes protegidos; la dirección visual es “mentor original de artes marciales + gym + sci-fi oscuro”.

- **Asset 1 — Mascota full-body transparente**:
  `Original anime-inspired elderly martial arts mentor for a dark sci-fi weightlifting app, full body, friendly confident pose, round sunglasses, long white beard, bald head, thick eyebrows, compact turtle-shell-inspired training backpack with no logos, sleeveless retro training gi redesigned in dark charcoal, teal and amber accents, holding a small clipboard with workout notes, subtle gravity-chamber glow, expressive but not comedic, high-quality clean cel shading, crisp silhouette, transparent background, 1024x1024, no text, no watermark, no copyrighted character, no exact Dragon Ball style, no Kame symbol, no orange gi replica.`
- **Asset 2 — Avatar/busto para card Home**:
  `Original elderly martial arts gym coach avatar, bust portrait, anime-inspired but unique, round sunglasses, white beard, warm smile, small sci-fi headset earpiece, dark gym lighting with amber rim light and cyan monitor glow, charcoal/teal martial arts training robe, subtle turtle-shell shaped shoulder pad as original design, clean cel-shaded vector look, centered composition, transparent background, 768x768, no text, no watermark, avoid any copyrighted symbols or exact existing characters.`
- **Asset 3 — Mini sticker/estado colapsado**:
  `Cute but mature original martial arts grandmaster gym mascot sticker, tiny chibi-like proportions but not childish, sunglasses, white beard, carrying a stylized weighted shell backpack, pointing at a holographic workout checklist, dark sci-fi gym palette, amber and cyan neon accents, thick readable outline for small UI use, transparent background, 512x512, no text, no watermark, no copyrighted logos, no exact character likeness.`
- **Asset 4 — Fondo opcional de tutorial**:
  `Dark sci-fi gravity training room background for a fitness tracker onboarding card, empty environment, squat rack silhouette, holographic calendar panels, subtle grain texture, amber warning lights, cyan data lines, premium anime background art, high contrast but UI-friendly, no characters, no text, 16:9, 1920x1080, no logos, no watermark.`
- **Asset 5 — Ilustración de calendario de programa**:
  `Stylized program calendar hologram for a dark gym web app, weekly and monthly workout tiles floating in a gravity chamber, checkmarks and small barbell icons, amber selected day, cyan completed days, dark charcoal background, clean anime sci-fi UI illustration, no text except abstract unreadable UI marks, 16:9, 1600x900, no logos, no watermark.`

## Objectives

### Core Objective

Crear una experiencia web más guiada y menos tediosa: Home debe comunicar personalidad y ayuda contextual con un mentor/tutorial no intrusivo, y preview/tracker deben permitir saltar rápidamente por programas largos mediante navegación diaria, semanal, mensual y calendario de programa.

### Deliverables

- [x] Añadir un widget de mentor/tutorial en Home, persistente por `localStorage`, con estados claros, textos ES/EN y sin dependencia de IA real.
- [x] Añadir navegación directa en preview y tracker: jump-to-day validado, selección de semana, selección mensual/program-calendar y conservación de prev/next existente.
- [x] Reutilizar el nuevo navegador en `ProgramPreviewPage` y `ProgramTabContent` con diferencias funcionales entre preview y tracker.
- [x] Añadir i18n ES/EN para el mentor, calendario, errores de input, labels ARIA y CTAs.
- [x] Añadir tests unitarios/componentes para storage del tutorial, navegación, grid semanal/mensual, estados completado/pendiente y accesibilidad básica.
- [x] Documentar prompts de imagen y mantener fallback sin imágenes para poder lanzar P0 sin bloquearse por assets.

### Definition of Done

- [x] Desde `apps/frontend/web`, `bun run typecheck` pasa.
- [x] Desde `apps/frontend/web`, `bun run lint` pasa sin warnings.
- [x] Desde `apps/frontend/web`, `bun run test` pasa e incluye cobertura nueva para mentor y calendario.
- [x] Desde `apps/frontend/web`, `bun run build` pasa.
- [x] En preview `/programs/$programId`, se puede saltar del entrenamiento 150 al 1 con input directo o grid en ≤2 interacciones.
- [x] En tracker `/app/tracker/$programId`, el día pendiente actual sigue funcionando, prev/next no regresa, y la selección directa no modifica resultados ni configuración.
- [x] En móvil, el navegador no desborda horizontalmente y mantiene objetivos táctiles de al menos 44px.
- [x] El tutorial puede completarse, descartarse y reiniciarse localmente sin llamadas a API.

### Guardrails (Must NOT)

- [x] No implementar IA real, chat backend, LLM calls, streaming ni endpoint nuevo para el mentor en esta iteración.
- [x] No introducir assets con copyright directo, nombres de personajes, logos o símbolos protegidos; usar un mentor original inspirado genéricamente en arquetipos de artes marciales.
- [x] No duplicar lógica de dominio GZCLP ni alterar `packages/domain` salvo que una fase futura lo justifique explícitamente.
- [x] No tocar backend ni añadir migraciones para P0/P1; usar `localStorage`, props existentes y, si se decide en P1/P2, `metadata` existente.
- [x] No reemplazar el onboarding actual de entrada; el widget debe complementar, no interrumpir.
- [x] No romper la ruta standalone de preview ni asumir `AppLayout` allí.

## TODOs

- [x] 1. P0 — Definir modelo UX del mentor Home y contrato de persistencia
     **What**: Diseñar el mentor como widget no intrusivo con estados `fresh`, `collapsed`, `expanded_intro`, `step_home`, `step_programs`, `step_tracker`, `completed`, `dismissed` y `returning_hint`. Persistir en `localStorage` con key versionada `gravity-room:mentor-tutorial:v1`; payload sugerido `{ completedAt?: string; dismissedAt?: string; lastStep?: string; version: 1 }`. Añadir acción “Repetir tutorial” visible en el propio widget o en estado completado. El widget debe funcionar para usuario autenticado e invitado, sin API.
     **Files**: `apps/frontend/web/src/features/home/home-mentor-widget.tsx`, `apps/frontend/web/src/features/home/mentor-tutorial-storage.ts`, `apps/frontend/web/src/features/home/home-page.tsx`, `apps/frontend/web/src/lib/i18n/locales/es/translation.json`, `apps/frontend/web/src/lib/i18n/locales/en/translation.json`
     **Acceptance**: Al entrar en Home por primera vez aparece una tarjeta/botón “Bienvenido, ¿quieres un pequeño tutorial?”; al completar o descartar no vuelve a abrirse automáticamente; limpiar localStorage reinicia el comportamiento.

- [x] 2. P0 — Implementar textos ES/EN del mentor sin depender de assets
     **What**: Añadir copy i18n para el widget con fallback visual CSS/icono si no hay imagen. Textos mínimos ES: título “Sensei de la Sala”, botón “Bienvenido, ¿quieres un pequeño tutorial?”, CTA “Empezar mini tutorial”, secundario “Ahora no”, pasos: “Tu programa activo vive aquí”, “Revisa estadísticas en Perfil”, “Abre Programas para elegir rutina”, “En el tracker puedes registrar éxito, fallo, AMRAP y RPE”. Textos EN equivalentes: “Gravity Sensei”, “Welcome, want a quick tour?”, “Start mini tour”, “Not now”, etc. Mantener tono cercano y motivacional, no invasivo.
     **Files**: `apps/frontend/web/src/lib/i18n/locales/es/translation.json`, `apps/frontend/web/src/lib/i18n/locales/en/translation.json`, `apps/frontend/web/src/features/home/home-mentor-widget.tsx`
     **Acceptance**: Cambiar idioma en la app cambia todos los textos del widget; no quedan strings hardcodeados salvo nombres técnicos no visibles.

- [x] 3. P0 — Insertar widget mentor en Home respetando layout actual
     **What**: Integrar el widget dentro del `StaggerContainer` de `HomePage`, preferiblemente después de `HomeHeader` y antes de `HomeKpiStrip` para que sea visible pero no tape KPIs. En mobile debe ser una card compacta; en desktop puede ser card horizontal con avatar placeholder, speech bubble y CTAs. Debe degradar bien si `user` es null o `isGuest`.
     **Files**: `apps/frontend/web/src/features/home/home-page.tsx`, `apps/frontend/web/src/features/home/home-mentor-widget.tsx`
     **Acceptance**: Home sigue mostrando `GuestBanner`, KPIs, programa activo o empty state como antes; el widget no bloquea navegación ni introduce layout shift grande.

- [x] 4. P0 — Añadir tests del mentor y storage
     **What**: Probar render inicial, completar tutorial, descartar tutorial, reabrir/repetir tutorial, compatibilidad con localStorage vacío/corrupto y copy básico con i18n mock existente. Si el patrón de tests de i18n requiere setup global, seguir el estilo de `home-empty-state.test.tsx`.
     **Files**: `apps/frontend/web/src/features/home/home-mentor-widget.test.tsx`, `apps/frontend/web/src/features/home/mentor-tutorial-storage.test.ts`
     **Acceptance**: `bun run test ./src/features/home` pasa y cubre los estados principales del widget.

- [x] 5. P0 — Extender navegación central con selección directa de día
     **What**: Añadir `handleSelectDay(index: number)` a `useDayNavigation`, con clamp `0..totalWorkouts - 1`, y exponer un setter equivalente en preview. Asegurar que si cambia `config` el tracker sigue reseteando al primer pendiente como hoy. En tracker, `selectedDayIndex` debe ser efímero: no persistir en `localStorage` ni `metadata`; al recargar debe volver al día pendiente actual. En preview, mantener el estado local existente si resulta suficiente y no moverlo al hook salvo necesidad clara. Añadir soporte para que `DayNavigator` o el nuevo `CalendarNavigator` puedan seleccionar un día sin loops ni stale state.
     **Files**: `apps/frontend/web/src/hooks/use-day-navigation.ts`, `apps/frontend/web/src/features/program-preview/program-preview-page.tsx`, `apps/frontend/web/src/features/tracker/program-app.tsx`, `apps/frontend/web/src/features/tracker/program-tab-content.tsx`
     **Acceptance**: Desde tracker y preview puede seleccionarse cualquier índice válido; índices inválidos se corrigen o muestran error sin romper render.

- [x] 6. P0 — Crear `CalendarNavigator` con jump-to-day y vista semanal básica
     **What**: Crear `apps/frontend/web/src/features/program-view/calendar-navigator.tsx` como componente reutilizable. Props recomendadas: `rows`, `selectedDayIndex`, `currentDayIndex`, `workoutsPerWeek`, `resultTimestamps?`, `context: 'preview' | 'tracker'`, `onSelectDay`. P0 debe incluir: input numérico “Ir al entrenamiento”, botón “Ir”, chips de semana (`Semana 1`, `Semana 2`, etc.), grid de la semana seleccionada y estados visuales `selected`, `current`, `completed`, `pending`, `locked/preview` si aplica. El chunking de semanas debe tolerar semanas incompletas: `rows.slice(weekStart, weekStart + workoutsPerWeek)` puede devolver menos elementos y debe renderizar solo tiles disponibles o placeholders seguros, nunca acceder a `undefined`. Desde el diseño inicial, incluir mínimos de accesibilidad: `aria-label` en botones de semana/mes, `aria-current` o equivalente textual en el día seleccionado, labels para input/botón de jump, foco visible y targets táctiles de al menos 44px. Mantener `DayNavigator` para prev/next y resumen del día.
     **Files**: `apps/frontend/web/src/features/program-view/calendar-navigator.tsx`, `apps/frontend/web/src/features/program-view/calendar-navigator.test.tsx`, `apps/frontend/web/src/lib/i18n/locales/es/translation.json`, `apps/frontend/web/src/lib/i18n/locales/en/translation.json`
     **Acceptance**: En un programa de 200 entrenamientos, escribir `1` y confirmar selecciona el primer entrenamiento; elegir `Semana 38` muestra los entrenamientos de esa semana sin navegar click a click; la última semana incompleta no crashea ni muestra tiles rotos; los controles principales son navegables por teclado y anunciables por lector de pantalla.

- [x] 7. P0 — Integrar navegador P0 en preview de programas
     **What**: Insertar `CalendarNavigator` debajo de `DayNavigator` en `ProgramPreviewPage`. Preview debe usar semanas de programa, no fechas reales: `weekIndex = floor(dayIndex / workoutsPerWeek)`, label “Semana de programa N”, sin estados de completado reales salvo `selected/current` donde `currentDayIndex` es `0`.
     **Files**: `apps/frontend/web/src/features/program-preview/program-preview-page.tsx`, `apps/frontend/web/src/features/program-view/calendar-navigator.tsx`
     **Acceptance**: La ruta `/programs/$programId` mantiene CTA auth/start, about/overview y toggle compact/detailed; el calendario no requiere login.

- [x] 8. P0 — Integrar navegador P0 en tracker
     **What**: Pasar `rows`, `workoutsPerWeek`, `resultTimestamps`, `selectedDayIndex`, `currentDayIndex` y `onSelectDay` desde `ProgramApp` hacia `ProgramTabContent` y luego a `CalendarNavigator`. En tracker, `completed` debe derivarse preferentemente de `row.slots.every(result !== undefined)` y opcionalmente mostrar fecha completada si `resultTimestamps[String(row.index)]` existe.
     **Files**: `apps/frontend/web/src/features/tracker/program-app.tsx`, `apps/frontend/web/src/features/tracker/program-tab-content.tsx`, `apps/frontend/web/src/features/program-view/calendar-navigator.tsx`
     **Acceptance**: El día pendiente actual sigue resaltado; días completados se distinguen visualmente; seleccionar un día pasado no altera resultados.

- [x] 9. P0 — Añadir tests de navegación directa y semana
     **What**: Cubrir utilidades de chunking/clamp si se extraen, render de semana con programas 3x/4x/6x por semana, selección por input, selección por chip, estados selected/current/completed y labels ARIA. Probar que preview con `currentDayIndex=0` no intenta leer timestamps.
     **Files**: `apps/frontend/web/src/features/program-view/calendar-navigator.test.tsx`, `apps/frontend/web/src/hooks/use-day-navigation.test.ts`
     **Acceptance**: Tests fallan si el jump-to-day vuelve a requerir navegación secuencial o si un índice fuera de rango rompe el componente.

- [x] 10. P1 — Añadir modos daily/weekly/monthly persistidos
      **What**: Evolucionar `CalendarNavigator` con selector segmentado `Día | Semana | Mes` (`day | week | month`) y persistencia local `gravity-room:program-navigation-mode:v1`. `day` muestra jump + resumen compacto del entrenamiento actual; `week` muestra grid de semana; `month` muestra 4–6 semanas de programa por página. La persistencia debe ser local y no afectar la preferencia existente de `ViewMode` compact/detailed.
      **Files**: `apps/frontend/web/src/features/program-view/calendar-navigator.tsx`, `apps/frontend/web/src/features/program-view/program-navigation-preference.ts`, `apps/frontend/web/src/lib/i18n/locales/es/translation.json`, `apps/frontend/web/src/lib/i18n/locales/en/translation.json`
      **Acceptance**: Cambiar a vista mensual, recargar y volver al tracker conserva la vista mensual; el toggle compact/detailed de ejercicios sigue funcionando independientemente.

- [x] 11. P1 — Diseñar semántica “semanas de programa” vs “calendario real”
      **What**: En preview, mostrar solo calendario de programa: semanas y meses relativos (`Mes de programa 1`, `Semanas 1–4`). En tracker, ofrecer inicialmente dos lecturas: `Programa` (plan relativo completo) y `Historial real` (plot de sesiones completadas por `resultTimestamps`, sin inventar fechas futuras). Añadir microcopy: “Las fechas reales aparecen cuando completas entrenamientos”. No crear scheduling futuro todavía.
      **Files**: `apps/frontend/web/src/features/program-view/calendar-navigator.tsx`, `apps/frontend/web/src/lib/i18n/locales/es/translation.json`, `apps/frontend/web/src/lib/i18n/locales/en/translation.json`
      **Acceptance**: El usuario entiende si está viendo semanas relativas o fechas reales; preview nunca muestra calendario real; tracker no promete fechas futuras sin datos.

- [x] 12. P1 — Mejorar vista mensual con resumen y densidad responsive
      **What**: En vista mensual, cada tile debe mostrar número de entrenamiento, abreviatura del día (`dayName` recortado), icono/estado y tooltip/title accesible con nombre completo. En mobile, usar grid de 2–4 columnas o lista por semanas para evitar tiles demasiado pequeños; en desktop usar grid mensual completo. Añadir navegación de mes anterior/siguiente y botón “Actual”.
      **Files**: `apps/frontend/web/src/features/program-view/calendar-navigator.tsx`, `apps/frontend/web/src/features/program-view/calendar-navigator.test.tsx`
      **Acceptance**: Programas de 150–212 sesiones se pueden explorar por meses sin scroll horizontal ni clicks excesivos; los targets táctiles siguen siendo ≥44px.

- [x] 13. P1 — Añadir tracking analítico no sensible para interacción UX
      **What**: Usar `trackEvent` existente para eventos agregados: `mentor_tutorial_start`, `mentor_tutorial_complete`, `program_navigation_jump`, `program_navigation_mode_change`. No enviar datos sensibles ni ejercicios/pesos; como máximo `context`, `mode`, `program_id` si ya se usa en preview tracking, y buckets (`total_workouts_bucket`) si se desea.
      **Files**: `apps/frontend/web/src/features/home/home-mentor-widget.tsx`, `apps/frontend/web/src/features/program-view/calendar-navigator.tsx`, `apps/frontend/web/src/features/program-preview/program-preview-page.tsx`
      **Acceptance**: Los eventos se disparan una vez por acción relevante y no saturan analytics al renderizar.

- [x] 14. P1 — Incorporar assets opcionales del mentor con fallback seguro
      **What**: Si el usuario genera assets con GPT Image 2.0, añadirlos como archivos estáticos optimizados y usarlos en el widget. Si no existen, mantener el avatar CSS/icono. Evitar dependencias remotas. Recomendación de rutas: `apps/frontend/web/public/mentor/coach-avatar.webp`, `apps/frontend/web/public/mentor/coach-sticker.webp`.
      **Files**: `apps/frontend/web/public/mentor/coach-avatar.webp`, `apps/frontend/web/public/mentor/coach-sticker.webp`, `apps/frontend/web/src/features/home/home-mentor-widget.tsx`
      **Acceptance**: La app compila con o sin assets; Lighthouse/preview no acusa imágenes gigantes; `alt` describe “mentor de entrenamiento” sin referencias protegidas.

- [x] 15. P2 — Tutorial contextual por rutas sin IA real
      **What**: Convertir el mini tutorial en tours contextuales discretos por zona: Home, Programas, Preview, Tracker y Perfil. No usar overlays invasivos inicialmente; preferir checklist progresivo y links profundos. Persistir pasos vistos en la misma key versionada o una nueva `gravity-room:mentor-tour:v2`.
      **Files**: `apps/frontend/web/src/features/home/home-mentor-widget.tsx`, `apps/frontend/web/src/features/home/mentor-tutorial-storage.ts`, `apps/frontend/web/src/features/programs/programs-page.tsx`, `apps/frontend/web/src/features/program-preview/program-preview-page.tsx`, `apps/frontend/web/src/features/tracker/program-tab-content.tsx`, `apps/frontend/web/src/features/profile/profile-page.tsx`
      **Acceptance**: Un usuario nuevo puede descubrir las zonas clave sin modal obligatorio; un usuario recurrente no ve prompts repetitivos.

- [x] 16. P2 — Scheduling real opcional con metadata, sin migración — BLOCKED/SKIPPED: requiere confirmación explícita del usuario antes de planificar fechas reales futuras.
      **What**: Si el usuario confirma que quiere calendario real planificado, añadir configuración opcional de fecha de inicio y días preferidos de entrenamiento almacenada en `metadata` del programa activo (`calendarStartDate`, `trainingWeekdays`). Derivar futuras fechas solo cuando haya esa configuración. Preview sigue relativo.
      **Files**: `apps/frontend/web/src/features/tracker/program-app.tsx`, `apps/frontend/web/src/features/tracker/program-tab-content.tsx`, `apps/frontend/web/src/features/program-view/calendar-navigator.tsx`, `apps/frontend/web/src/lib/i18n/locales/es/translation.json`, `apps/frontend/web/src/lib/i18n/locales/en/translation.json`
      **Acceptance**: El calendario real muestra futuro solo tras configuración explícita; no requiere migración de DB; guardar metadata no borra otros metadatos existentes.

- [x] 17. P2 — Mejoras adicionales sugeridas con prioridad
      **What**: Evaluar e implementar solo si P0/P1 ya están estables. Prioridad alta: “Continuar entrenamiento” sticky en Home/ActiveProgramCard con próximo slot pendiente; indicador de “última sesión” más visible; búsqueda/filtro rápido dentro de programas largos por ejercicio. Prioridad media: celebraciones sutiles de PR/streak, skeletons menos estáticos, comandos de teclado visibles (`←/→`, `S` éxito, `F` fallo, `U` undo). Prioridad baja: historial/calendario en Perfil usando `profile-history.tsx`, export visual del mes, tema/acento configurable del coach.
      **Files**: `apps/frontend/web/src/features/dashboard/active-program-card.tsx`, `apps/frontend/web/src/features/home/home-page.tsx`, `apps/frontend/web/src/features/profile/profile-history.tsx`, `apps/frontend/web/src/features/tracker/program-tab-content.tsx`
      **Acceptance**: Cada mejora se trocea en PRs pequeños y no desplaza la navegación calendario ni mentor P0/P1.

- [x] 18. Verificación manual responsive y accesibilidad
      **What**: Revisar Home, preview y tracker en anchos aproximados 360px, 390px, 768px y desktop. Esta tarea es validación final, no refactor principal: los mínimos de ARIA/touch targets del `CalendarNavigator` deben estar ya implementados en la tarea 6. Validar foco visible, `aria-label` en botones/iconos, labels de inputs, `aria-current` o equivalente para día seleccionado, `aria-live` solo si es útil y no ruidoso. Probar teclado: tab order lógico, Enter en jump, Escape/cerrar widget si aplica.
      **Acceptance**: No hay overflow horizontal; los controles críticos tienen 44px mínimos; lector de pantalla puede distinguir día seleccionado, actual y completado.

- [x] 19. Verificación final de comandos web
      **What**: Ejecutar checks de calidad del frontend web.
      **Acceptance**: En `apps/frontend/web`, pasan `bun run typecheck`, `bun run lint`, `bun run test` y `bun run build`.

## Verification

- [x] All tests pass: `cd apps/frontend/web && bun run test`.
- [x] No regressions: `cd apps/frontend/web && bun run typecheck && bun run lint && bun run build`.
- [x] Home muestra el mentor en primera visita, permite “Empezar mini tutorial”, “Ahora no”, completar y repetir sin llamadas de red nuevas.
- [x] Preview `/programs/$programId` conserva about/overview/CTA y permite jump-to-day, vista semanal y mensual de programa.
- [x] Tracker `/app/tracker/$programId` conserva setup, toolbar, tabs, compact/detailed, shortcuts prev/next y registro de resultados.
- [x] Programas largos (`caparazon-de-tortuga`, `365-programmare-lipertrofia`, `la-sala-del-tiempo`) pueden navegarse del final al inicio en ≤2 interacciones.
- [x] i18n ES/EN completo para mentor y calendario; no hay textos visibles hardcodeados.
- [x] Responsive sin overflow horizontal en mobile y con targets táctiles ≥44px.
- [x] Accesibilidad básica: labels, foco visible, estados selected/current/completed distinguibles por texto/ARIA además de color.
- [x] No se añadieron endpoints, migraciones ni lógica de IA real.
