# GZCLP Tracker

A workout tracker for the [GZCLP](https://saynotobroscience.com/gzclp-infographic/) linear progression program. Built with Bun, Vite + React 19, and ElysiaJS.

## Stack

- **Frontend:** Vite + React 19, react-router-dom v7, Tailwind CSS 4, TanStack Query
- **Backend:** ElysiaJS, PostgreSQL, Redis, JWT auth
- **Shared:** Pure computation package (`@gzclp/shared`) used by both web and API
- **Runtime:** Bun

For rationale on every tool choice, see [docs/tech-stack.md](docs/tech-stack.md).

## Monorepo structure

```
apps/
  web/    ← Vite + React SPA
  api/    ← ElysiaJS backend
packages/
  shared/ ← Engine, types, schemas (no DOM/React deps)
```

## Getting started

```bash
bun install
bun run dev
```

The web app runs on `http://localhost:5173` and the API on `http://localhost:3001`.

## Commands

| Task       | Command             |
| ---------- | ------------------- |
| Dev (all)  | `bun run dev`       |
| Build      | `bun run build`     |
| Type check | `bun run typecheck` |
| Lint       | `bun run lint`      |
| Tests      | `bun run test`      |
| E2E tests  | `bun run e2e`       |
| Local CI   | `bun run ci`        |

## Environment variables

Copy `apps/api/.env.example` to `apps/api/.env` and fill in the values (PostgreSQL, Redis, JWT secrets).

The web app requires `VITE_API_URL` at build time for production deployments.
