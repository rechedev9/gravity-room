# ADR 0002: Sesiones de entrenamiento y logs de series

- Estado: aceptado como contrato objetivo
- Fecha: 2026-07-27
- Alcance de implementación: M3-M4 y su API asociada

## Contexto

El servidor guarda resultados por `program instance + workout index + slot`, y `setLogs` es un array
dentro del resultado. Esto preserva progresión, pero no representa inicio, reanudación, duración,
notas, set enfocado ni borrados/reordenaciones offline. Mobile v2 necesita una sesión explícita sin
cambiar la autoridad de `@gzclp/domain` sobre prescripción y progresión.

## Decisión

SQLite incorporará mediante una migración posterior a v1 estas entidades. Los nombres y unidades son
parte del contrato:

```text
workout_sessions
  id TEXT PRIMARY KEY                 -- UUID generado en cliente
  owner_user_id TEXT NOT NULL
  program_instance_id TEXT NOT NULL
  workout_index INTEGER NOT NULL CHECK(workout_index >= 0)
  status TEXT NOT NULL CHECK(status IN ('in_progress', 'completed', 'cancelled'))
  started_at TEXT NOT NULL            -- ISO-8601 UTC
  completed_at TEXT NULL
  notes TEXT NULL
  focused_slot_id TEXT NULL
  focused_set_id TEXT NULL
  updated_at TEXT NOT NULL
  server_revision TEXT NULL
  CHECK(
    (status = 'in_progress' AND completed_at IS NULL)
    OR (status IN ('completed', 'cancelled') AND completed_at IS NOT NULL)
  )

workout_set_logs
  id TEXT PRIMARY KEY                 -- UUID estable, no índice posicional
  session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE
  slot_id TEXT NOT NULL
  position INTEGER NOT NULL CHECK(position >= 0)
  kind TEXT NOT NULL CHECK(kind IN ('working', 'warmup'))
  reps INTEGER NOT NULL CHECK(reps BETWEEN 0 AND 999)
  weight_kg REAL NULL CHECK(weight_kg >= 0)
  rpe INTEGER NULL CHECK(rpe BETWEEN 1 AND 10)
  is_amrap INTEGER NOT NULL CHECK(is_amrap IN (0, 1))
  completed_at TEXT NULL
  deleted_at TEXT NULL                -- tombstone sincronizable
  updated_at TEXT NOT NULL
```

Habrá como máximo una sesión `in_progress` por `owner_user_id`, mediante índice único parcial. Cada
set tiene identidad estable; `position` solo ordena. El valor canónico de peso es kg. Cambiar a lb es
una conversión de presentación y no reescribe almacenamiento.

`completed_at` representa el cierre del lifecycle: debe ser nulo mientras la sesión está
`in_progress` y obligatorio al completar o cancelar. El SQL contractual completo y ejecutable vive en
`apps/frontend/mobile/src/lib/db/mobile-v2-schema-contract.ts`; M0 lo prueba con SQLite real, pero no
lo registra todavía en las migraciones runtime.

Todas las tablas v2 se crean como `STRICT`. Esto impide que la afinidad dinámica de SQLite acepte, por
ejemplo, índices o repeticiones fraccionarias, texto en columnas enteras o texto no numérico como peso.
Los `CHECK` siguen expresando rangos, enums, booleanos y lifecycle una vez validado el tipo.

Las foreign keys se habilitan por defecto en cada conexión nativa con
`SQLITE_DEFAULT_FOREIGN_KEYS=1` mediante el config plugin de Expo SQLite para Android e iOS. El adapter
activa también `PRAGMA foreign_keys = ON` en la conexión principal y verifica de forma fail-closed el
valor dentro de cada transacción exclusiva. Esto es necesario porque Expo SQLite 16 abre una conexión
nueva para `withExclusiveTransactionAsync`.

Una sesión `completed` materializa por slot el resultado compatible actual
(`result/amrapReps/rpe/setLogs`) y deja que `computeGenericProgram` decida la progresión. Los logs no
infieren nuevas reglas. Cancelar conserva la sesión y sus logs con estado `cancelled`; borrar requiere
otra acción explícita.

El contrato remoto objetivo será:

- `PUT /api/workout-sessions/{sessionId}` para crear o actualizar idempotentemente la cabecera;
- `PUT /api/workout-sessions/{sessionId}/sets/{setId}` para upsert idempotente;
- `DELETE /api/workout-sessions/{sessionId}/sets/{setId}` para aplicar el tombstone;
- `POST /api/workout-sessions/{sessionId}/complete` para validar y materializar resultados;
- `GET /api/workout-sessions?programInstanceId=...` para reconstrucción/historial incremental.

El servidor comprueba ownership de la instancia y que `workout_index`/`slot_id` existan en el snapshot
de definición usado por esa instancia. Completar dos veces con la misma clave devuelve el mismo estado.

## Alternativas consideradas

- Mantener solo arrays `setLogs`: compatible y simple, pero no identifica sets ante reordenación,
  reintento o borrado offline.
- Una fila por workout sin cabecera de sesión: registra sets, pero no modela duración, notas ni
  lifecycle.
- Usar índices de set como identidad: falla cuando se inserta o elimina un set y puede sobrescribir
  otro durante sync.
- Guardar lb o la unidad visible: introduce drift al cambiar preferencias.

## Consecuencias

- M3 añade migraciones append-only y repositorios; M0 no crea estas tablas.
- La finalización requiere una transacción local: estado de sesión, resultados derivados y outbox.
- El API necesita idempotencia por IDs de cliente y autorización a nivel de recurso.
- La edición histórica conserva IDs y genera nuevas mutaciones; nunca renumera identidades.
- La compatibilidad con clientes v1 se mantiene materializando `workout_results` y `setLogs`.
