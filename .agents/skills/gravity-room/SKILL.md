```markdown
# gravity-room Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development patterns and workflows used in the `gravity-room` TypeScript codebase. It covers coding conventions, database and API workflows, documentation practices, and testing strategies. The repository is organized for backend development without a specific framework, using Playwright for testing and conventional commit messages for version control.

## Coding Conventions

- **File Naming:**  
  Use `snake_case` for file names.
```

// Good
user_service.ts

// Bad
UserService.ts

````

- **Import Style:**
Use relative imports.
```typescript
import { getUser } from './user_service';
````

- **Export Style:**  
  Use named exports.

  ```typescript
  // In user_service.ts
  export function getUser(id: string) { ... }

  // In another file
  import { getUser } from './user_service';
  ```

- **Commit Messages:**  
  Follow [Conventional Commits](https://www.conventionalcommits.org/) with these prefixes:
  - `feat`: New features
  - `fix`: Bug fixes
  - `chore`: Maintenance
  - `docs`: Documentation

  Example:

  ```
  feat: add user authentication endpoint
  ```

## Workflows

### Add Database Table or Schema Migration

**Trigger:** When you need to add or modify a database table/schema.  
**Command:** `/new-table`

1. Edit or add migration SQL files in `apps/api/drizzle/*.sql`.
2. Update the schema definition in `apps/api/src/db/schema.ts`.
3. Update migration metadata in `apps/api/drizzle/meta/_journal.json`.
4. Update the dependency lockfile (`bun.lock`).
5. Update documentation or planning files (`log.md`, `plan.md`).

**Example:**

```sql
-- apps/api/drizzle/20240610_add_users_table.sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);
```

```typescript
// apps/api/src/db/schema.ts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});
```

---

### Add API Endpoint

**Trigger:** When you need to implement a new API endpoint.  
**Command:** `/new-endpoint`

1. Add or edit a route handler in `apps/api/src/routes/*.ts`.
2. Add or edit service logic in `apps/api/src/services/*.ts`.
3. Add or edit tests in `apps/api/src/services/*.test.ts`.
4. Update app bootstrap or registration in `apps/api/src/create-app.ts`.
5. Update documentation or planning files (`log.md`, `plan.md`).

**Example:**

```typescript
// apps/api/src/routes/user_routes.ts
import { getUser } from '../services/user_service';

export function registerUserRoutes(app) {
  app.get('/users/:id', async (req, res) => {
    const user = await getUser(req.params.id);
    res.json(user);
  });
}
```

```typescript
// apps/api/src/services/user_service.ts
export async function getUser(id: string) {
  // ...fetch user from db
}
```

```typescript
// apps/api/src/services/user_service.test.ts
import { getUser } from './user_service';
import { test, expect } from '@playwright/test';

test('getUser returns user by id', async () => {
  const user = await getUser('1');
  expect(user).toBeDefined();
});
```

---

### Update Documentation and Planning

**Trigger:** When you need to document project progress, plans, or verify milestones.  
**Command:** `/update-docs`

1. Edit `log.md` to record progress or verification.
2. Edit `plan.md` to update migration plans or phase status.

**Example:**

```markdown
// log.md

## 2024-06-10

- Added users table migration
- Implemented user API endpoint

// plan.md

### Next Steps

- Add authentication
- Migrate existing data
```

## Testing Patterns

- **Framework:** [Playwright](https://playwright.dev/)
- **Test Files:** Use the pattern `*.test.ts` and place tests alongside service files.
- **Example:**

  ```typescript
  // apps/api/src/services/user_service.test.ts
  import { test, expect } from '@playwright/test';
  import { getUser } from './user_service';

  test('getUser returns user by id', async () => {
    const user = await getUser('1');
    expect(user.name).toBe('Alice');
  });
  ```

## Commands

| Command       | Purpose                                             |
| ------------- | --------------------------------------------------- |
| /new-table    | Start a database table or schema migration workflow |
| /new-endpoint | Begin implementing a new API endpoint               |
| /update-docs  | Update documentation and planning files             |

```

```
