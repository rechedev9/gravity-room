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
- Mobile can consume `@gzclp/domain`, `@gzclp/api-client` and `@gzclp/design-tokens`.
  It must not import server/database implementations or the web app's implementation
  modules. A rule that web also needs (reducers, completion, units, request paths,
  colors) moves into one of those packages instead of being copied; see "Sharing
  rules" in `CLAUDE.md`.
- Do not use dynamic imports to evade a static import boundary. Native adapters
  and pure controllers should retain explicit dependency direction.

## Deliberate tooling exceptions

Mobile bundles no raster image assets in JavaScript; program covers are drawn with
`react-native-svg` from design tokens, so `require()` is rejected everywhere. The
only PNGs are the app icon and splash under `assets/`, referenced from `app.json`.
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

For generating the native project and building debug or release APKs, follow
[mobile builds](mobile-build.md).

## Device preferences and permissions

Language and rest alert choices are device settings, not account data. They live in
`src/lib/settings/device-setting-storage.ts` (SecureStore) and are applied by
`PreferencesProvider` before the first screen renders. `system` follows the device
language and falls back to English; program and exercise names keep the language the
server stores them in. Never request the notification permission while a set is being
logged: only `useRestAlerts` may open the system dialog, and only from an explicit tap on
the workout invitation or the More switch, after the in-app rationale. The exercise
library is online only (TanStack Query over `GET /exercises` and `/muscle-groups`) and
does not touch the SQLite schema.
