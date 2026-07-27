# Gravity Room Mobile v2 — diario de implementación

Última actualización: 2026-07-27

Rama de integración: `codex/mobile-v2`

Baseline congelado: `dcdec26f72a39ae5c0d76944829584335a337a64`

Este documento es el registro vivo del ciclo completo. Cada rol añade aquí el SHA exacto, findings,
resoluciones y checks que realmente ejecutó. Una celda pendiente no equivale a una aprobación.

## Topología fija

| Rol           | Worktree                        | Regla                                              |
| ------------- | ------------------------------- | -------------------------------------------------- |
| Implementador | `.worktrees/mobile-v2-impl`     | Implementa el slice y entrega el candidato         |
| Revisor A     | `.worktrees/mobile-v2-review-a` | Spec, UX, accesibilidad, localización y cobertura  |
| Revisor B     | `.worktrees/mobile-v2-review-b` | Datos, offline, concurrencia, seguridad y tipos    |
| Corrector     | `.worktrees/mobile-v2-fix`      | Resuelve los findings aceptados desde el candidato |

Main normaliza findings, decide deuda y hace la integración. Los revisores inspeccionan el mismo SHA y
vuelven a verificar el SHA corregido. Los cuatro directorios se reutilizan; las tareas de revisión
empiezan con contexto fresco por slice.

## Regla de E2E

No se ejecuta E2E entre slices. Unit tests, lint, typecheck, formato y checks de contrato sí son puertas
por slice. El E2E nativo completo se ejecuta una sola vez en M8, después de integrar M0-M7 y antes de
declarar Mobile v2 terminada. Un fallo E2E final reabre el slice responsable y vuelve al corrector.

## Baseline reproducible de M0

Medido sobre el SHA congelado, antes de cambios M0:

| Métrica                     | Valor | Definición                                       |
| --------------------------- | ----: | ------------------------------------------------ |
| Archivos de producto TS/TSX |    25 | `App.tsx` y `src`, excluyendo `*.test.*`         |
| LOC de producto TS/TSX      | 3.836 | Líneas físicas, incluidos blancos/comentarios    |
| Suites móviles              |    17 | Ficheros `*.test.ts`, `*.test.tsx` y `*.test.js` |
| Casos móviles               |   147 | Invocaciones `it(` / `test(`                     |
| LOC de tests                | 5.274 | Líneas físicas de las 17 suites                  |
| Catálogos i18n              |     2 | `en` y `es`, paridad exigida                     |
| Esquema SQLite              |    v1 | 4 tablas, `PRAGMA user_version = 1`              |

Reproducción de conteos desde PowerShell:

```powershell
$baseSha = "dcdec26f72a39ae5c0d76944829584335a337a64"
$files = git ls-tree -r --name-only $baseSha -- apps/frontend/mobile
$sourceFiles = $files | Where-Object {
  ($_ -match "\.(ts|tsx)$") -and ($_ -notmatch "\.test\.(ts|tsx)$")
}
$testFiles = $files | Where-Object { $_ -match "\.test\.(ts|tsx|js)$" }
$sourceLines = 0
$testLines = 0
$testCases = 0
foreach ($file in $sourceFiles) {
  $sourceLines += @(git show "${baseSha}:$file").Count
}
foreach ($file in $testFiles) {
  $content = git show "${baseSha}:$file"
  $testLines += @($content).Count
  $testCases += @($content | Select-String -Pattern "\b(it|test)\(" -AllMatches).Matches.Count
}
[pscustomobject]@{
  SourceFiles = $sourceFiles.Count
  SourceLines = $sourceLines
  TestSuites = $testFiles.Count
  TestLines = $testLines
  TestCases = $testCases
}
```

No se registran tiempos de arranque, bundle ni render en M0: no había harness nativo reproducible en el
baseline y una cifra tomada del host de desarrollo no sería una métrica fiable. M8 debe crear el
harness y capturar dispositivo, build, escenario, repeticiones y percentiles antes de fijar objetivos.

## Estado de slices

| Slice                       | Estado              | Base       | Candidato | Corregido | Integrado |
| --------------------------- | ------------------- | ---------- | --------- | --------- | --------- |
| M0 Contratos y baseline     | integrado           | `dcdec26f` | `0fcc4c6` | `1b39abd` | `1b39abd` |
| M1 Shell y navegación       | integrado           | `3af51a0`  | `aa06f7c` | `6d6c0c7` | `78adf51` |
| M2 Programas                | candidato pendiente | `78adf51`  | pendiente | pendiente | pendiente |
| M3 Tracker offline          | pendiente           | pendiente  | pendiente | pendiente | pendiente |
| M4 Historial/temporizador   | pendiente           | pendiente  | pendiente | pendiente | pendiente |
| M5 Perfil/datos             | pendiente           | pendiente  | pendiente | pendiente | pendiente |
| M6 Programas personalizados | pendiente           | pendiente  | pendiente | pendiente | pendiente |
| M7 Wiki contextual          | pendiente           | pendiente  | pendiente | pendiente | pendiente |
| M8 Hardening/release/E2E    | pendiente           | pendiente  | pendiente | pendiente | pendiente |

## M0 — Contratos y baseline

### Alcance entregado por el implementador

- Plan de producto incorporado a la rama.
- ADRs de navegación, sesiones/set logs, SQLite/outbox y definiciones personalizadas.
- ESLint 9 real para TS/TSX móvil y scripts package/root.
- Fixtures tipados canónicos de programa, workout, outbox y snapshots SQLite.
- Pruebas unitarias del bootstrap v1.
- Check específico de paridad i18n ES/EN.

### Corrección tras revisiones

- SQL contractual v2 separado de `MIGRATIONS` y ejecutado con Node 24/SQLite 3.53.1 sobre una base v1
  vacía y otra con filas.
- Caches y cola v1 preservadas en cuarentena sin owner; tablas operativas nuevas particionadas por
  usuario y outbox cerrada.
- Constraints e índices de sesiones, set logs, outbox, lifecycle y ownership probados por SQLite.
- Fixtures preset/custom separadas con UUIDs e invariantes cruzadas.
- Reglas de assertions y non-null activas también en tests; solo dos factories Jest conservan una
  excepción de `require` por fichero.
- Métricas estáticas congeladas; harness y baseline nativa antes/después diferidos explícitamente a M8.

### Segunda corrección tras reverificación

- Expo SQLite se compila con foreign keys activas por defecto en Android/iOS; el adapter activa la
  conexión principal y verifica cada conexión exclusiva antes de ejecutar su transacción.
- Las ocho tablas contractuales v2 son `STRICT`; probes reales rechazan texto/fracciones en
  `workout_index`, `attempt_count`, `reps` y `weight_kg`.
- `DatabaseClient.getAllAsync` devuelve `unknown[]`, usa `SQLiteBindValue` y todos los repositorios
  consumidores validan cada fila antes de exponerla.
- Eliminados el doble cast y la excepción ESLint que lo ocultaba en el fake del bootstrap.

### Candidatos, revisiones y correcciones

| Evento                  | SHA / estado                               | Evidencia                                       |
| ----------------------- | ------------------------------------------ | ----------------------------------------------- |
| Candidato implementador | `0fcc4c6629ef6c485fba68996de9e56709012d1f` | Commit M0 revisado por ambos revisores          |
| Revisión A              | 6 findings: 3 P1, 3 P2                     | `M0-A-001` a `M0-A-006`                         |
| Revisión B              | 5 findings: 3 P1, 2 P2                     | `M0-B-001` a `M0-B-005`                         |
| Normalización Main      | N1-N6                                      | 5 aceptados; N5 diferido a M8 por decisión Main |
| Corrector 1             | `d8db3c0bf69c766c53c013ffd251c97e32984434` | Primera matriz N1-N6                            |
| Reverificación A        | aprobada sobre `d8db3c0`                   | N1-N6 verificados                               |
| Reverificación B        | `no-go` sobre `d8db3c0`                    | `M0-VB-001` P1, `M0-VB-002` P1, `M0-VB-003` P2  |
| Corrector 2             | `1b39abd7dca75a0d57a1c8e056ff2f8e519260cc` | Segunda matriz VB-001 a VB-003                  |
| Reverificación final A  | `go` sobre `1b39abd`                       | 6 suites focalizadas; 31/31 tests               |
| Reverificación final B  | `go` sobre `1b39abd`                       | Probes de FK, STRICT, parsers y aislamiento     |
| Decisión Main           | `go`                                       | Fast-forward a `codex/mobile-v2`                |

### Checks M0

| Check                                                          | Resultado                   | Nota                                         |
| -------------------------------------------------------------- | --------------------------- | -------------------------------------------- |
| `pnpm exec prettier --check ...`                               | verde                       | Scope M0 corregido                           |
| `pnpm --filter mobile lint`                                    | verde                       | Assertions/non-null activos en tests         |
| `pnpm --filter mobile typecheck`                               | verde                       | Expo tsconfig + contrato Node tipado         |
| `pnpm --filter mobile i18n:check`                              | verde: 1 suite, 8 tests     | 0 missing keys ES/EN                         |
| `pnpm --filter mobile test`                                    | verde: 20 suites, 168 tests | Incluye Node 24 / SQLite 3.53.1 real         |
| `pnpm --filter mobile exec expo config --type prebuild --json` | verde                       | Expone `SQLITE_DEFAULT_FOREIGN_KEYS=1`       |
| Métricas nativas                                               | no medidas                  | Harness + baseline antes/después van a M8    |
| E2E                                                            | no ejecutado por política   | Se difiere hasta M8; no es un check M0 verde |

### Findings y resolución

| Normalizado | Origen                 | Severidad | Estado   | Resolución                                                                                                                                      |
| ----------- | ---------------------- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| N1          | `M0-A-001`, `M0-B-002` | P1        | fixed    | SQL exacto ejecutado con `node:sqlite`; cubre fresh/v1 con filas, schema, rollback y segundo arranque.                                          |
| N2          | `M0-A-002`, `M0-B-001` | P1        | fixed    | Legacy queda sin owner en cuarentena; claim exige prueba de servidor y las tablas/outbox se particionan por usuario.                            |
| N3          | `M0-A-003`, `M0-B-003` | P1        | fixed    | Preset usa UUID de instancia, `definitionId = null`; fixture custom separada conserva UUID/source/snapshot coherentes.                          |
| N4          | `M0-A-004`, `M0-B-005` | P2        | fixed    | Eliminados overrides globales de assertions/non-null; el fake implementa `DatabaseClient` tras un adapter y ya no se presenta como SQLite real. |
| N5          | `M0-A-005`, `M0-B-004` | P2        | deferred | Main difiere métricas nativas a M8: primero se crea harness y baseline antes/después; M0 solo congela métricas estáticas.                       |
| N6          | `M0-A-006`             | P2        | fixed    | SQL añade y prueba CHECKs de status/completed_at, enums, booleanos y rangos de workout/set logs.                                                |
| VB-001      | `M0-VB-001`            | P1        | fixed    | Flag nativo activa foreign keys en toda conexión; adapter activa la principal y verifica fail-closed cada conexión exclusiva.                   |
| VB-002      | `M0-VB-002`            | P1        | fixed    | Ocho tablas `STRICT`; probes SQLite rechazan texto y fracciones en columnas numéricas de sesiones, sets y outbox.                               |
| VB-003      | `M0-VB-003`            | P2        | fixed    | Boundary devuelve `unknown[]`; repositorios estrechan filas y no quedan casts ni disables para fingir tipos SQLite.                             |

### Handoff Main

- Código aprobado e integrado mediante fast-forward: `1b39abd7dca75a0d57a1c8e056ff2f8e519260cc`.
- Los dos verificadores finales trabajaron en worktrees detached sobre ese SHA y devolvieron `go` sin
  findings nuevos.
- M1 parte del HEAD de integración posterior a este registro de orquestación.
- E2E continúa sin ejecutarse y permanece reservado para M8.

## M2 — Programas: biblioteca y gestión

Inicio: 2026-07-27

Base congelada: `78adf51dc98ad77b8302d0042c7ffae7538bfcea`

Estado: implementación, checks y revisión manual completos; commit pendiente

### Alcance del candidato

- Programa fijado y listas activa, completada y archivada.
- Catálogo y ficha de preset con setup validado por `ProgramDefinition` del dominio.
- Crear online-only; renombrar, archivar, reactivar, completar y eliminar instancias.
- Caché local particionada por usuario y estados offline de lectura.
- Confirmación de borrado y limpieza local relacionada únicamente después del éxito remoto.
- Pruebas de estado, pin, validación, offline, mutaciones, rollback y coherencia.

### Checks M2

| Check                                                          | Resultado                            | Nota                                   |
| -------------------------------------------------------------- | ------------------------------------ | -------------------------------------- |
| `pnpm exec prettier --check ...`                               | verde                                | Fuentes, tests, dominio y diario M2    |
| `pnpm --filter mobile routes:check`                            | verde                                | Manifiesto versionado sin drift        |
| `pnpm --filter mobile lint`                                    | verde                                | TS/TSX móvil                           |
| `pnpm --filter mobile typecheck`                               | verde                                | Incluye `routes:check`                 |
| `pnpm run typecheck:domain`                                    | verde                                | Validación canónica de setup           |
| `pnpm --filter mobile i18n:check`                              | verde: 1 suite, 8 tests              | 0 missing ES/EN                        |
| `pnpm --filter mobile test`                                    | verde: 33 suites, 202 tests          | Incluye migraciones SQLite reales      |
| `pnpm run test:domain`                                         | verde: 7 ficheros, 45 tests          | Reglas y validación de configuración   |
| `pnpm --filter mobile exec expo install --check`               | verde                                | Dependencias compatibles               |
| `pnpm --filter mobile exec expo config --type prebuild --json` | verde                                | Config prebuild resoluble              |
| Export Expo Android                                            | verde: 1.241 módulos, Hermes 3,79 MB | 24 assets; artefacto temporal ignorado |
| E2E                                                            | no ejecutado por política            | Reservado para M8                      |

### Candidato y riesgos

- SHA candidato: pendiente hasta crear el commit normal.
- Diff completo y efectos secundarios revisados manualmente. `autoreview --mode local` falló cerrado
  antes de invocar al modelo porque el lado anterior del diff de un test contiene campos
  `accessToken` que su escáner clasifica como contenido sensible; no existe dictamen estructurado.
- El SQL contractual v2 completo continúa fuera de `MIGRATIONS`; M2 adapta solo la persistencia
  necesaria y no implementa sesiones/outbox runtime.
- Las filas legacy permanecen sin owner salvo prueba remota; M2 no atribuye datos por la sesión activa.
- La creación de instancias permanece online-only porque la API actual no ofrece idempotencia.
- M2 registra una migración parcial con tablas paralelas `mobile_v2_program_*`; conserva intactas las
  tablas/caches/cola v1 sin owner. M3 deberá componer la migración final sin reutilizar el número 2.
- M3, M4+, el editor personalizado y el API custom de M6 permanecen fuera de alcance.

### Deuda/riesgos conocidos

- Los modelos objetivo de sesión y outbox están decididos, pero se implementan en M3-M4.
- La API de definiciones requiere cambios coordinados de DB/API/dominio/cliente en M6.
- El SQL v2 está probado pero no desplegado: M2-M3 deben adaptar repositorios antes de registrarlo en
  `MIGRATIONS`.
- La configuración de foreign keys depende de regenerar los proyectos nativos con el config plugin
  antes del siguiente build; las pruebas de M0 congelan tanto el flag como el guard runtime.
- Las métricas nativas de rendimiento siguen sin medir por decisión Main. M8 debe crear el harness y
  capturar baseline antes/después; M0 no afirma una medición inexistente.

## M1 — Shell, navegación y sistema visual

Inicio: 2026-07-27

Base congelada: `3af51a02f4bb6414b14543d7d36e52243b9305f2`

Estado: integrado en `.worktrees/mobile-v2-impl`; M1 cerrado

### Alcance del candidato

- Expo Router y rutas tipadas/deep links.
- Frontera autenticada con Login fuera de tabs.
- Tabs exactas Programas, Tracker y Perfil, preservando sus stacks.
- Providers raíz, error boundary y bootstrap SQLite.
- Tokens/componentes base estrictamente necesarios para el shell.
- Adaptadores finos de ruta; las features no importan el router.
- Preservación de auth, programas y tracker v1 sin cambiar resultados.
- Contratos unitarios de auth/deep links/bootstrap y prueba de integración real de tabs con
  `expo-router/testing-library`, incluida la preservación de estado al cambiar de pestaña.

### Candidatos, revisiones y correcciones

| Evento                   | SHA / estado                               | Evidencia                                                  |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------- |
| Base M1                  | `3af51a0`                                  | HEAD de integración al iniciar el slice                    |
| Candidato implementador  | `aa06f7cc66785b40739ef4e58e0e4f5f743ea4c3` | Commit M1 revisado por ambos revisores                     |
| Revisión A               | `no-go`: 7 findings                        | `M1-A-001` a `M1-A-007`                                    |
| Revisión B               | `no-go`: 4 findings                        | `M1-B-001` a `M1-B-004`                                    |
| Normalización Main       | N1-N8                                      | Todos aceptados para corrección                            |
| Corrector                | `2dd20f56722ce2e3cd052ac7b0922b4e37cdf076` | Matriz N1-N8, checks completos y snapshot limpio           |
| Reverificación final A   | `no-go`: 2 findings                        | `M1-VFA-001` P1 y `M1-VFA-002` P2                          |
| Reverificación final B   | `no-go`: 2 findings                        | `M1-VFB-001` P1 y `M1-VFB-002` P2                          |
| Normalización Main 2     | C1-C4                                      | Los cuatro aceptados para segunda corrección               |
| Corrector 2              | `6d6c0c7acf1344852437501adae31167092d8a89` | Matriz C1-C4, checks completos y snapshot limpio           |
| Reverificación final 2 A | `go` sobre `9aef938`                       | C1-C4 y N1-N8 PASS; 30 suites/183 tests                    |
| Reverificación final 2 B | no abierta                                 | Límite interno de hilos; no se fabricó un segundo dictamen |
| Auditoría Main           | `go` sobre `9aef938`                       | Delta exacto, lifecycle, a11y, manifest y tests revisados  |
| Decisión Main            | `go`                                       | Listo para fast-forward a `codex/mobile-v2`                |

### Checks M1

| Check                                                          | Resultado                   | Nota                                                |
| -------------------------------------------------------------- | --------------------------- | --------------------------------------------------- |
| `pnpm exec prettier --check ...`                               | verde                       | Fuentes, tests, manifiesto y scripts M1 corregidos  |
| `pnpm --filter mobile lint`                                    | verde                       | TS/TSX + rutas                                      |
| `pnpm --filter mobile typecheck`                               | verde                       | Ejecuta antes `routes:check`; no depende de `.expo` |
| `pnpm --filter mobile i18n:check`                              | verde: 1 suite, 8 tests     | 0 missing keys ES/EN                                |
| `pnpm --filter mobile test`                                    | verde: 30 suites, 183 tests | A11y, same-tree restore, placeholders y foco real   |
| `pnpm --filter mobile exec expo install --check`               | verde                       | Dependencias compatibles con Expo 54                |
| `pnpm --filter mobile exec expo config --type prebuild --json` | verde                       | Config plugins, scheme y entrypoint                 |
| Export/bundle Expo Android                                     | verde: 1.238 módulos        | Hermes bundle 3,73 MB                               |
| E2E                                                            | no ejecutado por política   | Reservado para M8                                   |

### Findings normalizados y corrección

| Normalizado | Origen                 | Severidad | Estado                            | Resolución                                                                                                                                                                                                                                           |
| ----------- | ---------------------- | --------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1          | `M1-A-001`             | P1        | fixed                             | Cada tab posee su Stack real (`programs`, `tracker`, `profile`); el test de integración usa los paths `index` del árbol generado y conserva estado al alternar tabs.                                                                                 |
| N2          | `M1-A-002`             | P1        | fixed                             | El root protege el destino exacto `program/[instanceId]` y todas las rutas autenticadas; tests con `renderRouter` cubren cold link anónimo y autenticado.                                                                                            |
| N3          | `M1-B-001`             | P1        | fixed                             | Root Stack y árbol de rutas se montan en el primer render. Bootstrap SQLite y restore de auth usan overlays bloqueantes, preservando el cold link durante la espera.                                                                                 |
| N4          | `M1-A-003`, `M1-B-002` | P1        | fixed con integración M3 diferida | Resolver probado: workout activo → `/tracker`; si no, última tab válida persistida; fallback `/programs`. El adapter de workout devuelve `false` hasta que M3 implemente el repositorio; M1 no activa el esquema v2 ni afirma una query inexistente. |
| N5          | `M1-A-004`             | P1        | fixed                             | El adapter de ruta incrementa una revisión con `useFocusEffect`; Tracker relee selección y programas al recuperar foco. La feature no importa Expo Router y una prueba cambia la selección entre focos.                                              |
| N6          | `M1-A-005`, `M1-B-004` | P2        | fixed como contrato               | Se reservan placeholders protegidos, seguros y localizados para programa nuevo/editor, historial/sesión, índice/detalle de ejercicios y sync, sin presentar flujos M2+ como implementados.                                                           |
| N7          | `M1-A-006`             | P2        | fixed                             | Volver desde un cold program link usa `canGoBack()` y reemplaza a `/programs` cuando no existe historial; ambos caminos tienen pruebas.                                                                                                              |
| N8          | `M1-A-007`, `M1-B-003` | P2        | fixed                             | Script Node determinista genera un manifiesto versionado desde `src/app`; `routes:check` precede a `tsc`, el tsconfig no incluye `.expo`, y tests prueban generación limpia y fallo por drift/ruta añadida.                                          |

### Segunda reverificación y corrección

Los dos verificadores frescos devolvieron `no-go` sobre la primera corrección. La segunda pasada
resuelve C1-C4 y el verificador final A confirmó C1-C4 y N1-N8 sin findings nuevos. El runtime alcanzó
su límite interno de hilos al intentar abrir otro turno para B; se registra la ausencia en vez de
inventar un dictamen. Main auditó el delta exacto y autoriza la integración. El ciclo exigido conserva
los cuatro roles: implementador, dos revisores frescos A/B, corrector y retorno a Main.

| Normalizado | Origen       | Severidad | Estado | Resolución                                                                                                                                                                                                                                                                               |
| ----------- | ------------ | --------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1          | `M1-VFA-001` | P1        | fixed  | Los wrappers subyacentes de auth y SQLite usan `accessibilityElementsHidden` y `importantForAccessibility="no-hide-descendants"` durante loading/error; los overlays son modales para accesibilidad. Tests comprueban estado oculto, modal y restauración.                               |
| C2          | `M1-VFA-002` | P2        | fixed  | Los siete placeholders comparten un adapter de salida: `back()` con historial y `replace('/programs')` en cold link. Copy y labels son ES/EN; tests cubren ambos caminos y un parámetro dinámico inválido real.                                                                          |
| C3          | `M1-VFB-001` | P1        | fixed  | Todo el árbol autenticado vive bajo el grupo URL-invisible `(protected)`. Root Stack conserva el cold link, mientras su layout no monta Stack/descendientes hasta auth y SQLite ready. Una transición en el mismo `renderRouter` prueba 0 efectos en loading, 1 tras auth y 0 para anon. |
| C4          | `M1-VFB-002` | P2        | fixed  | La integración de tabs monta `TrackerRoute` real y observa `refreshRevision` 1→2 al navegar Tracker→Programas→Tracker; eliminar `useFocusEffect` hace fallar el contrato.                                                                                                                |

### Handoff del implementador

- El root navigator se monta antes de terminar SQLite/auth y queda cubierto por overlays; una sesión
  anónima aterriza en Login. Una restaurada aplica workout activo, última tab válida y fallback
  Programas, en ese orden.
- La navegación primaria contiene exactamente Programas, Tracker y Perfil. Los enlaces a instancias
  pasan por una ruta tipada y validada; Programas/Tracker siguen sin depender de Expo Router.
- Expo Router usa `src/app`, rutas tipadas y el scheme existente `gravity-room-mobile`.
- No se cambiaron contratos de resultados, repositorios ni migraciones. E2E no se ejecutó por la
  política del plan y queda reservado a M8.
- La consulta real de `workout_sessions.status = 'in_progress'` pertenece a M3. M1 deja un adapter
  explícito y probado, pero no registra el SQL v2 ni sustituye la señal con `programs[0]`.
- El grupo `(protected)` no altera URLs públicas: solo cambia IDs internos del manifiesto. Ninguna
  pantalla autenticada dispara efectos durante restore o bootstrap fallido.

### Handoff Main

- Fast-forward completado desde el corrector a `codex/mobile-v2` hasta
  `6e2a82335b9938214273a8a4d836809aa9aa1cb5`.
- M1 queda cerrado con los cuatro roles exigidos: implementador, revisores frescos A/B, corrector y
  retorno a Main. Las dos rondas `no-go` y todos sus findings permanecen trazados arriba.
- La reverificación final A dio `go`; Main verificó el delta exacto, el lifecycle protegido, a11y,
  manifiesto y pruebas antes del fast-forward.
- E2E continúa sin ejecutarse y permanece reservado para M8.
