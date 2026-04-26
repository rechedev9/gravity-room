# Pre-Merge Validation CI + Squash-Merge Flow

## TL;DR

> **Summary**: Introduce a `validate.yml` GitHub Actions workflow that runs typecheck/lint/format/tests/build for web, api, and analytics in parallel on every PR to `main` and feature-branch push, gate the existing deploy on it via `workflow_run`, and document the exact `gh` commands to enforce squash-merge + branch protection on `main`.
> **Estimated Effort**: Medium

## Context

### Original Request

Move from "push to main → deploy" to a proper PR flow: validate code BEFORE it reaches `main`, then squash-merge so `main` history stays linear. Configure branch protection + squash-only merge button settings via `gh api` where possible.

### Key Findings (from repo inspection)

- **Existing workflows** in `.github/workflows/`:
  - `ci.yml` — misnamed; it is actually the **Deploy** workflow (`name: Deploy`, triggers on push to `main`, SSHes to VPS, runs `docker compose build && up -d`, performs post-deploy health checks against `:3002/health`, `:8080`, `:8001/health`, sends Telegram notification). Concurrency group `deploy`.
  - `health-check.yml`, `maintenance.yml`, `backup.yml` — unrelated, leave alone.
- **Monorepo** uses **Bun workspaces** (`workspaces: ["apps/*"]`, `bun.lock` at root).
- **Root `package.json`** already exposes the right scripts:
  - `typecheck` (web), `typecheck:api` (api), `lint` (web), `format:check`, `test` (web), `test:api`, `build` (web), and a combined `ci` script.
  - **Gap**: no root script for `apps/api` lint, no script for analytics. CI will call them directly via `bun run --filter` or by `cd apps/analytics`.
- **`apps/web/package.json`**: scripts `typecheck`, `lint` (eslint), `test` (`bun test` with happy-dom preload), `build` (vite), `e2e` (playwright).
- **`apps/api/package.json`**: scripts `typecheck`, `lint` (eslint), `test` (`bun test` over selected dirs — unit-ish, no DB), `test:e2e` (DB-backed, separate).
- **`apps/analytics/`**: Python 3.12, `requirements.txt` (fastapi, numpy, scikit-learn, scipy, pydantic). **No `pyproject.toml`, no ruff config, no test runner config**. `tests/` dir exists with `test_*.py` files using pytest conventions (but pytest is not in `requirements.txt` — it must be installed in CI as a dev extra).
- **E2E (Playwright)**: `apps/web/playwright.config.ts` boots `bun run build:web && bun src/index.ts` from `apps/api`. The API needs **Postgres + Redis** (drizzle-orm, postgres, ioredis) and seeded data — the existing `e2e/helpers/seed.ts` confirms this. Running E2E in PR CI requires standing up the docker-compose stack or services blocks. **Decision needed (see Decisions).**
- **Lefthook** already runs typecheck/lint/format on pre-commit and test+build+api-types-drift on pre-push — local protection exists, CI will mirror it server-side.
- **Commit history** confirms **conventional commits** are already in use (`feat:`, `perf:`, `docs:`, `chore:`).
- No `.weave/` directory exists yet — created by this plan.

### Decisions the User Must Make Before Execution

1. **Workflow filename**: existing `ci.yml` is actually deploy. Options:
   - (a) Add new `validate.yml` and leave deploy as `ci.yml` (zero-risk, lowest churn). **Recommended.**
   - (b) Rename `ci.yml` → `deploy.yml` and create new `ci.yml` for validation. Cleaner naming but requires updating any branch-protection rules already pointing at the old workflow name and any external references.
     This plan assumes **(a)**. Flip step 1 if you want (b).
2. **E2E in PR CI**: Playwright needs API + Postgres + Redis. Options:
   - (a) **Skip E2E in PR CI**, keep relying on pre-push lefthook + manual runs. **Recommended for v1** — keeps PR CI <5 min.
   - (b) Add a separate `e2e` job using GitHub `services:` for postgres+redis, run a smoke subset (e.g. `landing-page.spec.ts` only). Slower (~8–12 min) and can be flaky.
   - (c) Full E2E suite — too heavy for PR feedback.
     This plan implements **(a)** with **(b) scaffolded behind a commented-out job** so it can be enabled later in one diff.
3. **Allow rebase merging**: spec says "OFF (or user choice)". Plan disables it (squash-only) for the cleanest history; flip the `gh api` call in step 8 if you want it on.
4. **Optional PR-title lint** (`amannn/action-semantic-pull-request`): plan includes it as an optional step 9, disabled by default. Enable by un-commenting.

## Objectives

### Core Objective

Every change reaches `main` only after automated validation passes; merges to `main` are squash-only and trigger deploy.

### Deliverables

- [ ] `.github/workflows/validate.yml` with parallel jobs: `web`, `api`, `analytics` (+ optional `e2e` scaffold).
- [ ] `.github/workflows/ci.yml` (deploy) gated on validate success via `workflow_run` (or equivalent), preserving current deploy behavior.
- [ ] `apps/analytics/requirements-dev.txt` (or equivalent) adding `pytest`, `ruff` so analytics CI has tooling.
- [ ] `.weave/plans/pre-merge-validation-and-squash-merge.md` (this file).
- [ ] Documented `gh` commands for branch protection + squash-merge config (in this plan, ready to paste).

### Definition of Done

- [ ] Opening a PR against `main` triggers `validate.yml`; all 3 (or 4) jobs run in parallel and pass on a clean branch.
- [ ] `main` cannot be pushed to directly (verified by attempting `git push origin main` → rejected).
- [ ] PR cannot be merged unless `validate / web`, `validate / api`, `validate / analytics` checks are green.
- [ ] Merge button shows **only** "Squash and merge".
- [ ] After squash-merge, `ci.yml` (deploy) runs exactly once and deploy still succeeds with the post-deploy health checks unchanged.
- [ ] Branch is auto-deleted after merge.

### Guardrails (Must NOT)

- Do NOT modify `Dockerfile.api`, `apps/web/Dockerfile`, `apps/analytics/Dockerfile`, `docker-compose.yml`, or any deploy script (`scripts/deploy-log.sh`, etc.).
- Do NOT change the SSH/Telegram steps in `ci.yml` — only its trigger and an optional `needs` gate.
- Do NOT enable E2E-by-default in PR CI (decision 2 above).
- Do NOT alter `lefthook.yml` in this plan (out of scope, see step 11).
- Do NOT touch `health-check.yml`, `maintenance.yml`, `backup.yml`.

## TODOs

- [x] 1. Create `.weave/plans/` directory and confirm plan file in place
     **What**: Ensure the plan file (this document) is committed under `.weave/plans/`. No code change beyond this file.
     **Files**: `.weave/plans/pre-merge-validation-and-squash-merge.md`
     **Acceptance**: `git status` shows the file; `cat` confirms structure.

- [x] 2. Add `apps/analytics/requirements-dev.txt` with pytest + ruff
     **What**: Create dev-only deps file so CI can `pip install -r requirements.txt -r requirements-dev.txt` without bloating the production image.
     Contents:

  ```
  pytest==8.3.4
  pytest-asyncio==0.24.0
  ruff==0.8.4
  ```

  (Pin minor versions; bump later as needed. `pytest-asyncio` included because FastAPI tests often need it — verify in step 5; drop if `tests/` does not use async fixtures.)
  **Files**: `apps/analytics/requirements-dev.txt` (new)
  **Acceptance**: `pip install -r apps/analytics/requirements-dev.txt` succeeds locally in a venv.

- [x] 3. Add minimal ruff config to analytics
     **What**: Create `apps/analytics/ruff.toml` (or append to a new `pyproject.toml`) with conservative defaults so CI lint does not explode on existing code.
     Suggested:

  ```toml
  line-length = 100
  target-version = "py312"
  [lint]
  select = ["E", "F", "W", "I"]
  ignore = ["E501"]  # don't fight existing long lines on first run
  ```

  **Files**: `apps/analytics/ruff.toml` (new)
  **Acceptance**: `cd apps/analytics && ruff check .` exits 0 (or only with pre-existing issues that are ignored).

- [x] 4. Smoke-run analytics tests locally to confirm pytest works
     **What**: Verify the existing `tests/` directory runs under pytest with current code. Adjust step 5 if collection fails.
     **Acceptance**: `cd apps/analytics && pytest -q` either passes or fails with real test output (not collection errors). Record any baseline failures so CI does not block on pre-existing breakage — fix in a separate PR if needed.

- [x] 5. Create `.github/workflows/validate.yml` — header + triggers + concurrency
     **What**: Workflow scaffold:

  ```yaml
  name: Validate

  on:
    pull_request:
      branches: [main]
    push:
      branches-ignore: [main] # feature branches; main is handled by deploy

  concurrency:
    group: validate-${{ github.ref }}
    cancel-in-progress: true

  jobs:
    # filled in by subsequent steps
  ```

  **Files**: `.github/workflows/validate.yml` (new)
  **Acceptance**: YAML is valid (`gh workflow view validate.yml` after push, or `actionlint`).

- [x] 6. Add `web` job to `validate.yml`
     **What**: Job that runs on `ubuntu-latest`, checks out, sets up Bun, restores `~/.bun/install/cache` keyed on `bun.lock`, installs at the repo root (`bun install --frozen-lockfile`), then runs the web pipeline.
     Steps in order:
  1. `actions/checkout@v4`
  1. `oven-sh/setup-bun@v2` with `bun-version: latest` (or pinned — check `package.json` for any bun version pin; none found so latest is fine).
  1. Cache step: `actions/cache@v4` with `path: ~/.bun/install/cache`, `key: bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}`.
  1. `bun install --frozen-lockfile`
  1. `bun run --filter web typecheck`
  1. `bun run --filter web lint`
  1. `bun run format:check` (root-level, covers all of `.`)
  1. `bun run --filter web test`
  1. `VITE_API_URL=http://localhost:3001 bun run --filter web build` (mirror lefthook env so build does not fail on missing var)
     **Files**: `.github/workflows/validate.yml`
     **Acceptance**: Job name is `web`; on a known-good commit it passes end-to-end in CI.

- [x] 7. Add `api` job to `validate.yml`
     **What**: Parallel job, same Bun setup + cache. Steps:
  1. checkout, setup-bun, cache, `bun install --frozen-lockfile`
  1. `bun run --filter api typecheck`
  1. `bun run --filter api lint`
  1. `bun run --filter api test` ← unit tests only; `test:e2e` (DB-backed) deliberately excluded.
     Note: `format:check` is already run in the `web` job and covers the whole tree — do NOT duplicate.
     **Files**: `.github/workflows/validate.yml`
     **Acceptance**: Job name is `api`; runs in parallel with `web`.

- [x] 8. Add `analytics` job to `validate.yml`
     **What**: Parallel job using Python:
  1. `actions/checkout@v4`
  1. `actions/setup-python@v5` with `python-version: '3.12'` and `cache: 'pip'`, `cache-dependency-path: apps/analytics/requirements*.txt`
  1. `pip install -r apps/analytics/requirements.txt -r apps/analytics/requirements-dev.txt` (run in `apps/analytics` working-dir)
  1. `ruff check .` (working-dir `apps/analytics`)
  1. `ruff format --check .` (optional; only if step 4 baseline passes — otherwise skip in v1 and add later)
  1. `pytest -q` (working-dir `apps/analytics`)
     Use `defaults.run.working-directory: apps/analytics` at job level to avoid repeating it.
     **Files**: `.github/workflows/validate.yml`
     **Acceptance**: Job name is `analytics`; runs in parallel with `web` and `api`.

- [x] 9. Add commented-out `e2e` job scaffold (decision 2, option b — disabled)
     **What**: Add the job under a YAML comment block with a TODO so it can be enabled later without a research round. Include:
  - `services: postgres: image: postgres:16` and `redis: image: redis:7` with health checks.
  - Bun setup, `bun install`, `bun run --filter api db:migrate`, `bun run --filter api db:seed`, `bunx playwright install --with-deps chromium`, then `bun run --filter web e2e -- e2e/landing-page.spec.ts` (smoke subset).
  - Document required env (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `INTERNAL_SECRET`) — values can be hard-coded for CI.
    Leaving commented prevents accidental enable; an issue/follow-up plan should turn it on.
    **Files**: `.github/workflows/validate.yml`
    **Acceptance**: File parses (comments are inert); a future PR can uncomment to enable.

- [x] 10. Update `.github/workflows/ci.yml` (deploy) to gate on validate
      **What**: Change the trigger from `push: branches: [main]` to `workflow_run`:

  ```yaml
  on:
    workflow_run:
      workflows: ['Validate']
      types: [completed]
      branches: [main]
  ```

  Then add a guard at the top of the `deploy` job:

  ```yaml
  if: ${{ github.event.workflow_run.conclusion == 'success' }}
  ```

  Rationale: `workflow_run` fires on `main` only when validate.yml ran (which happens via the PR run). **However** `pull_request` validate runs are tied to the PR ref, not `main`. After squash-merge, GitHub does NOT automatically re-run validate against `main` unless we also trigger validate on `push: branches: [main]`.
  **Therefore**: also add `push: branches: [main]` to `validate.yml`'s `on:` block (revising step 5). The full trigger becomes:

  ```yaml
  on:
    pull_request:
      branches: [main]
    push:
      branches: [main] # so workflow_run can fire deploy
      branches-ignore: [main] # feature branches
  ```

  (Note: `branches` and `branches-ignore` cannot coexist on the same `push` trigger. Use only `push:` without `branches-ignore` and rely on `pull_request` for feature branches; or list explicit feature-branch globs. Simplest: `push: branches: ['**']` and let `pull_request` provide PR validation. Pick one in execution — recommended: `push: branches: ['**']` and accept that feature pushes also run validate, which is desired anyway.)
  **Alternative (simpler)**: instead of `workflow_run`, keep `ci.yml` triggered on `push: branches: [main]` and add a `validate` job inside `ci.yml` that runs first, with `deploy` job declaring `needs: validate`. This duplicates job definitions but is much easier to reason about and avoids `workflow_run`'s cross-workflow gotchas (e.g. it only runs against the default branch, requires success conclusion check, does not appear as a required check on PRs anyway since deploy is post-merge).
  **Recommendation**: use the **alternative** — single `ci.yml` with `validate` + `deploy` jobs, `deploy: needs: [validate-web, validate-api, validate-analytics]`. The PR-side `validate.yml` provides the required checks; `ci.yml` re-runs the same logic on `main` as a belt-and-suspenders gate. Slight duplication is worth the simplicity.
  **Files**: `.github/workflows/ci.yml`, `.github/workflows/validate.yml`
  **Acceptance**: After squash-merge, exactly one deploy workflow runs; if a regression somehow lands on main, the validate jobs in `ci.yml` fail before SSH happens.

- [x] 11. (Optional, default OFF) PR-title semantic check
      **What**: Add a fourth job `pr-title` to `validate.yml` (only on `pull_request` event):

  ```yaml
  pr-title:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            perf
            refactor
            docs
            chore
            test
            build
            ci
  ```

  Repo already follows this convention — enabling it just enforces it. Leave commented in v1 unless user opts in.
  **Files**: `.github/workflows/validate.yml`
  **Acceptance**: PRs with non-conforming titles fail this check; conforming titles pass.

- [x] 12. (Out of scope, note only) Lefthook pre-push test step
      **What**: `lefthook.yml` already runs `bun run test` on pre-push. No change needed for this plan. If we later want to also run `test:api` pre-push, do it in a separate PR — keeping this plan focused.
      **Acceptance**: N/A — informational.

- [ ] 13. Push branch and open PR to validate the workflow file itself
      **What**: Create a feature branch (e.g. `chore/pre-merge-validation`), commit the new files, push, open a PR. The new `validate.yml` will run on the PR — verify all 3 jobs pass before merging.
      **Acceptance**: PR shows green `validate / web`, `validate / api`, `validate / analytics` checks. `ci.yml` does NOT run on the PR (it is push-to-main only).

- [ ] 14. Apply branch protection + merge settings via `gh` (manual, post-merge of step 13)
      **What**: After step 13's PR is merged (using a temporary squash-merge through current settings), run these commands. **User must run these — do not script into CI.**

  Repo: `rechedev9/gravity-room` (confirmed from `ci.yml` Telegram block).

  **a) Repo merge-button settings (squash only, auto-delete branches, PR-title as squash subject):**

  ```bash
  gh api -X PATCH repos/rechedev9/gravity-room \
    -F allow_squash_merge=true \
    -F allow_merge_commit=false \
    -F allow_rebase_merge=false \
    -F delete_branch_on_merge=true \
    -F squash_merge_commit_title=PR_TITLE \
    -F squash_merge_commit_message=PR_BODY
  ```

  **b) Branch protection on `main`** (requires admin token; uses the v3 REST endpoint):

  ```bash
  gh api -X PUT repos/rechedev9/gravity-room/branches/main/protection \
    --input - <<'JSON'
  {
    "required_status_checks": {
      "strict": true,
      "contexts": ["web", "api", "analytics"]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": null,
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "required_linear_history": true,
    "required_conversation_resolution": true
  }
  JSON
  ```

  Notes:
  - Status check `contexts` are the **job names** from `validate.yml` (`web`, `api`, `analytics`). If you renamed jobs, update accordingly. If step 11 (`pr-title`) is enabled, add `"pr-title"` to the array.
  - `required_pull_request_reviews: null` means no review approval required (solo dev). Set to `{"required_approving_review_count": 1}` if/when collaborators join.
  - `enforce_admins: false` lets you bypass in emergencies; flip to `true` for strictness.
  - `required_linear_history: true` is consistent with squash-only.
  - Direct push to `main` is blocked implicitly by `required_pull_request_reviews` not being null OR by status-check requirement; to **also** block pushes that bypass status checks, the above config suffices because GitHub denies pushes that would skip required checks on a protected branch.

  **c) Verify**:

  ```bash
  gh api repos/rechedev9/gravity-room/branches/main/protection | jq '.required_status_checks'
  gh repo view rechedev9/gravity-room --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,deleteBranchOnMerge
  ```

  **Files**: none (GitHub-side config). Document the exact commands above in this plan so the user can paste them.
  **Acceptance**: `git push origin main` from a clean clone is rejected with "protected branch" error; PR merge button only offers "Squash and merge"; squash uses PR title as commit subject.

## Verification

- [ ] **Workflow syntax**: `actionlint .github/workflows/*.yml` (or `gh workflow view validate.yml` after push) reports no errors.
- [ ] **Validate runs on PR**: Open a trivial PR (e.g. README typo). All three required jobs run in parallel and pass within ~5 min.
- [ ] **Validate runs on feature push**: Push to a non-main branch without opening a PR — validate runs (catches drive-by pushes early).
- [ ] **Direct push blocked**: `git checkout main && git commit --allow-empty -m test && git push` → rejected.
- [ ] **Merge button**: Open a PR; only "Squash and merge" appears.
- [ ] **PR title is squash subject**: Merge a PR titled `feat: smoke test pre-merge flow`; verify `git log --oneline -1 origin/main` shows that exact title (no `Merge pull request #N` cruft).
- [ ] **Auto-delete**: After merge, source branch is gone (`git fetch -p` shows it pruned).
- [ ] **Deploy still works**: After squash-merge, `ci.yml` runs once, SSH deploy succeeds, post-deploy health checks pass, Telegram notification arrives.
- [ ] **Deploy gated**: Manually break a test on a branch → PR is red → merge button disabled. Confirms gate.
- [ ] **No regressions in unrelated workflows**: `health-check.yml`, `maintenance.yml`, `backup.yml` run on their own schedules unchanged.

## Rollback Notes

- **If validate.yml is too slow or flaky**: `gh api -X DELETE repos/rechedev9/gravity-room/branches/main/protection` to drop branch protection temporarily; revert the workflow file. Deploy keeps working because step 10's recommended approach keeps `ci.yml` self-contained on `push: main`.
- **If `workflow_run` gating misbehaves** (only relevant if you chose that path instead of the recommended `needs:` approach in step 10): revert `ci.yml` to `on: push: branches: [main]` — no other change required, deploy resumes immediate behavior.
- **If branch protection locks you out**: a repo admin can disable protection in Settings → Branches → Edit → Delete. The `gh api -X DELETE` call above does the same.
- **If squash-merge config is wrong**: the `gh api -X PATCH` call in step 14a is idempotent — re-run with corrected flags.
- **No data migrations, no infra changes**: rollback is purely workflow-file + GitHub-settings level. Zero blast radius on running services.
