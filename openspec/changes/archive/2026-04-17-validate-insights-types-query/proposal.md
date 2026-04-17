# Proposal — validate insights `types` query

## Intent

Reject unknown values in the `types` query parameter of `GET /insights` instead of silently returning empty rows. The endpoint must explicitly validate against the closed set of insight types the system produces and respond with `400 Bad Request` when the client sends something else.

## Why

- **Silent failure hides client bugs.** A typo like `?types=freqency` (missing `u`) currently returns `{ data: [] }` with `200 OK` — indistinguishable from "no insights yet". A misbehaving client never learns it is wrong.
- **The valid set is closed.** Insight types are produced by `apps/analytics` from a fixed list (`volume_trend`, `frequency`, `plateau_detection`, `load_recommendation`). Accepting arbitrary strings is API surface we do not use and cannot honor.
- **Consistency with the April 2026 security pass.** Recent work (commits `e57ee4a`, `3d10b03`) tightened input handling on public surfaces. This closes an adjacent gap on a user-facing authenticated endpoint.

## Scope

### In

- `apps/api/src/routes/insights.ts` — validate `types` against a known set; respond `400` with a clear error payload when any value is unknown.
- Share the canonical list of insight types in one place the route can import (no duplication inside the route file).
- New route-level integration test covering the valid / invalid / empty cases.

### Out

- No changes to `apps/analytics` (it already writes only known types — enforcing input is an API concern).
- No changes to the web clients (`profile-page.tsx`, `home-page.tsx`) — they already send only known types; validation is invisible to them.
- No schema migration. `insight_type varchar(50)` is unchanged.
- No rename or removal of existing insight types.

## Capabilities touched

- `insights` — contract of `GET /insights` query validation.

## Risks

- **Breakage for unknown clients.** If any consumer relies on the current permissive behavior, they start getting `400`. Mitigation: the two internal consumers (web profile + home) both send only known types, and there is no public API documentation promising arbitrary strings. Acceptable.
- **List drift.** If someone adds a new insight type in `apps/analytics` without updating the shared list, the API would 400 on the new type. Mitigation: the shared list lives next to the analytics service contract, not in the route; the design phase pins the exact location.

## Success criteria

1. `GET /insights?types=volume_trend,frequency` → `200` with filtered rows (unchanged).
2. `GET /insights?types=bogus` → `400` with a payload naming the offending value and listing valid types.
3. `GET /insights` (no filter) → `200` with all rows (unchanged).
4. Route-level integration test covers all three cases and passes on a clean CI run.
