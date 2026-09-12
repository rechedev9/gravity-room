# Mobile quality gates

Run `pnpm --filter mobile lint` while editing Expo source. Root `pnpm run lint`
includes this command, so the existing pre-commit hook covers mobile too.
Frontend CI runs the same gate plus `pnpm run test:mobile:lint`, which tests the
actual ESLint configuration with accepted and rejected code fixtures.

## Boundaries for agent changes

- `src/app` composes routes; `src/shell` composes authenticated lifecycle and
  providers; `src/features` owns screen behavior; `src/ui` owns visual controls.
- `src/lib` owns reusable services, storage and controllers. Its static imports
  and re-exports must not depend on routes, screens, shell providers or UI.
  Inject callbacks or move a shared contract downward instead.
- Mobile can consume `@gzclp/domain` and `@gzclp/api-client`. It must not import
  server/database implementations or the web app's implementation modules.
- Do not use dynamic imports to evade a static import boundary. Native adapters
  and pure controllers should retain explicit dependency direction.

## Deliberate tooling exceptions

Metro requires literal `require()` for bundled WebP assets. That exception does
not permit loading arbitrary implementation modules with `require()`.
Jest test files permit mock-factory `require()`, type assertions and documented
negative type fixtures. Explicit `any` and `@ts-ignore` remain errors in tests.
Integration tests may compose libraries with real mobile shell providers;
cross-app static imports remain forbidden.
Unused callback arguments may start with `_`; unused local bindings still fail.

Generated native projects, Expo metadata and distribution outputs are ignored.
Both TypeScript and JavaScript source tests are linted. No dependencies or
generated API contracts need to change when adding a lint rule.

Related ownership guides: [storage](mobile-storage.md), [sync](mobile-sync.md),
and [rest timer](mobile-rest-timer.md).

For real SQLite regression fixtures, use the [shared test adapter](mobile-sqlite-tests.md).

For URL construction and identifier handling, follow the [request boundaries](mobile-network.md).
