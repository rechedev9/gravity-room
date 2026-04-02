# Todo

## Security / Correctness (from antirez)

- [ ] **`importProgram` — add Zod validation on user-supplied JSON**
      `apps/web/src/hooks/use-program.ts:610` — `JSON.parse(json)` result is forwarded to the API with no schema check. A malformed export file silently fails or sends garbage to the server.

- [ ] **`strconv.Atoi` accepts `+N` workoutIndex** — `+1` passes parsing and reaches the service layer with no handler-level rejection. Either document it as valid or add an explicit guard after the `workoutIndex < 0` check.
      `apps/go-api/internal/handler/results.go:73`

- [ ] **Auth context session restore — missing `isMounted` guard**
      `apps/web/src/contexts/auth-context.tsx:68-95` — `setUser()` fires after component unmount if the API resolves late. Add an `isMounted` ref and check before calling setters.

- [ ] **Debounced AMRAP/RPE mutations fire after unmount**
      `apps/web/src/hooks/use-program.ts:515-525` — `setTimeout` callbacks call `.mutate()` on an unmounted component. Clear timers in the `useEffect` cleanup.

- [ ] **JWKS cache — non-atomic fetch/check/update**
      `apps/go-api/internal/googleauth/googleauth.go:64-67` — three separate mutex sections allow a race between fetch and store. Collapse into one locked critical section or use a `sync.Once`-style pattern per key ID.

- [ ] **No `AbortController` on fetches — requests outlive navigation**
      `apps/web/src/lib/api-functions.ts:95` — all requests use a timeout-only signal. Pass an external `AbortSignal` so in-flight requests cancel on route change.

## Observability

- [ ] **Token revocation errors silently swallowed**
      `apps/go-api/internal/handler/auth.go:341` — `_ = service.RevokeToken()`. At minimum log a warning; ideally return a 500 if revocation fails.

- [ ] **Rate limiter fail-open on Redis down**
      `apps/go-api/internal/ratelimit/redis.go:54-57` — Redis unavailability bypasses all rate limits. Add a metric/alert so ops knows when the limiter is degraded.

## Tests still to commit

- [ ] Commit the two untracked antirez test files:

  ```bash
  scripts/committer "test(security): add fuzz and stress tests for auth and handler" \
    apps/go-api/internal/handler/fuzz_test.go \
    apps/go-api/internal/middleware/auth_stress_test.go
  ```

- [ ] Push unpushed commit (`31f1f8c`) once ready:
  ```bash
  git push
  ```
