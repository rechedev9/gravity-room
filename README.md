# Gravity Room 🏋️: Pick a program, show up, lift.

[![CI frontend](https://img.shields.io/github/actions/workflow/status/rechedev9/gravity-room/ci-frontend.yml?branch=main&style=flat-square&label=ci%20frontend)](https://github.com/rechedev9/gravity-room/actions/workflows/ci-frontend.yml)
[![CI backend](https://img.shields.io/github/actions/workflow/status/rechedev9/gravity-room/ci-backend.yml?branch=main&style=flat-square&label=ci%20backend)](https://github.com/rechedev9/gravity-room/actions/workflows/ci-backend.yml)
[![CI infra](https://img.shields.io/github/actions/workflow/status/rechedev9/gravity-room/ci-infra.yml?branch=main&style=flat-square&label=ci%20infra)](https://github.com/rechedev9/gravity-room/actions/workflows/ci-infra.yml)
[![License](https://img.shields.io/github/license/rechedev9/gravity-room?style=flat-square)](LICENSE)

Gravity Room is a free strength training app for web and mobile, made for lifters who want a proven program without a spreadsheet. You pick a program, and the app works out the weights, sets and reps for every session. When you complete a session the load goes up. When you fail one, the program adapts. No ads, no card, and the code is open source.

![Gravity Room landing page](docs/assets/gravity-room.webp)

## Use it

- Open [gravityroom.app](https://gravityroom.app).
- Choose **Probar sin cuenta** (try without an account) on the landing page to start in guest mode. Your data stays in the browser until you decide to sign in.
- Or sign in to keep your training in the cloud. Email and password, Google, Apple, GitHub and Microsoft are supported by the API.
- The interface is available in Spanish and English.

## Quick start

Run the whole stack locally from a bash shell. You need Node 24 or newer, pnpm 11.9.0 and a PostgreSQL database. Redis is optional in development. [`.env.example`](.env.example) lists every other variable.

```bash
createdb gravity_room             # an empty Postgres database; adjust the URL below to your credentials
cat > .env <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gravity_room
JWT_SECRET=local-dev-secret-change-in-production-min-32-characters-long-enough
EOF
set -a; source .env; set +a       # the scripts read process.env, not the file
pnpm install
pnpm --filter api db:deploy       # once: migrations and program seeds
pnpm run dev:api                  # API on http://localhost:3001
pnpm run dev                      # web on http://localhost:5173
```

The web app talks to the API at `http://localhost:3001` by default in development. The [`local-dev` skill](.claude/skills/local-dev/SKILL.md) covers Postgres setup on Windows, macOS and Linux, and the dev sign-in route that skips OAuth.

Check your changes before you push:

```bash
pnpm run typecheck && pnpm run lint && pnpm run test
pnpm run test:api
```

## What the app does for the lifter

- **18 programs to choose from.** Strength, hypertrophy and powerlifting plans for beginner to advanced lifters, among them GZCLP, StrongLifts 5x5, Greyskull LP, 5/3/1 Boring But Big, PHUL and the Tenkaichi Budokai powerlifting cycles. The list lives in [`packages/domain/src/catalog.ts`](packages/domain/src/catalog.ts).
- **Your next session is already calculated.** Weights, sets and reps come from the program and your starting loads.
- **Logging that adapts the plan.** Mark a session as done or failed and the next loads update. A preview shows what happens to a lift if you fail it.
- **Progress over time.** Stats, history and insights computed from your logged sessions.
- **Your data stays yours.** Export a program as JSON or CSV, and delete your account from the profile page. Deleted accounts have a 30-day grace period before removal.
- **Exercise guides.** A wiki of exercise articles and head-to-head comparisons on the web.
- **Installable web app.** The site ships as a PWA, and the mobile app is built with Expo.

Guest mode is a web feature. The mobile app needs an account.

## How progression works

Every program is data: days, slots (exercise, sets, reps) and a rule for what happens after a success or a failure. One shared engine, `computeGenericProgram` in [`@gzclp/domain`](packages/domain/src/generic-engine.ts), replays your logged results and returns the prescription for each upcoming workout. Web, mobile and API all import it, so a given program gives the same numbers everywhere.

Rules include adding weight, deloading by a percentage, advancing to the next stage (for example from 5x3 to 6x2), updating a training max and double progression within a rep range. The rule set is defined by the Zod schema in [`program-definition.ts`](packages/domain/src/schemas/program-definition.ts).

Apps never reimplement or adjust this math. The database seeds in [`packages/database/src/seeds/programs`](packages/database/src/seeds/programs) hold the program definitions the engine reads.

## Workspace

pnpm monorepo. Production runs same-origin on a VPS: Caddy serves the Vite SPA from the `web` container and Node runs the Elysia API in the `api` container. A push to `main` deploys both through `.github/workflows/deploy.yml`.

| Path                     | Role                                                                | Run or test                                                         |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/frontend/web`      | React 19 and Vite SPA with TanStack Router and Query, Tailwind, PWA | `pnpm run dev`, `pnpm --filter web test`, `pnpm run e2e`            |
| `apps/frontend/mobile`   | Expo 54 and React Native app with offline SQLite storage            | `pnpm --filter mobile dev`, `pnpm run test:mobile`                  |
| `apps/backend/api`       | ElysiaJS REST API: auth, programs, results, insights, cron jobs     | `pnpm run dev:api`, `pnpm run test:api`                             |
| `packages/domain`        | `@gzclp/domain`: progression engine, program catalog, Zod schemas   | `pnpm run test:domain`                                              |
| `packages/database`      | `@gzclp/database`: Drizzle schema, migrations, seeds                | `pnpm run test:database`, `pnpm run db:generate` after schema edits |
| `packages/api-client`    | `@gzclp/api-client`: shared typed fetch helpers                     | `pnpm run test:api-client`                                          |
| `packages/design-tokens` | `@gzclp/design-tokens`: design tokens and their CSS output          | `pnpm run test:design-tokens`                                       |
| `scripts/`               | Load test, security checks                                          | see `package.json`                                                  |

To run the mobile app on Android, use `pnpm --filter mobile android`.

## Documentation

| File                                                                     | What it covers                                            |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                           | Layout, path map, contracts, validation commands          |
| [`docs/api-and-db.md`](docs/api-and-db.md)                               | Generated API surface and database schema                 |
| [`.env.example`](.env.example)                                           | Every environment variable, with notes                    |
| [`docs/SUPPLY_CHAIN_SECURITY.md`](docs/SUPPLY_CHAIN_SECURITY.md)         | Dependency and secret policy                              |
| [`docs/DATABASE_SECURITY_ROLLOUT.md`](docs/DATABASE_SECURITY_ROLLOUT.md) | Deferred database contracts and row level security risk   |
| [`docs/agents/mobile-quality.md`](docs/agents/mobile-quality.md)         | Mobile quality gates, with storage, sync and timer guides |
| [`CLAUDE.md`](CLAUDE.md)                                                 | Contributor and agent rules for this repo                 |

## License

[AGPL-3.0](LICENSE).
