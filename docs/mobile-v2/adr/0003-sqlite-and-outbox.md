# ADR 0003: SQLite local-first y outbox cerrada

- Estado: aceptado como contrato objetivo
- Fecha: 2026-07-27
- Alcance de implementación: M2-M5

## Contexto

Mobile v1 ya escribe cachés y una `queued_mutations`, pero su operación y payload son strings/records
abiertos. No registra intentos, backoff, idempotencia ni conflictos. Mobile v2 debe confirmar cada tap
localmente y poder explicar si está guardado, pendiente, bloqueado o sincronizado.

## Decisión

SQLite será la fuente operativa móvil. React Query mantendrá estado de transporte e invalidación, no
reemplazará a SQLite. Cada caso de uso mutante escribirá el agregado local y su outbox dentro de una
misma transacción exclusiva.

Las migraciones siguen `PRAGMA user_version`, son incrementales y append-only. La migración v1 queda
congelada. Una migración publicada nunca se edita, reordena ni elimina; una corrección usa la siguiente
versión. La aplicación nunca borra/recrea la DB como parte de un upgrade.

`outbox_mutations` sustituirá a `queued_mutations`, pero ninguna fila v1 se copiará directamente a la
nueva outbox: v1 no guardaba propietario y atribuirla a la sesión activa mezclaría cuentas. La
migración contractual mueve esas filas a `legacy_queued_mutations_quarantine` con una clave estable
derivada de su ID (`v1-queue:%016x`). Las caches v1 (`program_summaries`, `program_details` y
`program_definitions`) se mueven de igual forma a `legacy_user_cache_quarantine` con claves estables
por tabla e ID.

Ambas cuarentenas nacen con `claim_state = quarantined` y sin `owner_user_id`. Una fila solo puede
pasar a `validated` cuando una consulta autenticada al servidor confirma que la entidad pertenece al
usuario, dejando `validated_owner_user_id`, `server_ownership_proof` y `validated_at`. Un `CHECK`
impide reclamar sin las tres evidencias. Rechazo o ausencia de conectividad mantiene la fila fuera de
las caches y de la outbox operativas; reclamar tampoco encola automáticamente una mutación. La
promoción explícita, con parser del payload y nueva UUID idempotente, se implementará junto con los
repositorios v2.

Las tablas operativas `program_*` se recrean con `PRIMARY KEY (owner_user_id, id)`. Por tanto, si A
queda localmente tras un logout remoto fallido y B inicia sesión, las lecturas y el flush de B filtran
por B y no ven ni reproducen filas de A. Cambiar credenciales nunca cambia el owner de una fila.

La nueva outbox tiene este contrato:

```text
id TEXT PRIMARY KEY                  -- idempotency_key UUID
owner_user_id TEXT NOT NULL
entity_type TEXT NOT NULL            -- workout_session | workout_set | program_instance | preference
entity_id TEXT NOT NULL
operation TEXT NOT NULL
payload_json TEXT NOT NULL
attempt_count INTEGER NOT NULL DEFAULT 0
next_attempt_at TEXT NOT NULL
last_error_code TEXT NULL
state TEXT NOT NULL                  -- pending | retry_wait | blocked_conflict
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

En TypeScript, `entity_type + operation` discrimina el payload. No se acepta `Record<string, unknown>`
después de leer SQLite/red: un parser runtime produce la unión cerrada o marca la fila como error
visible. `id` viaja como `Idempotency-Key` o como ID del recurso cuando el endpoint es `PUT`.

El adapter SQLite devuelve filas como `unknown[]`, nunca mediante un genérico elegido por el caller.
Cada repositorio valida nombres y tipos de columnas antes de construir su modelo; una fila corrupta se
rechaza con error explícito. Los parámetros de bind se limitan al `SQLiteBindValue` exportado por
Expo SQLite.

Orden y concurrencia:

1. FIFO estable por `created_at, id` dentro de una entidad.
2. Una sola operación en vuelo por `entity_type/entity_id`.
3. Entidades independientes pueden sincronizarse en paralelo con límite acotado.
4. Upserts pendientes del mismo set se coalescen conservando la clave y el último payload.
5. Delete/tombstone no se coalesce con una recreación posterior de identidad diferente.

Backoff: primer reintento a 5 s y exponencial con jitter hasta 15 min. `401` intenta una única rotación
de token; si falla, pausa hasta restaurar sesión. `409/412` pasa a `blocked_conflict`; errores de red y
5xx reintentan; 4xx de validación se bloquean y muestran el código. Ninguna fila se descarta sin ACK
remoto o resolución explícita del usuario.

Los triggers de flush son restauración de sesión, foreground, conectividad recuperada, finalización
de workout y reintento manual. Cerrar sesión detiene el flush antes de cambiar credenciales. Los datos
se particionan por `owner_user_id`; nunca se reproducen filas de otro usuario.

M2 registra la migración runtime 2 para la biblioteca de programas: crea tablas paralelas
`mobile_v2_program_*`, owner-scoped, y conserva intactas las tablas v1 y `queued_mutations` que el
tracker M1 todavía usa. La corrección M2 añade la migración 3, limitada al marcador transaccional de
snapshots remotos de biblioteca y catálogo; una tabla vacía sin ese marcador sigue siendo
`no_snapshot`, mientras que un GET remoto vacío confirmado queda como `snapshot_empty`. El catálogo
v2 poblado sí demuestra un reemplazo remoto completo y la migración conserva esa procedencia; las
filas de biblioteca no, porque un create con ACK y sin GET posterior puede haber guardado solo una
instancia. Esas filas se exponen como datos confirmados parciales con copy de primera sincronización,
nunca como el último snapshot completo.

El SQL completo queda congelado en
`apps/frontend/mobile/src/lib/db/mobile-v2-schema-contract.ts` como versión contractual 4. Compone de
forma determinista v1 → v2(M2) → v3(snapshot metadata) → v4: pone caches/cola v1 sin owner en
cuarentena, promueve solo filas M2 que ya tienen owner, conserva sus marcadores de snapshot, crea
`workout_sessions`, `workout_set_logs` y `outbox_mutations`, y no reclama ni reproduce mutaciones
legacy. M3 debe adaptar sus repositorios y registrar ese paso exacto como migración 4; no puede
reutilizar los números 2/3 ni saltar directamente a una versión posterior.

## Alternativas consideradas

- Mutar servidor primero: hace cada tap dependiente de red.
- Conservar la cola abierta v1: dificulta validación exhaustiva, coalescencia y UI de errores.
- Last-write-wins global por timestamp de dispositivo: relojes no confiables pueden perder cambios.
- CRDT completo: coste desproporcionado para agregados serializables por usuario y entidad.
- Borrar la DB al migrar: simple, pero viola la garantía de no pérdida.

## Consecuencias

- Toda lectura de `payload_json` tendrá pruebas de datos válidos, malformados y de versión anterior.
- M3 registra la migración completa como versión 4 y necesita pruebas de caída entre escritura local
  y flush, taps rápidos, token expirado y cambio de
  usuario.
- Las altas sin endpoint idempotente seguirán online-only.
- La UI de Perfil podrá derivar contadores por `state` y ejecutar reintento sin inspeccionar payloads.
- M0 congela y ejecuta el SQL objetivo solo como contrato; la sustitución física ocurre en un slice
  posterior, después de adaptar todos los repositorios.
