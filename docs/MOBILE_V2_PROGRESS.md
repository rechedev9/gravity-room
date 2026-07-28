# Gravity Room Mobile v2 — diario de implementación

Última actualización: 2026-07-28

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

## M2 — Continuación final del corrector

Fecha: 2026-07-28

Base heredada: `0e977604c23b22087da50a57a2e3dd9aced821ed`

Estado: candidato corregido y validado; pendiente de dos revisores independientes frescos

La inspección del resultado real de `corrector6.stderr.log` contradijo la suposición de un último
review limpio: la última autoreview completa había terminado con tres findings accionables. Esta
continuación verificó los tres en el código, los aceptó y añadió una regresión determinista por
defecto:

- un login Google podía persistir credenciales locales y fallar antes del commit final; si además
  fallaba la revocación remota, un restore posterior todavía podía reanimar esa sesión. El fallo
  limpia token y tipo de sesión dentro de la misma lane serializada antes de liberarla, intentando
  ambas limpiezas y conservando los errores si alguna falla;
- reconciliación interpretaba cualquier GET 404 como ausencia autoritativa y podía borrar estado
  local durable. Solo el código API `INSTANCE_NOT_FOUND` confirma ahora la ausencia. La misma
  auditoría encontró y corrigió el caso hermano en DELETE: un 404 genérico ya no se convierte en
  `already_absent`;
- una lease vieja podía volver a ser elegible si una productora más nueva había sido capturada y
  luego abandonada. La supersesión es ahora monotónica desde captura: una generación observada nunca
  cede de nuevo prioridad a su predecesora. Los commits esperan la liquidación de productoras nuevas
  y después descartan limpiamente la lease vieja, sin dejar estado pendiente.

La regeneración OpenAPI se hizo contra `/swagger/json` de la API local con las rutas dev
condicionadas habilitadas. El artefacto web conserva esas rutas y refleja únicamente la descripción
actualizada de sign-out por familia de sesiones.

| Check final sin E2E                                | Resultado                                  |
| -------------------------------------------------- | ------------------------------------------ |
| Focales mobile auth/reconciliación/cache/UI        | verde: 8 suites, 250 tests                 |
| `pnpm --filter mobile test`                        | verde: 37 suites, 414 tests, 2 snapshots   |
| Mobile routes/i18n/typecheck/lint                  | verde; i18n 1 suite, 8 tests, 0 ausencias  |
| Focales API auth/programas/cache                   | verde: 5 ficheros, 238 tests               |
| API test/typecheck/lint                            | verde: 47 ficheros, 764 tests              |
| Domain test/typecheck                              | verde: 7 ficheros, 51 tests                |
| Database test/typecheck                            | verde: 6 ficheros, 89 tests                |
| Integraciones database con infraestructura externa | 5 saltadas por entorno                     |
| Drizzle migrations check                           | verde: `Everything's fine`                 |
| OpenAPI web `api:types`                            | verde; artefacto regenerado                |
| Prettier + `git diff --check`                      | verde antes de este registro; se reejecuta |
| `autoreview --mode local` tras las correcciones    | invalidada al detectar source drift        |
| E2E                                                | no ejecutado; reservado exclusivamente M8  |

La invalidación de autoreview fue deliberadamente conservadora: la generación OpenAPI terminó
mientras el review estaba en curso, por lo que su salida pidió repetir sobre el árbol actualizado y
no se contabiliza como dictamen. Tras este registro se congela el patch, se repiten formato/diff y
autoreview, y cualquier finding aceptado volverá al ciclo fix/test/review.

Esta continuación no es una revisión independiente ni declara GO. M2 sigue esperando dos revisores
independientes frescos.

### Autoreview exacta tras el registro final

La autoreview sobre el patch congelado aceptó un P2 hermano en el login email: después de que el
servidor emitiera la cookie, un fallo al persistir el marker local seguido de una revocación remota
fallida podía dejar `email` restaurable aunque el caller hubiera recibido un error. La corrección
limpia token y marker dentro de la lane de transición antes de intentar la revocación best-effort,
igual que el cierre Google, y conserva de forma agregada cualquier fallo de cleanup.

La regresión determinista escribe parcialmente el marker, hace fallar persistencia y revocación, y
demuestra que un restore posterior devuelve `null` sin llamar al endpoint cookie. El test focal de
auth queda verde con 45 tests; la suite mobile final sustituye el conteo anterior y queda verde con
37 suites, 415 tests y 2 snapshots. Routes, i18n ES/EN (8 tests, 0 keys ausentes), typecheck estricto y
lint se repitieron verdes después del fix.

Este finding aceptado tampoco constituye revisión independiente ni GO. M2 conserva el requisito de
dos revisores independientes frescos, y E2E continúa sin ejecutarse por estar reservado a M8.

### Segundo ciclo de autoreview exacta

La siguiente autoreview aceptó tres P2 adicionales, verificados y cerrados con regresiones
deterministas:

- si el owner cambiaba mientras fallaba el restore posterior a un 401, el catch devolvía el 401
  original y ocultaba la obsolescencia. La sesión capturada se reafirma ahora también en el catch y
  tras restore; un cambio de owner conserva `requestDispatched: true` para impedir que mutaciones del
  owner anterior hagan cleanup como rechazo definido;
- un login browser B que había capturado una cookie de A podía fallar si logout/revocación borraba la
  familia A antes de la transacción. El replacement conserva el owner capturado y B crea siempre una
  familia independiente, incluso cuando la fila A ya no existe; el caso same-account desaparecido
  sigue siendo supersesión;
- respuestas detail/definition válidas pero con ID distinto devolvían `false` sin liquidar su lease.
  Ambos caminos abandonan ahora la lease antes de salir, evitando productores pendientes huérfanos y
  esperas sin resolución.

Los focos posteriores quedaron verdes con 2 suites/104 tests mobile y 17 tests de familia de sesión
API. Las matrices completas sustituyen otra vez los conteos anteriores: mobile queda en 37 suites,
417 tests y 2 snapshots; API queda en 47 ficheros y 765 tests. Routes, i18n ES/EN, typecheck y lint
mobile, además de typecheck y lint API, se repitieron verdes en este estado.

M2 continúa sin GO y pendiente de dos revisores independientes frescos. E2E no se ejecutó.

### Tercer ciclo de autoreview exacta

La tercera autoreview aceptó un último P2 de orden entre tres refreshes: después de esperar a la
generación más nueva, una productora vieja podía volver a esperar una lease intermedia que ya era
irreversiblemente obsoleta pero cuya petición seguía pendiente. El lookup espera ahora únicamente la
última generación reservada. Cuando esa generación se liquida, todas las inferiores fallan de
inmediato en vez de encadenarse a una productora colgada.

La regresión captura tres leases, abandona la más nueva y mantiene la intermedia pendiente; confirma
que la vieja ya no obtiene un segundo waiter y termina `false`. El foco repository queda verde con
59 tests; typecheck y lint mobile se repitieron verdes. La suite mobile final vuelve a sustituir el
conteo anterior: 37 suites, 418 tests y 2 snapshots, con routes e i18n ES/EN también verdes.

M2 continúa pendiente de dos revisores independientes frescos, sin declaración GO y sin E2E.

### Cuarto ciclo de autoreview exacta

La cuarta autoreview aceptó dos P2 de coherencia local:

- el cleanup destructivo de un sign-in Google/email fallido borraba credenciales durables pero podía
  dejar viva la cuenta anterior en memoria. El helper compartido bloquea restore e invalida owner,
  token y generación antes de limpiar storage. Las regresiones parten de una sesión A, hacen fallar
  el cambio a B y demuestran que A ya no puede capturarse ni autorizar requests;
- tras un PATCH ya reconocido, un cambio de sesión durante el commit SQLite conserva
  intencionadamente el marker manage, pero el resultado declaraba que no había reconciliación. El
  resultado reporta ahora `reconciliationScheduled: true`; la regresión usa una obsolescencia
  dispatched y verifica que el marker persiste y no se limpia.

Los focos auth/manage quedaron verdes con 2 suites y 79 tests. Typecheck, lint, routes e i18n ES/EN
se repitieron verdes; la suite mobile completa permanece en 37 suites, 418 tests y 2 snapshots.

M2 sigue sin GO, requiere dos revisores independientes frescos y no ha ejecutado E2E.

### Quinto ciclo de autoreview exacta

La quinta ejecución no llegó al review: el preflight conservador detectó fixtures con forma de token
en el contexto del test auth. Eran placeholders locales, no secretos; se redujeron a valores mínimos
y el test auth volvió a quedar verde con 46 tests antes de repetir.

La sexta autoreview aceptó un P2 de artefacto database: `0043_session_families.sql` y el journal no
incluían el snapshot Drizzle correspondiente. Se generó `0043_snapshot.json` desde el schema actual
del worktree, enlazado al último snapshot persistido. `drizzle-kit check` devuelve
`Everything's fine` y una generación de verificación enumera 13 tablas —incluidos 11 campos y 5
índices de `refresh_tokens`— y termina con `No schema changes, nothing to migrate`.

Este cierre sigue pendiente de una autoreview limpia sobre el patch exacto. M2 no declara GO, espera
dos revisores independientes frescos y mantiene E2E reservado a M8.

### Cierre limpio de autoreview

La séptima autoreview se ejecutó sobre el patch exacto con el snapshot 0043 incluido. Sus dos chunks
terminaron con 0 findings aceptados/accionables, `autoreview chunked clean` y resultado global
`patch is correct`. Este registro documental obliga a una última repetición sobre el mismo contenido
completo antes del commit.

Los últimos conteos completos permanecen: mobile 37 suites/418 tests/2 snapshots; API 47
ficheros/765 tests; domain 7 ficheros/51 tests; database 6 ficheros/89 tests con 5 integraciones
externas saltadas. Formato, diff, routes, i18n ES/EN, typechecks, lints, OpenAPI y Drizzle están
verdes. E2E no se ejecutó.

La autoreview limpia no sustituye reverificación independiente: M2 todavía espera dos revisores
independientes frescos y no declara GO.

### Sexto ciclo de corrección tras el cierre documental

La octava autoreview aceptó un P2 de amplificación de headers en sign-out: el endpoint rechazaba más
de ocho cookies refresh antes de revocar, pero su `finally` todavía podía emitir un `Set-Cookie` de
expiración por cada nombre presentado. El helper de expiración limita ahora todas sus llamadas a
`MAX_BROWSER_REFRESH_COOKIES`, también en errores tempranos y rate limit.

La regresión HTTP presenta nueve cookies versionadas, confirma el 400 sin fan-out de revocación y
limita la respuesta a ocho expiraciones. El foco auth API quedó verde con 126 tests; typecheck y lint
API se repitieron verdes, y la suite completa API permanece en 47 ficheros/765 tests.

El cambio no altera el estado de reviewer: M2 sigue pendiente de dos revisores independientes
frescos, no declara GO y no ejecutó E2E.

### Séptimo ciclo de corrección

La novena autoreview señaló que limitar las expiraciones a las primeras ocho cookies resolvía la
amplificación, pero podía dejar viva una credencial válida posterior. El overflow usa ahora un único
header estándar `Clear-Site-Data: "cookies"`: elimina también cookies HttpOnly sin fan-out de
`Set-Cookie`. El camino normal conserva expiración precisa por nombre y no afecta un login
concurrente más nuevo.

La regresión de nueve cookies mantiene 400 y cero revocaciones, exige cero headers `Set-Cookie` y
confirma el global-clear acotado. El foco auth API permanece en 126 tests verdes; typecheck, lint y
los 47 ficheros/765 tests API completos se repitieron verdes.

M2 continúa pendiente de dos revisores independientes frescos, sin GO y sin E2E.

## M2 — cierre del corrector final4 (continuación final)

Fecha: 2026-07-28

Base heredada: `0e977604c23b22087da50a57a2e3dd9aced821ed`

Estado: corrección completa y autoreview limpia; pendiente de dos revisores independientes frescos

Esta continuación heredó el patch final4 sin commit y cerró los dos gaps de completitud que quedaban:

- cuando un refresh de `library` o `catalog` pierde el commit frente a un productor más nuevo, el
  consumidor activo relee el snapshot ganador de SQLite y termina con datos estables en vez de
  quedar en `loading`;
- el create confirmado avanza la barrera `definition:<programId>` dentro del mismo conjunto de
  barreras que `library` y `detail:<id>`, impidiendo que una definición anterior sobrescriba el
  resultado del create.

Las regresiones finales mantienen además los cinco contratos de la revisión anterior: leases únicas
por productor; preflight de sesión fuera de las regiones `outcome_unknown`; cancelación segura de
sesiones obsoletas en Tracker; checks pre/post-write dentro de cada transacción SQLite con rollback;
y recursos independientes `library`, `catalog`, `definition:<id>` y `detail:<id>`.

### Findings aceptados y corregidos durante el cierre

Las sucesivas autoreviews locales descubrieron y bloquearon problemas reales adicionales. Se
corrigieron con cobertura determinista antes de continuar:

- serialización global de login/restore y familias de refresh, incluida la generación única por
  intento, el pinning de sesión antes y después de ACK, y la protección frente a ABA;
- familias cross-account sin enlace de hashes, exclusión de cookies expiradas, límite de ocho
  cookies de refresh antes de hash/DB y asignación del orden solo después del rate limit;
- callbacks browser de Google/password/verificación/Apple/GitHub/Microsoft/dev unidos a la barrera
  de familia capturada; logout antiguo no puede borrar un login de generación posterior;
- tombstones de lookup de familia limitadas a la vida del sucesor directo, sin extender la validez
  del credential antiguo ni podar ancestros todavía necesarios;
- migración expand compatible con instancias API antiguas mediante defaults DB para `family_id` y
  `family_order`;
- recuperación de DELETE incierto sin la promesa insegura «conservar programa»: comprobar estado
  mantiene el marker si GET aún ve la fila y solo confirma cleanup local tras ausencia remota;
- reconciliación de manage pinneada a la sesión también dentro de SQLite, con validación antes y
  después de escribir y rollback si cambia la cuenta.

La pasada final de `autoreview --mode local` revisó el patch en dos chunks y terminó limpia: cero
findings aceptados o accionables, `overall: patch is correct`.

### Matriz final sin E2E

| Check                                                               | Resultado                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| Focales mobile refresh/session/repositorio/Programas/Tracker/create | verde: 8 suites, 252 tests                              |
| `pnpm --filter mobile test`                                         | verde: 37 suites, 412 tests, 2 snapshots                |
| Mobile strict typecheck + route manifest                            | verde                                                   |
| Mobile lint                                                         | verde                                                   |
| Mobile i18n ES/EN                                                   | verde: 1 suite, 8 tests, paridad exacta                 |
| Focales API auth/session                                            | verde: 2 ficheros, 142 tests                            |
| `pnpm --filter api test`                                            | verde: 47 ficheros, 764 tests                           |
| API typecheck + lint                                                | verde                                                   |
| Domain test + typecheck                                             | verde: 7 ficheros, 51 tests                             |
| Database test + typecheck                                           | verde: 6 ficheros, 89 tests                             |
| Integraciones database externas                                     | 5 saltadas: requieren PostgreSQL/infraestructura opt-in |
| E2E                                                                 | no ejecutado; reservado para M8                         |

Este cierre no declara GO independiente. M2 continúa pendiente de dos revisores independientes
frescos sobre el commit final.

## M2 — Programas: biblioteca y gestión

Inicio: 2026-07-27

Base congelada: `78adf51dc98ad77b8302d0042c7ffae7538bfcea`

Estado: corrección del ciclo final 4 en curso. Los revisores final4 A y B dieron `no-go` en worktrees
detached limpios y solo de lectura; Main normalizó sus findings en E1-E9. Esta pasada corrige los
nueve con regresiones y puertas completas, pero el hito queda pendiente de dos nuevos dictámenes
independientes. El SHA se identifica en el handoff. M2 no está integrado y no tiene GO final.

### Candidato y revisiones

| Evento                   | SHA / estado                                 | Evidencia                                      |
| ------------------------ | -------------------------------------------- | ---------------------------------------------- |
| Candidato implementador  | `579531475a1c4c5c6ff73d5a2512c02530500033`   | M2 completo previo a revisión                  |
| Revisión A               | `no-go`: 8 findings                          | `M2-A-001` a `M2-A-008`                        |
| Revisión B               | `no-go`: 9 findings                          | `M2-B-001` a `M2-B-009`                        |
| Normalización Main       | N1-N13                                       | Todos aceptados para primera corrección        |
| Corrector 1              | `90a78bd1e63d08279fa0b4a141a3acd946390ddc`   | N1-N13 corregidos; no constituye GO            |
| Reverificación final A   | `no-go`: 4 findings                          | `M2-VFA-001` a `M2-VFA-004`                    |
| Reverificación final B   | `no-go`: 1 finding                           | `M2-VFB-001`                                   |
| Normalización Main 2     | C1-C5                                        | Los cinco aceptados para segunda corrección    |
| Corrector 2              | `ad0a0c64558dee7d3c5f34dbcf8b48542bf1b978`   | Puertas completas; pendiente de reverificación |
| Reverificación final 2 A | `no-go`: 1 finding P1                        | `M2-VF2A-001`; todo lo demás PASS              |
| Reverificación final 2 B | `go`                                         | C1-C5 y N1-N13 PASS; sin findings              |
| Normalización Main 3     | `M2-VF2A-001`                                | Aceptado para tercera corrección               |
| Corrector 3              | este commit; SHA en el handoff del corrector | Catálogo exhaustivo; no constituye GO          |
| Reverificación final3 A  | `no-go`: 4 findings                          | `M2-VF3A-001` a `M2-VF3A-004`                  |
| Reverificación final3 B  | `no-go`: 5 findings                          | `M2-VF3B-001` a `M2-VF3B-005`                  |
| Normalización Main 4     | D1-D8                                        | Ocho defectos únicos aceptados                 |
| Corrector final3         | este commit; SHA en el handoff del corrector | D1-D8 corregidos; no constituye GO             |
| Reverificación final4 A  | `no-go`                                      | Informe `final4-a`; revisión limpia/read-only  |
| Reverificación final4 B  | `no-go`                                      | Informe `final4-b`; revisión limpia/read-only  |
| Normalización Main 5     | E1-E9                                        | Nueve defectos aceptados para corrección       |
| Corrector final4         | este commit; SHA en el handoff del corrector | E1-E9 corregidos; no constituye GO             |

### Origen → normalizado y corrección

| Normalizado | Origen              | Sev.  | Estado | Corrección y evidencia principal                                                                                                                                                                                                                                                                                                                  |
| ----------- | ------------------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1          | A-001, B-004, B-005 | P1    | fixed  | Resultados `applied/reconciliation_required`; ACK/ID remoto conservado, outcome incierto no se presenta como fallo y el POST queda bloqueado incluso tras remount. Un marcador desconocido no se limpia por un GET temprano; un ID conocido exige aparecer en verdad remota. Delete 404 confirma ausencia. Pruebas post-ACK create/manage/delete. |
| N2          | A-002, B-003        | P1    | fixed  | Borrado local exclusivo elimina en una transacción pin, resumen, detalle y `queued_mutations` por instancia. SQLite real conserva otra entidad y su cola.                                                                                                                                                                                         |
| N3          | A-003               | P1    | fixed  | Adapter de ruta incrementa `refreshRevision` con `useFocusEffect`; la feature no importa router. Integración real vuelve de setup y Tracker y observa la nueva verdad local.                                                                                                                                                                      |
| N4          | A-004               | P1    | fixed  | Contrato de contenido por IDs estables; catálogo canónico ES/EN, level/tier traducidos y ficha/setup no muestran description, días, ejercicios, labels/títulos canónicos crudos en EN. Tests de GZCLP real y cobertura de los 20 IDs.                                                                                                             |
| N5          | A-005               | P1    | fixed  | Parser decimal locale-aware en frontera UI: coma ES, punto EN; rechaza separadores ajenos, agrupación, exponentes y formatos incompletos. Tests de parser y componente.                                                                                                                                                                           |
| N6          | A-006               | P1    | fixed  | La revalidación remota mezcla defaults solo en campos pristine; un campo editado desde cache no se pisa al resolver el fetch diferido.                                                                                                                                                                                                            |
| N7          | A-007               | P2    | fixed  | Catálogo fresh vacío usa `EmptyState`; indicadores y acciones busy tienen labels/live announcements; errores son alert/assertive. Tests a11y.                                                                                                                                                                                                     |
| N8          | A-008, B-001        | P1/P2 | fixed  | Runtime v2 añade tablas owner-scoped, v3 snapshots y final3 añade expectativas de reconciliación en v4; el contrato completo pasa a v5. SQLite real prueba la cadena sin saltos, owner/cache preservados, legacy en cuarentena sin claim y sesiones/outbox creadas. ADR actualizado.                                                              |
| N9          | B-002               | P1    | fixed  | Manage actualiza summary y solo metadata de lifecycle del detalle mediante merge; conserva results/undo/config pendientes y `queued_mutations`. SQLite real.                                                                                                                                                                                      |
| N10         | B-006               | P1    | fixed  | Si falla GET tras POST, la transacción completa summaries y metadata de detalle active anteriores, preserva su estado operativo y deja únicamente el nuevo active.                                                                                                                                                                                |
| N11         | B-007               | P1    | fixed  | Create API usa una transacción y solo `tx`, bloquea la fila de usuario, completa+inserta atómicamente y se apoya en el índice parcial único ya migrado. C1 extiende el mismo orden de locks a reactivación, lifecycle y delete, y valida el `UPDATE ... RETURNING` antes del commit.                                                              |
| N12         | B-008               | P2    | fixed  | Estado discriminado `cached/revalidating/fresh/offline`; cache durante fetch lento lleva copy/live region de revalidación y nunca se presenta fresca. C4 distingue además `no_snapshot` con datos confirmados parciales, `snapshot_empty` y snapshot completo por owner/recurso.                                                                  |
| N13         | B-009               | P2    | fixed  | `GenericProgramDetailSchema` de transporte es estricto; config/results/undo corruptos se rechazan tras ACK y nunca caen a vacíos. Tests dominio y mobile.                                                                                                                                                                                         |

### Segunda reverificación y corrección

Los dos informes finales sobre el primer corrector fueron `no-go`: A encontró cuatro defectos de
contenido, locale y snapshot (`M2-VFA-001` a `M2-VFA-004`), y B encontró la carrera transaccional de
reactivación (`M2-VFB-001`). Esta segunda pasada corrige C1-C5 y vuelve a ejecutar N1-N13, pero no
convierte por sí sola el hito en GO.

| Normalizado | Origen       | Sev. | Estado     | Corrección y evidencia principal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | ------------ | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1          | `M2-VFB-001` | P1   | fixed      | Reactivate bloquea primero al owner y después al target con `FOR UPDATE`, valida ownership/status y comprueba el `UPDATE ... RETURNING` dentro del callback. Lifecycle/delete comparten el orden de locks. El repro de target desaparecido/update 0 fuerza rollback y deja A `active`; repetir una activación ya aplicada es idempotente y devuelve el target `active`.                                                                                                                                                                                                        |
| C2          | `M2-VFA-001` | P1   | superseded | La segunda corrección amplió el recorrido a los 20 presets, pero todavía permitía `humanizeIdentifier`, sustituciones parciales y fallbacks ordinales. La reverificación final 2 A demostró que la prueba comprobaba presencia, no semántica exacta; `M2-VF2A-001` sustituye esta resolución incompleta.                                                                                                                                                                                                                                                                       |
| C3          | `M2-VFA-002` | P2   | fixed      | Formatter y parser de pesos comparten frontera locale-aware. Defaults, hints y valores visibles usan coma en ES y punto en EN, y todo valor renderizado puede volver a parsearse. Un cambio de idioma conserva valores editados y relocaliza pesos válidos sin refetch. Tests UI cubren `2,5`, `22,5`, `1,25` y sus equivalentes EN.                                                                                                                                                                                                                                           |
| C4          | `M2-VFA-003` | P2   | fixed      | La migración runtime v3 añade metadata de snapshot exitoso por owner y recurso, escrita en la misma transacción que biblioteca/catálogo. Solo backfillea catálogo v2 poblado, cuya escritura siempre fue reemplazo completo; filas de biblioteca sin marcador permanecen como datos confirmados parciales y se muestran con copy de primera sync, no como último snapshot. Una tabla vacía sigue en `no_snapshot` y un remoto vacío real queda como `snapshot_empty`. Los readers toman marcador+filas en una misma transacción SQLite; tests cubren atomicidad y aislamiento. |
| C5          | `M2-VFA-004` | P2   | fixed      | Reactivar B completa A, guarda B `active` y auto-fija B en una única transacción SQLite. La intención de activación viaja explícita desde el use-case, por lo que renombrar/configurar un programa ya activo no cambia una selección Tracker existente o ausente. La prueba real parte de A active+pinned y B completed, confirma que Tracker resuelve B y cubre el rename sin repin.                                                                                                                                                                                          |

### Reconfirmación N1-N13

| Hallazgo | Resultado | Evidencia de no regresión                                                                   |
| -------- | --------- | ------------------------------------------------------------------------------------------- |
| N1       | pass      | ACK, reconciliación e identidad remota continúan cubiertos por use-cases y pantallas.       |
| N2       | pass      | Borrado atómico conserva otra entidad/cola en SQLite real; C1 alinea además el lock remoto. |
| N3       | pass      | La integración de foco vuelve a leer setup y selección de Tracker.                          |
| N4       | pass      | C2 endurece el contrato previo con recorrido exhaustivo del catálogo real ES/EN.            |
| N5       | pass      | C3 conserva el parser estricto y añade formatter round-trip para defaults/hints.            |
| N6       | pass      | La revalidación sigue sin pisar campos dirty del formulario.                                |
| N7       | pass      | Empty/loading/error y announcements accesibles permanecen cubiertos.                        |
| N8       | pass      | Cadena real v1→v2→v3→v4 y composición futura v5 probadas con SQLite.                        |
| N9       | pass      | Manage preserva config, results, undo y mutaciones pendientes.                              |
| N10      | pass      | Fallo del GET posterior al POST mantiene un único active coherente.                         |
| N11      | pass      | C1 refuerza la serialización con locks owner→target y rollback ante update 0.               |
| N12      | pass      | Revalidación/offline siguen discriminados; C4 añade primera sync frente a vacío conocido.   |
| N13      | pass      | Schemas estrictos siguen rechazando detail/config/results/undo corruptos.                   |

### Tercera reverificación y corrección

La reverificación final 2 fue divergente pero precisa: B dio `go`, confirmó C1-C5 y N1-N13 y no
abrió findings; A devolvió `no-go` únicamente por `M2-VF2A-001` P1 y marcó PASS en todo lo demás.
El defecto era de contrato, no una lista corta de traducciones ausentes: el catálogo canónico aún
podía caer en humanización de identificadores, sustituciones parciales, copy mixto y ordinales, y el
test aceptaba cualquier string no vacío. Esta tercera corrección no altera lógica GZCLP ni
`@gzclp/domain`.

| Finding       | Sev. | Estado | Corrección y evidencia principal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M2-VF2A-001` | P1   | fixed  | Los 20 IDs canónicos exigen copy por claves estables. Los 1.165 días se reconstruyen mediante formatos semánticos completos, nunca sustituyendo fragmentos; los 139 IDs de ejercicio y las 210 apariciones de campos se igualan exactamente contra los seeds, y las cuatro opciones semánticas cubren hombre, mujer, 2,5 y 1,25. El test ES/EN compara la salida exacta, la paridad de conjuntos por seed, mezclas de idioma, claves internas y fallback genérico; fija además `apert`, `curl_fem`, `gemelo_pie`, `acc_incline_db_press`, `Jue — Pecho/Bíceps` y `Banca/Muerto`. El fallback externo queda separado, humano y no ordinal. |

HeXaN PPL y Caparazón se recorren como seeds reales, no como fixtures parciales. No existen días
vacíos en el catálogo actual; el recorrido fallaría ante uno canónico sin clave y el caso externo
vacío devuelve copy “sin nombre”, nunca `Day N`, `Exercise N`, `Option N` ni `Initial value N`.
Esta corrección queda pendiente de una nueva reverificación independiente y no constituye GO final.

### Checks de la segunda corrección

| Check                                          | Resultado                     | Nota                                                                                         |
| ---------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| Prettier + `git diff --check`                  | verde                         | Puerta final sobre los 26 ficheros del delta                                                 |
| `pnpm --filter mobile routes:check`            | verde                         | Manifiesto sin drift; también ejecutado por typecheck                                        |
| `pnpm --filter mobile lint`                    | verde                         | TS/TSX y tests M2                                                                            |
| `pnpm --filter mobile typecheck`               | verde                         | Expo TS estricto                                                                             |
| `pnpm --filter mobile i18n:check`              | verde: 1 suite, 8 tests       | Cobertura ES/EN idéntica, 0 missing keys                                                     |
| Focalizadas mobile de cierre                   | verde: 6 suites, 52 tests     | Catálogo real, locale, snapshot, pin y pantalla                                              |
| `pnpm --filter mobile test`                    | verde: 37 suites, 261 tests   | Suite completa; incluye snapshot transaccional, SQLite real y Tracker sin repin lateral      |
| `pnpm run typecheck:domain` / `test:domain`    | verde: 7 ficheros, 48 tests   | Parser estricto y límites de config preservados                                              |
| Database typecheck/tests                       | verde: 6 ficheros, 89 tests   | 5 tests de integración con DB externa saltados por entorno                                   |
| API focal `src/services/programs.test.ts`      | verde: 33 tests               | Locks, rollback por update 0, delete, concurrencia y retry idempotente                       |
| API typecheck/lint                             | verde                         | API estricta                                                                                 |
| `pnpm --filter api test`                       | verde: 46 ficheros, 703 tests | Suite completa, sin DB externa requerida                                                     |
| Expo install/config/export Android             | verde                         | Dependencias compatibles, prebuild válido; 1.244 módulos, 24 assets, 26 ficheros/3.861.867 B |
| `autoreview --mode local`                      | verde                         | 7 findings aceptados/corregidos en 5 pasadas; sexta limpia sin findings accionables          |
| Revisión manual del diff y efectos secundarios | verde                         | Incluyó lifecycle, retry, carreras, owner, migración, i18n, locale, pin y a11y               |
| E2E                                            | no ejecutado por política     | Reservado para M8                                                                            |

### Checks de la tercera corrección

| Check                                     | Resultado                   | Nota                                                                                                                            |
| ----------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Pruebas focales de contenido + ficha real | verde: 3 suites, 16 tests   | Catálogo exhaustivo ES/EN, 2 oracles estáticos, copy externo seguro y render de setup                                           |
| `pnpm --filter mobile test`               | verde: 37 suites, 262 tests | Reconfirma C1-C5 y N1-N13 en toda la suite mobile                                                                               |
| `pnpm --filter mobile routes:check`       | verde                       | Manifiesto sin drift                                                                                                            |
| `pnpm --filter mobile lint` / `typecheck` | verde                       | ESLint mobile y Expo TS estricto                                                                                                |
| `pnpm --filter mobile i18n:check`         | verde: 1 suite, 8 tests     | Paridad exacta ES/EN, 0 missing keys                                                                                            |
| Prettier focal + `git diff --check`       | verde                       | Copy, código, tests y progreso sin drift de formato ni whitespace                                                               |
| Expo export Android                       | verde: 1.244 módulos        | 24 assets; bundle Hermes 3,86 MB                                                                                                |
| `autoreview --mode local`                 | verde en sexta pasada       | Cinco findings reales aceptados: colisión externa, variante en banco, labels con guion, redondeo externo y oracle independiente |
| Dominio                                   | no ejecutado; no afectado   | No cambian `@gzclp/domain`, schemas, motor ni lógica GZCLP                                                                      |
| E2E                                       | no ejecutado por política   | Reservado para M8                                                                                                               |

### Corrección del ciclo final 3

Los dos dictámenes independientes fueron `no-go`. A abrió cuatro findings
(`M2-VF3A-001`–`004`) y B abrió cinco (`M2-VF3B-001`–`005`). Main eliminó el solapamiento entre
validación de config y normalizó ocho defectos únicos:

| Defecto | Origen                       | Sev. | Estado | Corrección y evidencia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ---------------------------- | ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1      | `M2-VF3B-001`                | P1   | fixed  | Migración SQLite append-only v4 añade expectativas owner-scoped para rename/status/config y conserva markers legacy. Un GET antiguo, mera existencia, ACK no coincidente o `ON CONFLICT` no limpia/sobrescribe un marker tipado. Mutaciones por instancia se serializan: una intención distinta queda bloqueada y solo el reintento explícito de la misma intención se permite. Un detalle coincidente aplica summary, detail, lifecycle y pin en la misma transacción que elimina el marker; nunca repite PATCH automáticamente. |
| D2      | `M2-VF3B-002`                | P1   | fixed  | Create/reactivate recuperan con `RETURNING` todos los IDs desplazados y, solo tras commit, invalidan target y desplazados en una operación Redis fail-open y deduplicada. Rollback no invalida; activación repetida es idempotente.                                                                                                                                                                                                                                                                                               |
| D3      | `M2-VF3A-001`, `M2-VF3B-003` | P1   | fixed  | POST hidrata el template autoritativo y PATCH respeta snapshot/definición owner-scoped de la instancia antes de caer al template, siempre dentro de la transacción. Missing/extra/min/step/select delegan a `validateProgramConfig`; definición corrupta y config inválida devuelven `ApiError` 400 estable antes de completar el activo.                                                                                                                                                                                         |
| D4      | `M2-VF3A-002`                | P1   | fixed  | Oracle estático independiente cubre nombre/descripción de los 20 presets y todos los tiers ES/EN. Una mutación coordinada `Banana` en ambos locales falla contra el fixture revisado; expected no se deriva de i18n, seeds ni productor.                                                                                                                                                                                                                                                                                          |
| D5      | `M2-VF3A-004`                | P1   | fixed  | Formulario y CTA preceden reglas/preview. Presets grandes nacen colapsados y paginan 10 días sin nodos ocultos, incluso al crecer de cache pequeño a refresh grande; el seed real de Caparazón (200 días) prueba orden accesible, cero nodos iniciales, límites por página, colapso y CTA operable.                                                                                                                                                                                                                               |
| D6      | `M2-VF3B-004`                | P2   | fixed  | `source` viaja por catálogo, definición, día, ejercicio, campo y opción. Solo `source: preset` más ID conocido usa copy canónico; un custom/externo que colisiona con `gzclp` conserva todas sus etiquetas sin lanzar.                                                                                                                                                                                                                                                                                                            |
| D7      | `M2-VF3B-005`                | P2   | fixed  | Rounding externo exige decimal canónico positivo: sin vacío, espacios, signo, exponente, hexadecimal, coma ni ceros ambiguos. `0.5` y otros decimales válidos siguen localizados; entradas inválidas conservan label humano.                                                                                                                                                                                                                                                                                                      |
| D8      | `M2-VF3A-003`                | P2   | fixed  | Frontera común documentada en dominio: `0` o `[10⁻⁶, 10¹⁵]`. Definiciones, validador de nuevas escrituras, formatter y parser comparten el límite; todo valor nuevo admitido hace round-trip exacto ES/EN. El parser de persistencia conserva compatibilidad legacy.                                                                                                                                                                                                                                                              |

El contrato futuro M3 sube de v4 a v5 para componer la nueva migración runtime v4 antes del rename
final. OpenAPI documenta el 400 de PATCH config y el cliente web se regeneró con el flujo soportado,
manteniendo las rutas dev condicionadas durante codegen.

### Checks de la corrección final3

| Check                                     | Resultado                      | Nota                                                                                                          |
| ----------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Focales D1-D8                             | verde                          | SQLite legacy/owner/rollback, Redis post-commit, config autoritativa, oracle, seed 200 días, source y números |
| `pnpm --filter mobile routes:check`       | verde                          | Manifiesto sin drift                                                                                          |
| `pnpm --filter mobile i18n:check`         | verde: 1 suite, 8 tests        | ES/EN idénticos, 0 missing keys                                                                               |
| `pnpm --filter mobile lint` / `typecheck` | verde                          | ESLint y Expo TS estricto                                                                                     |
| `pnpm --filter mobile test`               | verde: 37 suites, 296 tests    | Suite completa; C1-C5 y N1-N13 reconfirmados                                                                  |
| Domain typecheck/tests                    | verde: 7 ficheros, 51 tests    | Incluye frontera numérica, validación config y lectura legacy compatible                                      |
| Database typecheck/tests                  | verde: 6 ficheros, 89 tests    | 5 integraciones DB externas saltadas por entorno                                                              |
| API lint/typecheck/tests                  | verde: 46 ficheros, 716 tests  | Locks, rollback, definición por instancia, validación, caché y lifecycle                                      |
| OpenAPI web `api:types`                   | verde                          | Cliente regenerado; PATCH config publica respuesta 400                                                        |
| Expo export Android                       | verde: 1.244 módulos           | 24 assets; 26 ficheros, 3.898.206 B; bundle Hermes 3,87 MB                                                    |
| Prettier + `git diff --check`             | verde                          | Todo el delta final y este progreso                                                                           |
| `autoreview --mode local`                 | verde tras findings corregidos | Persistencia atómica, ausencia remota, handoff, supersesión y definición por instancia corregidos             |
| E2E                                       | no ejecutado por política      | Reservado para M8                                                                                             |

### Riesgos de la corrección final3

- Un marker manage legacy no tiene expectativa verificable y se conserva sin PATCH/GET automático;
  una instancia ausente del snapshot remoto tampoco se elimina porque ausencia no confirma la
  mutación. Ambos casos evitan falsos ACK. Una operación explícita posterior confirmada puede
  migrar solo el marker legacy aplicando nombre, estado, config y handoff autoritativos. Un marker
  tipado bloquea intenciones distintas y solo admite reintento explícito de la misma intención.
- La frontera `[10⁻⁶, 10¹⁵]` es intencionadamente más estricta que números JavaScript finitos:
  previene exponentes y strings gigantes en nuevas escrituras de dominio, API y UI. El schema de
  lectura sigue aceptando números legacy para no hacer inaccesibles instancias existentes.
- Las cinco pruebas database que requieren infraestructura externa permanecieron saltadas por
  entorno; migraciones SQLite runtime/contrato sí se ejecutaron con `node:sqlite`.
- M2 sigue pendiente de nueva reverificación independiente. Esta corrección no declara GO.

### Corrección del ciclo final 4

Los dos revisores final4 trabajaron sobre snapshots detached, limpios y de solo lectura. Ambos
devolvieron `no-go`; sus informes completos (`final4-a.final.txt` y `final4-b.final.txt`) se
normalizaron en nueve defectos E1-E9. La corrección mantiene append-only las migraciones SQLite y
no amplía el alcance a E2E.

| Defecto | Sev. | Estado | Corrección y evidencia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1      | P1   | fixed  | Manage persiste y relee la expectativa tipada owner-scoped antes de permitir PATCH. Fallar preflight impide el envío; también la captura de sesión ocurre fuera de la región outcome-unknown, por lo que una sesión obsoleta nunca finge un envío remoto. Rechazo remoto definido elimina solo el marker exacto; outcome desconocido o crash lo conserva. ACK y eliminación coincidente comparten transacción SQLite. Manage, delete y reconciliación GET usan la misma lane por owner/entidad. Regresiones cubren crash, servidor alcanzado sin respuesta, rechazo definido, reintento idéntico, intención conflictiva, ACK ajeno, rollback y preflight de sesión. |
| E2      | P1   | fixed  | Tras restart, cada tarjeta revela la expectativa exacta guardada —incluidos todos los valores config— y ofrece un único CTA accesible/localizado ES+EN para repetir exactamente esa mutación. Rename/status/config arbitrarios quedan ocultos mientras existe marker; el flujo cubre petición nunca recibida, commit remoto posterior y recuperación satisfactoria.                                                                                                                                                                                                                                                                                                 |
| E3      | P2   | fixed  | La frontera TypeBox usa las constantes exportadas de dominio y admite únicamente `0` o `[10⁻⁶, 10¹⁵]`; route y servicio autoritativo prueban 0, ambos límites y rechazos `10⁻⁷`/`10²¹`. OpenAPI se regeneró desde la API real: el artefacto web quedó byte-idéntico porque el generador reduce valores de `Record` a `passthrough`, mientras los probes de ruta conservan el contrato exacto.                                                                                                                                                                                                                                                                       |
| E4      | P2   | fixed  | Los defaults calculan un número entero de steps acotado desde `min`, nunca superan `MAX_PROGRAM_WEIGHT` y mantienen alineación/round-trip. Se prueban casos ordinarios, step exacto `10¹⁵`, min no cero junto al límite y render/parse ES+EN.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| E5      | P1   | fixed  | Redis mantiene una generación distribuida por owner. Todo miss captura generación antes del DB read; un Lua CAS escribe solo si sigue coincidiendo. Cada commit lifecycle incrementa generación y borra IDs deduplicados en un Lua atómico; rollback no avanza. Redis ausente desactiva el fill y las mutaciones siguen fail-open. El interleaving A-read/B-commit/A-fill tardío queda rechazado determinísticamente.                                                                                                                                                                                                                                               |
| E6      | P1   | fixed  | Cada productor captura owner, token y generación de sesión antes incluso de la lectura local. Todas las páginas y detalles usan esa sesión; se valida antes y después de red y otra vez dentro de la transacción de cache. Un cambio A→B invalida la respuesta tardía y jamás permite escribir datos de B en la partición A. Tracker convierte un preflight obsoleto en estado no disponible sin lanzar desde el effect. Tests cubren lectura local diferida, primera respuesta, cambio entre páginas y preflight obsoleto.                                                                                                                                         |
| E7      | P1   | fixed  | Leases monotónicas por owner/recurso (`library`, `catalog`, `definition:id`, `detail:id`) avanzan al capturar cada productor nuevo; catálogo-lista y definiciones independientes no compiten. Cada transacción valida antes y después de sus writes y lanza para rollback si la lease cambia mientras SQLite espera. Create/manage/reactivate/delete/pin/detail también avanzan generaciones. Respuestas antiguas no reemplazan summary, detail, pin, tombstone, snapshot ni freshness. Tests cubren lifecycle, refreshes solapados e invalidación a mitad de write.                                                                                                |
| E8      | P2   | fixed  | `ProgramContentOrigin` llega a tiers. Solo `source:preset` con ID canónico usa copy de tier canónico; custom/externo que colisiona con `t1`/`main` conserva su label suministrada. Oracle y colisiones independientes lo prueban.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| E9      | P2   | fixed  | Delete confirmado elimina en la misma transacción summary, detail, pin, queue y todas las reconciliaciones owner/entidad. Comparte lane con manage, conserva el marker de delete si el outcome es desconocido y no toca otra entidad/owner. SQLite real cubre markers tipados/legacy, cola ajena y concurrencia manage/delete.                                                                                                                                                                                                                                                                                                                                      |

### Checks de la corrección final4

| Check                             | Resultado                                | Nota                                                                                            |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Focales E1-E9 mobile              | verde: 9 suites, 197 tests               | Crash/interleavings, recovery, owner switch/paginación, generaciones, defaults, source y delete |
| Focales API E3/E5                 | verde: 3 suites, 90 tests                | Schema/routes, validación autoritativa y barrera Redis distribuida                              |
| `pnpm --filter mobile test`       | verde: 37 suites, 318 tests, 2 snapshots | Reconfirma D1-D8, C1-C5 y N1-N13 sin warnings React                                             |
| Mobile routes/i18n/lint/typecheck | verde                                    | Manifiesto sin drift; i18n 8/8 y 0 keys ausentes; ESLint y TS estrictos                         |
| Domain tests/typecheck            | verde: 7 ficheros, 51 tests              | Frontera numérica y validación config                                                           |
| Database tests/typecheck          | verde: 6 ficheros, 89 tests              | 5 integraciones DB externas saltadas por entorno                                                |
| API tests/lint/typecheck          | verde: 46 ficheros, 728 tests            | Lifecycle, locks, Redis, rutas y servicio                                                       |
| OpenAPI web `api:types`           | verde, sin diff                          | Regenerado contra `/swagger/json` de la API local actual con rutas dev condicionadas            |
| Expo export Android               | verde: 1.245 módulos                     | 24 assets; 26 ficheros; Hermes HBC 3.892.629 B                                                  |
| Prettier + `git diff --check`     | pendiente de cierre                      | Se ejecuta tras este registro vivo                                                              |
| `autoreview --mode local`         | dos pasadas corregidas                   | 5 findings aceptados: orden/atomicidad de leases, recursos y dos preflights; rerun pendiente    |
| Secret scan y hooks               | pendiente de cierre                      | Hooks activos en el commit final                                                                |
| E2E                               | no ejecutado por política                | Reservado para M8                                                                               |

### Riesgos de la corrección final4

- Redis sigue siendo fail-open para no convertir una caída de cache en una caída de mutaciones. Si
  Redis falla justo al invalidar, una entrada ya existente puede sobrevivir hasta su TTL de cinco
  minutos; mientras Redis no está disponible no se hacen fills nuevos. La generación distribuida
  elimina la carrera stale-refill cuando Redis funciona.
- Las generaciones mobile son de proceso y protegen productores vivos. Tras restart no existe un
  productor antiguo, y la verdad durable sigue en SQLite; los markers tipados reanudan recuperación
  explícita sin supersesión.
- El cliente OpenAPI generado no materializa constraints internos de valores `Record`; por eso la
  regeneración exacta no cambia el fichero. Los schemas TypeBox publicados y los tests HTTP sí
  fijan `0` o `[10⁻⁶, 10¹⁵]`.
- Las cinco pruebas database que requieren infraestructura externa permanecieron saltadas. Las
  migraciones SQLite, transacciones owner-scoped y contratos runtime sí se ejecutaron localmente.
- M2 sigue pendiente de dos reverificaciones frescas. Esta corrección no declara GO.

### Continuidad del corrector final4 tras la tercera autoreview

La tercera autoreview encontró dos gaps de cierre adicionales, ambos P2 y dentro del mismo límite de
concurrencia de E7. Esta continuidad heredó el patch sin commit, comprobó la implementación exacta y
cerró ambos sin ampliar el alcance:

- un consumidor activo de Programas cuyo commit de refresh pierde la lease relee el snapshot ganador
  de SQLite y sale de `loading` tanto para `library` como para `catalog`;
- `cacheCreatedProgram` avanza también `definition:<programId>` antes de su transacción, por lo que un
  productor de definición anterior al create ya no puede sobrescribir la definición confirmada.

Las regresiones deterministas elevan mobile de 318 a 321 tests: snapshot ganador de biblioteca,
snapshot ganador de catálogo e invalidación del productor de definición anterior al create. La
auditoría de no regresión confirmó además leases únicas por productor, preflight de sesión fuera de
las regiones `outcome_unknown`, cancelación no explosiva de sesión obsoleta en Tracker, validación
pre/post-write con rollback en los cuatro commits SQLite de refresh y recursos independientes
`library`, `catalog`, `definition:<id>` y `detail:<id>`.

| Check de continuidad                                                | Resultado                       |
| ------------------------------------------------------------------- | ------------------------------- |
| Focales mobile refresh/session/repositorio/Programas/Tracker/create | verde: 9 suites, 160 tests      |
| `pnpm --filter mobile test`                                         | verde: 37 suites, 321 tests     |
| Mobile routes/typecheck/lint/i18n                                   | verde; i18n 1 suite, 8 tests    |
| Focales API cache/routes/servicio                                   | verde: 3 ficheros, 90 tests     |
| API test/typecheck/lint                                             | verde: 46 ficheros, 728 tests   |
| Domain test/typecheck                                               | verde: 7 ficheros, 51 tests     |
| Database test/typecheck                                             | verde: 6 ficheros, 89 tests     |
| Integraciones database con infraestructura externa                  | 5 saltadas por entorno          |
| E2E                                                                 | no ejecutado; reservado para M8 |

Este cierre sigue sin constituir GO: M2 queda pendiente de dos revisores independientes frescos.

### Finding de autoreview de cierre

La primera autoreview de esta continuidad aceptó un P1 adicional dentro del límite de sesión: un
restore A tardío podía instalarse o invalidar el estado después de un login B más nuevo. El restore
ahora prepara el resultado sin mutar credenciales globales, valida la generación antes de persistir e
instalar y señala explícitamente el intento obsoleto para que el provider no borre al usuario nuevo.
Dos regresiones cubren restore A tardío tanto exitoso como fallido después del login B. Mobile queda
en 37 suites, 323 tests y 2 snapshots verdes; typecheck y lint también permanecen verdes. Este
finding aceptado no sustituye las dos revisiones independientes exigidas para M2.

### Riesgos y fuera de alcance

- La creación sigue online-only y no se reintenta automáticamente: la API aún no ofrece idempotency
  key para este POST. Un outcome incierto se reconcilia mediante GET, nunca repitiendo el POST; si
  no puede identificarse de forma inequívoca, el bloqueo persiste en vez de asumir que falló.
- M3 registrará el contrato completo como migración 5 y adaptará sesiones/outbox runtime; M2 solo
  demuestra la composición y no implementa el tracker set-a-set.
- M4, M6 y la API/editor de definiciones personalizadas permanecen fuera de alcance.
- Las filas v1 siguen sin owner y jamás se atribuyen a la sesión activa; v5 las pone en cuarentena.
- E2E y métricas nativas continúan reservados para M8. Esta corrección no marca GO.

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

## M2 — cierre definitivo del corrector (continuación)

Fecha: 2026-07-28

Base heredada: `0e977604c23b22087da50a57a2e3dd9aced821ed`

Estado: implementación y matriz final verdes; autoreview final pendiente antes del commit; pendiente
de dos revisores independientes frescos

La décima autoreview no estaba limpia. Aceptó dos P2 relacionados que invalidaban el workaround
documentado en el séptimo ciclo: el overflow de sign-out borraba cookies del navegador sin revocar
sus sesiones servidor, por lo que una copia del token seguía siendo válida, y nueve logins
concurrentes podían crear nueve nombres versionados y dejar al navegador permanentemente por encima
del límite.

La corrección elimina ese estado inválido en el protocolo, no solo en el error. Los logins browser
emiten ahora exclusivamente ocho slots fijos (`refresh_token_slot_0` a
`refresh_token_slot_7`) elegidos por el orden durable de la familia. Refresh conserva el slot
seleccionado y migra los dos nombres anteriores sin crear nombres nuevos. Por construcción solo
existen diez credenciales reconocibles en una petición: ocho slots más los nombres base y legacy.
Sign-out puede por tanto revocar y expirar todas, con fan-out estrictamente acotado y sin
`Clear-Site-Data`; nombres que solo se parecen a refresh quedan fuera antes de hash o lookup DB.

Tres regresiones deterministas fijan el contrato: nueve emisiones consecutivas ocupan exactamente
ocho slots, un refresh ignora nueve nombres no reconocidos sin tocar hash/DB, y sign-out revoca y
expira el namespace completo de diez nombres. No se añadieron assertions para ocultar errores.

### Matriz final sin E2E

| Check                                       | Resultado                                               |
| ------------------------------------------- | ------------------------------------------------------- |
| Focales mobile auth/reconciliación/cache/UI | verde: 11 suites, 278 tests, 2 snapshots                |
| Focales API auth/session/cache/programas    | verde: 5 ficheros, 240 tests                            |
| `pnpm --filter mobile test`                 | verde: 37 suites, 418 tests, 2 snapshots                |
| Mobile routes/typecheck/lint                | verde                                                   |
| Mobile i18n ES/EN                           | verde: 1 suite, 8 tests, 0 keys ausentes                |
| `pnpm --filter api test`                    | verde: 47 ficheros, 766 tests                           |
| API typecheck/lint                          | verde                                                   |
| Domain test/typecheck                       | verde: 7 ficheros, 51 tests                             |
| Database test/typecheck                     | verde: 6 ficheros, 89 tests                             |
| Integraciones database externas             | 5 saltadas: requieren PostgreSQL/infraestructura opt-in |
| Drizzle `check` / generación                | verde; 13 tablas, sin cambios de schema pendientes      |
| OpenAPI web `api:types`                     | verde; schema final sin drift                           |
| E2E                                         | no ejecutado; reservado exclusivamente para M8          |

El fallo inicial de `drizzle-kit check` sin URL fue solo de configuración local; la repetición usó
una URL PostgreSQL ficticia no conectada, suficiente para cargar el config, y terminó
`Everything's fine`. Las cinco integraciones PostgreSQL opt-in siguen siendo el único skip externo.

Este cierre no es una revisión independiente ni declara GO. M2 continúa pendiente de dos revisores
independientes frescos sobre el commit final. E2E no se ejecutó.

### Autoreview final limpia

La autoreview final sobre implementación, regresiones, snapshot Drizzle y matriz documentada revisó
el bundle de 630.451 bytes en dos chunks. Ambos terminaron con cero findings aceptados/accionables;
el resultado combinado fue `autoreview chunked clean`, `overall: patch is correct` y confianza
`0.87`. Tras registrar este resultado se repiten formato, `git diff --check` y la autoreview exigida
para el árbol documental definitivo antes del commit.

El estado de aprobación no cambia: este proceso es corrección, no reverificación independiente. M2
sigue esperando dos revisores independientes frescos y no declara GO. E2E no se ejecutó.

### Corrección final del protocolo de cookies

La repetición exigida tras documentar la autoreview limpia anterior la supersedió inmediatamente:
aceptó dos P1 en los slots fijos. Reutilizar `familyOrder % 8` permitía que una respuesta antigua
sobrescribiera el slot ganador; además, expiraciones tardías de login, refresh o sign-out podían
borrar una credencial nueva que hubiese reutilizado el mismo nombre. Por tanto, el dictamen limpio
anterior no es el dictamen de cierre.

La solución definitiva conserva nombres únicos derivados del hash del token. Nueve logins
concurrentes producen nueve nombres independientes y la selección batch elige la única familia
activa de mayor `familyOrder`; una respuesta tardía solo puede instalar su propio nombre, nunca
sobrescribir el ganador. Login y refresh expiran como máximo ocho nombres capturados y escriben un
nombre nuevo, por lo que el cleanup sigue acotado y no puede alcanzar una credencial creada después
de la petición.

Sign-out hashea todo el snapshot presentado y lo entrega a una única operación transaccional batch.
Esta localiza tanto hashes actuales como `previous_token_hash`, toma locks de familias y usuarios,
relee candidatos/activos y elimina en bloque solo familias cuya generación máxima también estaba en
el snapshot. Así revoca sucesores de refresh y tokens copiados incluso con overflow, pero conserva
un login concurrente posterior. La respuesta emite como máximo ocho expiraciones precisas; el resto
de cookies puede quedar localmente hasta otro cleanup o su TTL, pero ya no autoriza ninguna sesión.

Las regresiones prueban nueve nombres concurrentes distintos, refresh tardío sin colisión,
revocación batch del overflow, recuperación de ancestro rotado, preservación de una generación
posterior ausente y revocación de la generación posterior cuando su propia credencial sí fue
capturada.

| Check definitivo sin E2E                         | Resultado                                |
| ------------------------------------------------ | ---------------------------------------- |
| Focales mobile auth/reconciliación/cache/UI      | verde: 11 suites, 278 tests, 2 snapshots |
| `pnpm --filter mobile test`                      | verde: 37 suites, 418 tests, 2 snapshots |
| Mobile routes/i18n/typecheck/lint                | verde; i18n 1 suite, 8 tests             |
| Focales API auth/session/cache/programas         | verde: 5 ficheros, 243 tests             |
| `pnpm --filter api test`                         | verde: 47 ficheros, 769 tests            |
| API typecheck/lint                               | verde                                    |
| Domain test/typecheck                            | verde: 7 ficheros, 51 tests              |
| Database test/typecheck                          | verde: 6 ficheros, 89 tests              |
| Integraciones PostgreSQL opt-in                  | 5 saltadas por entorno                   |
| Drizzle check/generate                           | verde; sin cambios pendientes            |
| Prettier / `git diff --check` / autoreview final | pendiente tras este apéndice             |
| E2E                                              | no ejecutado; reservado para M8          |

M2 continúa pendiente de dos revisores independientes frescos y no declara GO. E2E no se ejecutó.

### Ajuste final de revocación por lote

Durante la inspección de cierre se encontró una carrera real en la revocación batch: buscar también
por `previous_token_hash` hacía que un logout retrasado con la cookie A incluyera al sucesor B de un
login posterior cuando B referenciaba A. Al calcular la generación máxima como si B hubiera estado en
el snapshot, el logout podía borrar la sesión ganadora.

La revocación batch ahora selecciona exclusivamente los `token_hash` realmente enviados por el
navegador. Los antecesores consumidos permanecen como tombstones hasta que vence su sucesor, de modo
que el logout retrasado conserva su familia representada sin confundir una respuesta posterior con
una credencial presentada. La nueva regresión determinista cubre A retrasada y B enlazada, verificando
que B continúa activa y no se emite `DELETE`.

| Check adicional sin E2E                          | Resultado                                                |
| ------------------------------------------------ | -------------------------------------------------------- |
| Focal API `auth-session`                         | verde: 1 fichero, 21 tests                               |
| Focal API `auth`                                 | verde: 1 fichero, 127 tests                              |
| `pnpm --filter api test`                         | verde: 47 ficheros, 770 tests                            |
| API typecheck/lint                               | verde                                                    |
| `pnpm --filter mobile test`                      | verde: 37 suites, 418 tests, 2 snapshots                 |
| Mobile routes/i18n/typecheck/lint                | verde; i18n 1 suite, 8 tests, 0 keys ausentes            |
| Domain test/typecheck                            | verde: 7 ficheros, 51 tests                              |
| Database test/typecheck                          | verde: 6 ficheros, 89 tests; 5 integraciones opt-in skip |
| Drizzle `db:generate`                            | verde: 13 tablas, sin cambios de schema                  |
| OpenAPI web `api:types`                          | verde contra API local efímera; sin drift nuevo          |
| Prettier / `git diff --check` / autoreview final | pendiente tras este registro                             |
| E2E                                              | no ejecutado; reservado exclusivamente para M8           |

Este ajuste sigue siendo trabajo del corrector, no una reverificación independiente ni una decisión
GO. M2 continúa pendiente de dos revisores independientes frescos y E2E permanece reservado a M8.

### Bloqueo de autoreview registrado

La autoreview local se intentó sobre el árbol congelado después de formato y `git diff --check`, pero
su escáner fail-closed rechazó el bundle antes de invocar al modelo. El único archivo marcado fue
`apps/backend/api/src/routes/auth.test.ts`; el valor detectado está en el lado eliminado del diff y
es el literal de fixture `refresh_token=rotated-old-token`, no una credencial. El helper no ofrece
una allowlist ni un override para tests y cambiar el lado base exigiría reescribir historia o crear
commits extra, acciones fuera de este ciclo.

Por tanto, este intento no cuenta como autoreview limpia. El bloqueo se deja explícito para que Main
decida un procedimiento permitido; no cambia el estado de M2, no sustituye las dos revisiones frescas
pendientes y no declara GO.

Se probó además conservar exactamente ese literal en la misma llamada semántica del test de sign-out,
con la aserción actual de revocación batch. El test focal siguió verde (127 casos) y `git diff --check`
siguió limpio, pero una nueva ejecución de `autoreview --mode local` volvió a rechazar el mismo archivo
antes de arrancar el modelo. Por ello no se registran ni una autoreview limpia ni una sustitución
manual del control.

### Segundo ciclo de corrección

Se inició el aislamiento durable de la cola: la migración móvil v5 conserva las filas v1 sin
propietario en cuarentena y crea `queued_mutations` con `owner_user_id`; los envíos y acuses nuevos
se filtran por ese propietario. También se acotó a ocho el procesamiento de cookies refresh antes de
hashing, consulta `IN` o revocación por lote. Para el POST de creación se introdujo una clave de
idempotencia persistida localmente antes de despachar y única por usuario en el servidor, de modo que
un reintento recupera la misma instancia.

Se eliminaron las firmas legacy sin propietario de la cola: encolar, listar, reconocer, borrar y
flush exigen `ownerUserId`; no se puede volver a introducir una fila nueva en una cohorte
"legacy". Las regresiones cubren que una cola de A no se lista, reconoce ni bloquea el envío de B,
y que un resultado incierto de create vuelve a usar la misma clave persistida hasta recibir un único
ganador. La clave queda además ligada a la identidad exacta del intento (`programId`, nombre y
configuración), por lo que un create diferente no puede recuperar el resultado del anterior. La
migración v5 se prueba en SQLite real: conserva la fila v1 en cuarentena y rechaza un insert nuevo
que omita el propietario.

La siguiente autoreview aceptó tres regresiones reales y se corrigieron en el mismo ciclo. Un
overflow de cookies ya no informa un sign-out parcial como exitoso: los nombres base y legacy se
priorizan, refresh falla cerrado sin hashing y sign-out responde 400 mientras expira los nombres
priorizados. El flush del tracker captura una sesión autorizada del mismo propietario después de
persistir la mutación; una transición de A a B no puede enviar la cola de A con el token de B. Las
regresiones focales cubren los tres casos.

| Check adicional sin E2E                    | Resultado                                                        |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `pnpm --filter mobile test -- --runInBand` | pendiente de repetición final tras las regresiones               |
| Mobile typecheck                           | verde                                                            |
| API typecheck + focal `auth.test.ts`       | verde; 127 tests                                                 |
| Database test/typecheck                    | verde: 6 ficheros, 89 tests; 5 integraciones opt-in skip         |
| Drizzle `db:generate`                      | verde con URL local ficticia; 0044 snapshot, sin migración nueva |
| Prettier / `git diff --check`              | verde                                                            |
| OpenAPI                                    | no reejecutado: este ciclo no cambió rutas ni schemas de Elysia  |
| Autoreview                                 | 3 findings aceptados y corregidos; pendiente de repetición final |
| E2E                                        | no ejecutado; reservado exclusivamente para M8                   |

Este cierre de corrección no es una reverificación independiente ni declara GO. M2 continúa
pendiente de dos revisores independientes frescos y E2E permanece reservado a M8.

### Corrección de cierre de idempotencia create

El último dictamen detectó una carrera entre dos POST concurrentes del mismo intento: después de
que una respuesta ganadora limpiase la reserva local, una respuesta incierta tardía podía insertar
un marcador genérico nuevo. La reserva ahora es la única fuente de transición: los resultados
inciertos o ACK con caché pendiente solo actualizan condicionalmente la reserva exacta
`(owner, intent, idempotency key, entity actual)`. Si el ganador ya la cerró, la transición afecta
cero filas y no se vuelve a crear nada. El cierre terminal borra por la identidad de la reserva,
así que también vence a un marcador incierto que hubiese llegado justo antes.

Los marcadores se conservan únicamente mientras el resultado sea incierto o haya un ACK remoto sin
reconciliación local. Un create aplicado limpia su reserva; un rechazo terminal también la limpia.
En la API, la misma `Idempotency-Key` ya no equivale solo a "devolver lo primero": se compara contra
la identidad normalizada de la petición (programa, nombre recortado y configuración validada) y un
uso distinto devuelve `409 IDEMPOTENCY_KEY_CONFLICT`.

| Check focal sin E2E               | Resultado                                      |
| --------------------------------- | ---------------------------------------------- |
| Repositorio/create use case móvil | verde: 98 tests en 2 suites                    |
| Servicio de programas API         | verde: 49 tests                                |
| Mobile + API typecheck            | verde                                          |
| E2E                               | no ejecutado; reservado exclusivamente para M8 |

Este registro documenta una corrección del corrector; no sustituye la reverificación fresca de los
dos revisores ni declara GO.

La autoreview local se inició sobre el árbol completo de M2 con `--mode local`, pero el proceso
interactivo excedió el límite de 124 segundos del entorno antes de emitir un dictamen. No se le
atribuye un resultado limpio ni findings; queda pendiente de continuación por Main sin modificar el
árbol ni ejecutar E2E.

### P1 final de compatibilidad React Native

La generación de claves de idempotencia de create ya no depende de `globalThis.crypto`, que no es
un contrato fiable de React Native. `program-use-cases` usa ahora `expo-crypto` y
`Crypto.randomUUID()`, disponible en el runtime de Expo. La suite mockea explícitamente ese módulo,
comprueba que se invoca el generador nativo y mantiene un UUID distinto para el caso de un segundo
intento con otra intención.

| Check focal sin E2E                     | Resultado                                      |
| --------------------------------------- | ---------------------------------------------- |
| Repositorio/create use case móvil       | verde: 98 tests en 2 suites                    |
| Mobile typecheck + lint                 | verde                                          |
| Prettier selectivo + `git diff --check` | verde                                          |
| E2E                                     | no ejecutado; reservado exclusivamente para M8 |

Sigue siendo corrección del corrector, no una revisión independiente ni un GO.

### P2 de identidad canónica de create

La identidad de creación vive ahora en una única función de dominio: recorta el nombre y serializa
la configuración con claves JSON ordenadas recursivamente. Mobile reserva la misma clave para
payloads semánticamente equivalentes aunque cambie el whitespace o el orden de propiedades, y envía
el nombre normalizado al API. El servidor usa esa misma identidad para comparar una
`Idempotency-Key` existente antes de consultar o validar el catálogo; por ello un reintento idéntico
devuelve su instancia aun si el catálogo cambió, mientras que una identidad distinta devuelve
`409 IDEMPOTENCY_KEY_CONFLICT` incluso si la configuración ya no sería válida para dicho catálogo.

La revisión posterior sustituyó esa reconstrucción por una identidad inmutable persistida; el
detalle y sus checks están registrados inmediatamente después de esta sección.

| Check focal sin E2E               | Resultado                                      |
| --------------------------------- | ---------------------------------------------- |
| Repositorio/create use case móvil | verde: 99 tests en 2 suites                    |
| Servicio de programas API         | verde: 51 tests                                |
| Dominio `program-config`          | verde: 10 tests                                |
| Typecheck mobile + API + domain   | verde                                          |
| E2E                               | no ejecutado; reservado exclusivamente para M8 |

Sigue siendo corrección del corrector, no una revisión independiente ni un GO.

### P2 final: huella inmutable de idempotencia

Una `Idempotency-Key` ya no se compara reconstruyendo el payload desde `name` ni ningún otro campo
editable. `creation_intent` almacena al crear la serialización canónica junto a `creation_key`; la
API compara exclusivamente esa huella. Así, el replay exacto tras renombrar el programa devuelve la
instancia original, mientras que cualquier payload distinto conserva el `409
IDEMPOTENCY_KEY_CONFLICT`. La migración Drizzle `0045_glorious_skrulls` añade la columna y actualiza
su snapshot y journal, sin reescribir la migración 0044 ya existente.

| Check focal sin E2E                                      | Resultado                                      |
| -------------------------------------------------------- | ---------------------------------------------- |
| API: creación, replay tras rename y conflicto de payload | verde: 53 tests focales                        |
| Dominio: serialización canónica                          | verde: 10 tests focales                        |
| DB: migración, journal y snapshot                        | verde: 95 tests (5 omitidos)                   |
| Typecheck API + dominio + DB + mobile; lint API + mobile | verde                                          |
| Prettier selectivo + `git diff --check`                  | verde                                          |
| E2E                                                      | no ejecutado; reservado exclusivamente para M8 |

Sigue siendo corrección del corrector, no una revisión independiente ni un GO.

### Corrección final de reservas y replay de create

Una reserva de create reutilizada que recibe un rechazo remoto antes del lookup de idempotencia (por
ejemplo, `429`) no borra la clave
que podría pertenecer a un create previamente despachado o de resultado incierto; un retry posterior
conserva la misma clave. También el creador inicial conserva su reserva ante un rechazo pre-lookup:
no hay una prueba local de que ningún hermano concurrente haya despachado la misma clave, así que solo
el ACK aplicado y cacheado la cierra.

El replay existente del API vuelve ahora a cargar resultados y undo history igual que la respuesta
normal de detalle. La identidad canónica, por su parte, genera objetos mediante `Object.fromEntries`,
de modo que `__proto__` se preserva como una clave JSON ordinaria y no altera el prototipo durante la
serialización.

| Check focal sin E2E                          | Resultado                                      |
| -------------------------------------------- | ---------------------------------------------- |
| Mobile: use cases y repositorio de programas | verde: 101 tests en 2 suites                   |
| API: servicio de programas                   | verde: 53 tests focales                        |
| Dominio: serialización canónica              | verde: 11 tests focales                        |
| DB: migración, journal y snapshot            | verde: 95 tests (5 omitidos)                   |
| E2E                                          | no ejecutado; reservado exclusivamente para M8 |

Sigue siendo corrección del corrector, no una revisión independiente ni un GO.

### Corrección final de atomicidad de migraciones SQLite

El runner relee `PRAGMA user_version` después de adquirir la transacción exclusiva y mantiene cada
SQL de migración junto con su version bump dentro de esa misma transacción. Así, la copia, drop,
recreación e índice de v5, y los dos `ALTER TABLE` de v6, revierten completos si hay interrupción;
el siguiente bootstrap ve la versión anterior y puede reintentar sin perder una fila de cola ni
tropezar con una columna creada a medias. Las regresiones ejecutan ambos cortes con SQLite real y
comprueban rollback y retry.

| Check focal sin E2E                      | Resultado                                      |
| ---------------------------------------- | ---------------------------------------------- |
| Migraciones de biblioteca/cola SQLite    | verde: 118 tests en 4 suites                   |
| Mobile: reserva create, typecheck y lint | verde                                          |
| Prettier selectivo + `git diff --check`  | verde                                          |
| E2E                                      | no ejecutado; reservado exclusivamente para M8 |

Sigue siendo corrección del corrector, no una revisión independiente ni un GO.
