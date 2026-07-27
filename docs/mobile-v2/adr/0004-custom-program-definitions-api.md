# ADR 0004: API de definiciones personalizadas con snapshots inmutables

- Estado: aceptado como contrato objetivo
- Fecha: 2026-07-27
- Alcance de implementación: contrato compartido temprano y M6

## Contexto

La tabla `program_definitions` ya guarda JSON y ownership, pero no tiene rutas públicas de usuario. La
creación actual de instancias parte del catálogo; import no debe convertirse en un atajo. Además,
editar una definición usada no puede cambiar silenciosamente workouts históricos.

## Decisión

Se expondrá un recurso autenticado `/api/program-definitions`. El body de definición se valida
exclusivamente con `ProgramDefinitionSchema`, exige `source: 'custom'` y no acepta campos de ownership,
status o timestamps proporcionados por el cliente.

Operaciones:

- `POST /api/program-definitions` crea un draft con `Idempotency-Key` obligatorio y devuelve `201`.
- `GET /api/program-definitions` lista solo definiciones activas del usuario, paginadas.
- `GET /api/program-definitions/{id}` devuelve solo una definición propia no eliminada.
- `PUT /api/program-definitions/{id}` reemplaza el draft completo y exige `If-Match` con su revisión.
- `DELETE /api/program-definitions/{id}` hace soft delete; no borra snapshots de instancias.
- `POST /api/program-definitions/{id}/duplicate` crea identidad nueva e idempotente.
- `POST /api/program-definitions/{id}/instances` crea una instancia desde una revisión concreta y
  configuración validada.

La respuesta tendrá `id`, `definition`, `revision`, `status`, `createdAt`, `updatedAt` y `deletedAt`.
`revision` es un token opaco del servidor; no un timestamp de dispositivo. `409` representa una
idempotency key reutilizada con otro payload y `412` una revisión obsoleta.

Al instanciar, el servidor copia la definición validada a `program_instances.custom_definition` y
guarda `definition_id`. Resultados e historial usan ese snapshot inmutable. Editar el draft incrementa
la revisión para instancias futuras; no muta instancias existentes. Duplicar una definición genera
nuevo UUID, `definition.id` nuevo y trazabilidad `derivedFromDefinitionId` en metadata de servidor.

La aprobación para catálogo sigue siendo otro workflow. Un usuario puede ejecutar su propio draft sin
publicarlo; `approved` solo controla visibilidad/promoción pública. Todas las rutas comprueban
`user_id`, `deleted_at` y `users.deleted_at`.

Los esquemas request/response vivirán en `@gzclp/domain` si son negocio compartido y el transporte
autenticado/parser en `@gzclp/api-client`. Cualquier cambio de ruta regenerará el cliente web.

## Alternativas consideradas

- Usar `/programs/import`: mezcla restauración de backup con autoría y no ofrece revisión/idempotencia.
- Mutar `custom_definition` de todas las instancias: rompe reproducibilidad histórica.
- Publicar cada rutina en el catálogo: confunde uso privado con moderación.
- PATCH JSON libre: permite estados parciales difíciles de validar; el editor puede enviar el
  documento completo bajo control de revisión.
- IDs elegidos por el cliente como PK del draft: facilitan offline create, pero amplían la superficie
  de colisiones. La idempotency key conserva el reintento seguro con ID de servidor.

## Consecuencias

- Crear/duplicar sigue online-only hasta que estas rutas existan.
- M6 debe añadir constraints/índices para idempotencia y revisión mediante migración de servidor.
- `template_id` no puede seguir siendo conceptualmente obligatorio para una instancia custom; el
  cambio de schema y la resolución preset/custom se diseñarán juntos.
- API, web y mobile compartirán validación y pruebas de ownership, soft delete, revisiones y retries.
- M0 documenta el contrato, pero no cambia DB ni rutas.
