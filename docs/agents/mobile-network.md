# Mobile request boundaries

Identifiers interpolated into API paths must pass through
`src/lib/network/api-path-identifier.ts`. Encode each identifier separately,
keeping route separators literal. This applies to direct tracker reads,
authorized catalog reads and queued mutation compilation. Do not encode entire
routes, trim valid IDs, or decode percent-encoded input before encoding it.

Empty/blank values, isolated Unicode surrogates and dot segments cannot form
valid identifier paths. Direct calls fail before transport. The outbox compiler
maps these failures to `InvalidQueuedMutationError`, retaining the intent as a
permanent diagnostic rather than retrying an unintended endpoint. Body-only
fields remain under API/domain validation; this helper owns URL representation,
not training rules or identifier formats such as UUIDs.

`program-request-paths.test.js` exercises actual service entry points and checks
which paths reach each transport. The pure helper tests verify final URL parsing
as well as encoding, since URL constructors normalize `.` and `..` segments.
Existing auth, cancellation, HTTP errors and response schemas remain owned by
their respective service boundaries.
