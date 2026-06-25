# Health audit - 2026-06-25

Tracking folder for a multi-workstream review kicked off because the GitHub → VPS deploy flow
has been repeatedly painful. Each workstream maintains its own progress file here.

## Workstreams

| #   | Workstream                                        | Owner      | File                                                 | Status                                 |
| --- | ------------------------------------------------- | ---------- | ---------------------------------------------------- | -------------------------------------- |
| 1   | Deploy flow (GitHub → VPS) review + optimizations | main agent | [`01-deploy-flow.md`](./01-deploy-flow.md)           | 🔄 in progress                         |
| 2   | Recurring CI failures: analyze + fix              | subagent A | [`02-ci-failures.md`](./02-ci-failures.md)           | ✅ fixes applied (some proposals open) |
| 3   | UI / design E2E review (report-only)              | subagent B | [`03-ui-design-review.md`](./03-ui-design-review.md) | ⏳ queued                              |

## Context snapshot

- Local stack is up: API `:3001`, web `:5173` (dev). Postgres 16 on `:5432` (db `gravity_room`).
- A push of `main` (commits `d10decc` dev-login fix + docs, `0a7557a` VPS access docs) is in flight;
  it triggers the production deploy (`.github/workflows/deploy.yml`).
- Known local pain point already observed this session: the **pre-push `build` hook** runs the full
  prod build + Playwright prerender + headless Chromium, which is flaky on Windows (port 4173 already
  in use, Chromium launch timeout). Cleaning orphaned processes unblocked it. This is workstream 1+2 material.

## How to read this

Each file is append-mostly: newest status at the top of its "Log" section. Findings that turn into
changes link the commit/file. Anything still open is listed under "Open items" at the end of each file.
