---
name: add-database-table-or-schema-migration
description: Workflow command scaffold for add-database-table-or-schema-migration in gravity-room.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-database-table-or-schema-migration

Use this workflow when working on **add-database-table-or-schema-migration** in `gravity-room`.

## Goal

Adds or modifies a database table/schema, including migration files and schema definitions.

## Common Files

- `apps/api/drizzle/*.sql`
- `apps/api/drizzle/meta/_journal.json`
- `apps/api/src/db/schema.ts`
- `bun.lock`
- `log.md`
- `plan.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or add migration SQL files in apps/api/drizzle/*.sql
- Update schema definition in apps/api/src/db/schema.ts
- Update migration metadata in apps/api/drizzle/meta/_journal.json
- Update dependency lockfile (bun.lock)
- Update documentation or planning files (log.md, plan.md)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.