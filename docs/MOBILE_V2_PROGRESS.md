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

| Slice                       | Estado       | Base       | Candidato | Corregido | Integrado |
| --------------------------- | ------------ | ---------- | --------- | --------- | --------- |
| M0 Contratos y baseline     | corrección 2 | `dcdec26f` | `0fcc4c6` | handoff   | pendiente |
| M1 Shell y navegación       | pendiente    | pendiente  | pendiente | pendiente | pendiente |
| M2 Programas                | pendiente    | pendiente  | pendiente | pendiente | pendiente |
| M3 Tracker offline          | pendiente    | pendiente  | pendiente | pendiente | pendiente |
| M4 Historial/temporizador   | pendiente    | pendiente  | pendiente | pendiente | pendiente |
| M5 Perfil/datos             | pendiente    | pendiente  | pendiente | pendiente | pendiente |
| M6 Programas personalizados | pendiente    | pendiente  | pendiente | pendiente | pendiente |
| M7 Wiki contextual          | pendiente    | pendiente  | pendiente | pendiente | pendiente |
| M8 Hardening/release/E2E    | pendiente    | pendiente  | pendiente | pendiente | pendiente |

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
| Corrector 2             | SHA en handoff                             | Nuevo commit normal; no amend                   |
| Reverificación final    | pendiente                                  | No ejecutada                                    |
| Decisión Main           | pendiente                                  | Integración/`go-no-go` no decidida              |

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

### Deuda/riesgos conocidos

- Los modelos objetivo de sesión y outbox están decididos, pero se implementan en M3-M4.
- La API de definiciones requiere cambios coordinados de DB/API/dominio/cliente en M6.
- El SQL v2 está probado pero no desplegado: M2-M3 deben adaptar repositorios antes de registrarlo en
  `MIGRATIONS`.
- La configuración de foreign keys depende de regenerar los proyectos nativos con el config plugin
  antes del siguiente build; las pruebas de M0 congelan tanto el flag como el guard runtime.
- Las métricas nativas de rendimiento siguen sin medir por decisión Main. M8 debe crear el harness y
  capturar baseline antes/después; M0 no afirma una medición inexistente.
