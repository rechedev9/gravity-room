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

| Slice                       | Estado         | Base       | Candidato | Corregido | Integrado |
| --------------------------- | -------------- | ---------- | --------- | --------- | --------- |
| M0 Contratos y baseline     | implementación | `dcdec26f` | pendiente | pendiente | pendiente |
| M1 Shell y navegación       | pendiente      | pendiente  | pendiente | pendiente | pendiente |
| M2 Programas                | pendiente      | pendiente  | pendiente | pendiente | pendiente |
| M3 Tracker offline          | pendiente      | pendiente  | pendiente | pendiente | pendiente |
| M4 Historial/temporizador   | pendiente      | pendiente  | pendiente | pendiente | pendiente |
| M5 Perfil/datos             | pendiente      | pendiente  | pendiente | pendiente | pendiente |
| M6 Programas personalizados | pendiente      | pendiente  | pendiente | pendiente | pendiente |
| M7 Wiki contextual          | pendiente      | pendiente  | pendiente | pendiente | pendiente |
| M8 Hardening/release/E2E    | pendiente      | pendiente  | pendiente | pendiente | pendiente |

## M0 — Contratos y baseline

### Alcance entregado por el implementador

- Plan de producto incorporado a la rama.
- ADRs de navegación, sesiones/set logs, SQLite/outbox y definiciones personalizadas.
- ESLint 9 real para TS/TSX móvil y scripts package/root.
- Fixtures tipados canónicos de programa, workout, outbox y snapshots SQLite.
- Pruebas de DB vacía, instalación legacy sin versión, instalación v1 y evolución append-only.
- Check específico de paridad i18n ES/EN.

### Candidatos, revisiones y correcciones

| Evento                  | SHA / estado | Evidencia                               |
| ----------------------- | ------------ | --------------------------------------- |
| Candidato implementador | pendiente    | Se completa en el handoff del commit M0 |
| Revisión A              | pendiente    | Sin findings todavía                    |
| Revisión B              | pendiente    | Sin findings todavía                    |
| Normalización Main      | pendiente    | Sin matriz todavía                      |
| Corrector               | pendiente    | Sin SHA corregido                       |
| Reverificación A        | pendiente    | No ejecutada                            |
| Reverificación B        | pendiente    | No ejecutada                            |
| Decisión Main           | pendiente    | `go/no-go` pendiente                    |

### Checks M0

| Check                             | Resultado                   | Nota                         |
| --------------------------------- | --------------------------- | ---------------------------- |
| `pnpm exec prettier --check ...`  | verde                       | Scope M0 completo            |
| `pnpm --filter mobile lint`       | verde                       | ESLint 9, TS/TSX             |
| `pnpm --filter mobile typecheck`  | verde                       | Expo tsconfig                |
| `pnpm --filter mobile i18n:check` | verde: 8/8                  | 0 missing keys ES/EN         |
| `pnpm --filter mobile test`       | verde: 18 suites, 151 tests | Incluye migraciones/fixtures |
| E2E                               | no ejecutado por política   | Se difiere hasta M8          |

### Findings y resolución

| ID  | Severidad | Estado    | Resolución / motivo                       |
| --- | --------- | --------- | ----------------------------------------- |
| —   | —         | pendiente | A la espera de las dos revisiones frescas |

### Deuda/riesgos conocidos

- Los modelos objetivo de sesión y outbox están decididos, pero se implementan en M3-M4.
- La API de definiciones requiere cambios coordinados de DB/API/dominio/cliente en M6.
- Las métricas nativas de rendimiento siguen sin medir hasta disponer del harness de M8.
