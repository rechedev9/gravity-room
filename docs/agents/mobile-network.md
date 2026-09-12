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

## Auth response ownership

`auth/session-response.ts` is the pure mobile wire-decoding boundary and owns
`AuthUser`, `SessionState` and `RefreshResponse`. It has no native storage,
network, platform, clock or session-state dependency. Import the types from that
module directly rather than pulling profile consumers through the session
orchestrator. Do not add a barrel re-export to `session.ts`.

The session service still owns credential persistence, refresh coordination,
offline identity ownership, sign-in and sign-out. Its entry points invoke these
same decoders before persistence. Body-token refresh responses require both
string tokens; cookie-session responses expose only access token and user.
Optional missing profile values normalize to null and unknown response fields
are omitted. Existing structural acceptance is preserved; this boundary does
not invent new email, token or user-ID validation rules.

Pure decoder tests cover malformed payloads, normalized optional fields and
credential-free errors. Run the session and auth-provider suites as well when
changing these contracts, because pure parsing cannot prove persistence order.

## API origin and prefix

`network/api-url.ts` owns pure base-URL validation and route composition. Pass
configuration and development mode explicitly. The `session.ts` adapter reads
`EXPO_PUBLIC_API_URL` and `__DEV__` at call time, then delegates through its
existing `buildApiUrl(path)` entry point. No native auth or credential module is
needed to test URL policy. Resolver consumers import the pure module directly.

Production still requires an explicit HTTPS base. Development cleartext remains
limited to localhost, loopback and the Android emulator host; a private LAN IP
is not implicitly trusted. Configured credentials, query strings and fragments
remain invalid. A configured path is the API prefix; otherwise `/api` is used.
Route query strings survive composition, fragments do not, and route inputs
cannot change the configured origin. Identifier callers must still use the
segment encoder before composition. The pure tests supplement the existing
session tests that exercise actual authorized request construction.
