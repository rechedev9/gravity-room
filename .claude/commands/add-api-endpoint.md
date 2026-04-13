---
name: add-api-endpoint
description: Workflow command scaffold for add-api-endpoint in gravity-room.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-api-endpoint

Use this workflow when working on **add-api-endpoint** in `gravity-room`.

## Goal

Implements a new API endpoint, including route, service, and test files.

## Common Files

- `apps/api/src/routes/*.ts`
- `apps/api/src/services/*.ts`
- `apps/api/src/services/*.test.ts`
- `apps/api/src/create-app.ts`
- `log.md`
- `plan.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or edit route handler in apps/api/src/routes/*.ts
- Add or edit service logic in apps/api/src/services/*.ts
- Add or edit tests in apps/api/src/services/*.test.ts
- Update app bootstrap or registration in apps/api/src/create-app.ts
- Update documentation or planning files (log.md, plan.md)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.