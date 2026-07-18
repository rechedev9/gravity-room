# Repository guidelines

## Project layout

- `apps/frontend`: web application (`web` workspace package).
- `apps/backend`: API (`api` workspace package).
- `packages/domain`, `packages/database`, and `packages/api-client`: shared logic and data access.
- Use pnpm and the versions declared by the repository; do not substitute package managers.

## Development and verification

- Run focused tests while developing. Add a regression test for bug fixes when practical.
- Before handoff, run `pnpm run ci`, the canonical local gate for hooks, types, lint, formatting, tests, and the production build.
- GitHub's `Validate` check is authoritative. Do not bypass Lefthook with `--no-verify`.
- For user-visible changes, verify the affected flow in a freshly built app. Include desktop/mobile checks and screenshots when relevant.
- AutoReview and source-blind behavior validation are external agent workflows; do not vendor their implementation or generated evidence in this repository.

## Change discipline

- Keep changes scoped and follow existing patterns before introducing new abstractions.
- Ask before adding dependencies or changing repository-wide tooling.
- Summarize the commands run and their results when handing off a change.
