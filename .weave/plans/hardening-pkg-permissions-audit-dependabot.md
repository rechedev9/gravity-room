# Hardening: Workflow Permissions + Dependency Audits + Dependabot

## TL;DR
> **Summary**: Bundle three security-hardening improvements into one PR — least-privilege `permissions:` blocks on all 5 workflows, `bun audit` + `pip-audit` jobs in `validate.yml` and `ci.yml`, and a `.github/dependabot.yml` for weekly grouped updates across npm/pip/github-actions/docker.
> **Estimated Effort**: Short (single-session, mostly YAML)

## Context

### Original Request
Land three follow-ups from PR #44's Weft/Warp review as a single PR:
1. Add `permissions:` blocks to every workflow (defense-in-depth).
2. Add dependency-audit jobs (`bun audit`, `pip-audit`) that fail PRs on known CVEs.
3. Configure Dependabot for weekly, grouped dependency-update PRs.

### Key Findings (codebase audit)

**Workflows (`.github/workflows/`)** — 5 files, none have a top-level `permissions:` block today:
- `validate.yml` — PR/push validator (web/api/analytics jobs). Pure read: checkout + bun/python + lint/test/build. Needs only `contents: read`.
- `ci.yml` — `Deploy` workflow on push to `main`. Replicates validate-* jobs then `deploy` (SSH via `appleboy/ssh-action@v1`) + Telegram notify. SSH deploy uses repo secrets, never the `GITHUB_TOKEN`. Needs only `contents: read`.
- `health-check.yml` — cron `*/30 * * * *`. Just `curl` + Telegram. No repo access needed → `contents: read` (or even `{}` empty, but `contents: read` is the conventional minimum since `actions/checkout` is sometimes added later).
- `maintenance.yml` — Sunday cron. SSH-only (docker prune, purge script) + Telegram. No checkout, no token use → `contents: read`.
- `backup.yml` — Daily cron. SSH (`pg_dump`) + `scp` + `actions/upload-artifact@v4` + Telegram. `upload-artifact` writes to the run's artifact storage, **not** repo content; it does NOT require `contents: write`. Needs `contents: read` only.

**Why `permissions:` matters** — GitHub's default `GITHUB_TOKEN` permissions on this repo are likely "permissive" (read+write on most scopes). A compromised dependency in a step could exfiltrate the token and push to `main`, create releases, etc. Setting an explicit top-level `permissions: contents: read` shrinks the blast radius to read-only access to repo content. It is a free, mechanical hardening — no functional change.

**Dependency layout for audits**:
- Bun workspace at repo root: `bun.lock` (271 KB, real lockfile present), workspaces = `apps/*`.
- `bun audit` is built into Bun ≥ 1.2 — runs against the workspace, no extra setup beyond `bun install --frozen-lockfile`.
- Python: `apps/analytics/requirements.txt` + `requirements-dev.txt` (4 dev deps: pytest, pytest-asyncio, ruff, httpx). `pip-audit` not currently listed — must add to `requirements-dev.txt`.

**Dockerfiles** (confirmed present):
- `Dockerfile.api` (root)
- `apps/web/Dockerfile`
- `apps/analytics/Dockerfile`

**Dependabot + `bun.lock` — VERIFIED** (web research as of 2025):
- Dependabot does **NOT** natively update `bun.lock`. The `npm` ecosystem will parse `package.json` manifests in the workspace and open PRs that bump version ranges in `package.json`, but `bun.lock` will go stale and CI will fail (`--frozen-lockfile`).
- Tracking issue: `dependabot/dependabot-core#10100` — still open, no ETA.
- **Three viable paths** (user must decide — see Decisions section):
  - **(A) Dependabot npm + manual `bun install` step.** When a Dependabot PR opens, a maintainer pulls the branch locally, runs `bun install`, commits the updated `bun.lock`. Workable but breaks the "auto-merge minor/patch" dream.
  - **(B) Dependabot npm + auto-rebase action.** Add a small workflow that runs on Dependabot PRs, executes `bun install`, and pushes the updated `bun.lock` back to the PR branch. Adds complexity but preserves automation.
  - **(C) Renovate instead of Dependabot for npm.** Renovate has first-class `bun.lock` support since v37+. Use Renovate for npm, keep Dependabot for pip/github-actions/docker — or use Renovate for everything.
- **Recommendation: (B)** for this PR — keeps the "single tool" simplicity the user asked for, and the auto-rebase is ~15 lines of YAML. Document (C) as the escape hatch if (B) proves flaky.

**Conventional commits prefix**: confirmed in use throughout (commit `chore(deps):` matches existing style).

**Repo owner / assignee**: `rechedev9` (from `health-check.yml` REPO var).

## Objectives

### Core Objective
Reduce the security blast radius of CI workflows and establish automated detection of vulnerable / outdated dependencies, without disrupting the existing PR-validation + auto-deploy flow.

### Deliverables
- [ ] Top-level `permissions: contents: read` block added to all 5 workflows in `.github/workflows/`.
- [ ] New `audit-bun` job in `validate.yml` running `bun audit` against the workspace.
- [ ] New `audit-python` job in `validate.yml` running `pip-audit` against `apps/analytics/requirements*.txt`.
- [ ] Mirror jobs `audit-bun` and `audit-python` added to `ci.yml`, gated as `needs:` for the `deploy` job (belt-and-suspenders, matches existing pattern).
- [ ] `pip-audit` added to `apps/analytics/requirements-dev.txt`.
- [ ] `.github/dependabot.yml` created with npm / pip / github-actions / docker ecosystems, weekly Monday schedule, grouped minor+patch updates, `chore(deps):` prefix, assignee `rechedev9`, PR limit 5/ecosystem.
- [ ] (Conditional on Decision D3 = B) `.github/workflows/dependabot-bun-lock.yml` auto-rebases `bun.lock` on Dependabot npm PRs.
- [ ] PR description documents the security rationale and lists the three changes.

### Definition of Done
- [ ] `gh pr create` opens a PR; all `validate.yml` jobs (including the two new audit jobs) pass green.
- [ ] After merge, the next push triggers `ci.yml` and the deploy job's `needs:` includes both audit jobs.
- [ ] Visiting **Insights → Dependency graph → Dependabot** shows configuration loaded (no parse errors).
- [ ] Branch-protection on `main` still blocks merge unless required checks pass (no required-checks settings changed by this PR — out of scope).
- [ ] Verified locally: `gh workflow view validate.yml` shows the new jobs.

### Guardrails (Must NOT)
- Must NOT change deploy logic, secrets, or the SSH script in `ci.yml`.
- Must NOT raise any workflow's permissions above `contents: read` unless a concrete write is identified (none are, per audit above).
- Must NOT add Renovate config in this PR (would conflict with Dependabot on the same ecosystems).
- Must NOT add CONTRIBUTING.md, ARCHITECTURE.md, CODEOWNERS, Prometheus, Recharts→uplot, or E2E activation — separate plans.
- Must NOT modify required status checks in branch protection (separate manual step after audits prove stable).

## Decisions Required Before Execution

| ID | Decision | Recommendation | Why it matters |
|----|----------|----------------|----------------|
| **D1** | Should audit-job failures **block** PRs, or be informational (`continue-on-error: true`) initially? | **Block** (no `continue-on-error`). | Blocking is the security-correct default. If `bun audit` produces false-positive noise day 1, flip to `continue-on-error: true` in a one-line follow-up. Starting permissive trains the team to ignore audit output. |
| **D2** | Audit-jobs in `ci.yml` (post-merge) — gate `deploy` on them, or run alongside but non-blocking? | **Gate `deploy`** (add to `needs:`). | Matches the existing validate-web/api/analytics pattern. A vulnerable dep should not reach prod even if it slipped past the PR check (e.g. force-pushed merge). |
| **D3** | Bun lockfile + Dependabot strategy. | **Path (B)**: Dependabot npm + small auto-rebase workflow that runs `bun install` and pushes `bun.lock` to Dependabot PR branches. | (A) creates manual toil; (C) means adopting a second tool now. (B) is ~15 lines of YAML and keeps Dependabot as the single source of truth. Escape hatch to (C) is documented. |
| **D4** | Group ALL minor+patch into one weekly PR per ecosystem, or group by category (e.g. `dev-dependencies`, `production-dependencies`)? | **Single grouped PR per ecosystem** for minor+patch. Major = individual PRs. | Simpler. We can split later if review-load becomes uneven. |
| **D5** | Should this PR also add `dependency-review-action` (GitHub-native, runs on PRs to flag *newly added* vulnerable deps before merge)? | **Defer** to a follow-up. | Out of the original 3-item scope; useful but adds review surface. Plan notes it as next-step. |

**User: please confirm or override D1–D5 before Tapestry executes.** Defaults above will be used if no override is given.

## TODOs

- [x] 1. **Add top-level `permissions: contents: read` to `validate.yml`**
  **What**: Insert a top-level `permissions:` block immediately after the `concurrency:` block (before `jobs:`).
  **Files**: `.github/workflows/validate.yml`
  **Acceptance**: `grep -n "^permissions:" .github/workflows/validate.yml` returns line ~13; `gh workflow view validate.yml` still parses; existing jobs unchanged.
  **Snippet**:
  ```yaml
  permissions:
    contents: read
  ```

- [x] 2. **Add top-level `permissions: contents: read` to `ci.yml`**
  **What**: Insert top-level `permissions:` block after `concurrency:`. SSH deploy and Telegram both use repo secrets, not `GITHUB_TOKEN` — read is sufficient.
  **Files**: `.github/workflows/ci.yml`
  **Acceptance**: `grep -n "^permissions:" .github/workflows/ci.yml` returns a line before `jobs:`; deploy job logic untouched (diff shows ONLY the new block).

- [x] 3. **Add top-level `permissions: contents: read` to `health-check.yml`**
  **What**: Insert top-level `permissions:` block after the `on:` block.
  **Files**: `.github/workflows/health-check.yml`
  **Acceptance**: `grep -n "^permissions:" .github/workflows/health-check.yml` returns a line; cron schedule unchanged.

- [x] 4. **Add top-level `permissions: contents: read` to `maintenance.yml`**
  **What**: Insert top-level `permissions:` block after `on:`.
  **Files**: `.github/workflows/maintenance.yml`
  **Acceptance**: Block present; SSH steps unchanged.

- [x] 5. **Add top-level `permissions: contents: read` to `backup.yml`**
  **What**: Insert top-level `permissions:` block after `on:`. Note: `actions/upload-artifact@v4` does NOT require `contents: write` — artifact storage is separate from repo content.
  **Files**: `.github/workflows/backup.yml`
  **Acceptance**: Block present; backup workflow next scheduled run uploads artifact successfully (verified post-merge on next 03:00 UTC run, OR via `workflow_dispatch` trigger).

- [x] 6. **Add `pip-audit` to analytics dev requirements**
  **What**: Append `pip-audit==2.7.3` (latest stable as of plan date — Tapestry should bump to current latest if newer) to `apps/analytics/requirements-dev.txt`.
  **Files**: `apps/analytics/requirements-dev.txt`
  **Acceptance**: `pip install -r apps/analytics/requirements-dev.txt` succeeds locally and `pip-audit --version` works.

- [x] 7. **Add `audit-bun` job to `validate.yml`**
  **What**: New job at the bottom of `jobs:` (before the disabled e2e block). Steps: checkout → setup-bun → cache → `bun install --frozen-lockfile` → `bun audit`. Per Decision D1 (blocking by default), do NOT add `continue-on-error: true`.
  **Files**: `.github/workflows/validate.yml`
  **Acceptance**: `gh workflow view validate.yml` lists `audit-bun`; on a PR, the job runs in parallel with `web`/`api`/`analytics` and exits 0 (or fails legitimately if a CVE exists).
  **Snippet**:
  ```yaml
    audit-bun:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v2
          with:
            bun-version: latest
        - uses: actions/cache@v4
          with:
            path: ~/.bun/install/cache
            key: bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}
        - name: Install dependencies
          run: bun install --frozen-lockfile
        - name: Audit
          run: bun audit
  ```

- [x] 8. **Add `audit-python` job to `validate.yml`**
  **What**: New job mirroring the `analytics` job's setup but running `pip-audit` instead of tests. Use `pip-audit -r requirements.txt -r requirements-dev.txt` to audit declared deps (deterministic; doesn't require resolved environment).
  **Files**: `.github/workflows/validate.yml`
  **Acceptance**: Job appears in `gh workflow view validate.yml`; runs in parallel with other jobs.
  **Snippet**:
  ```yaml
    audit-python:
      runs-on: ubuntu-latest
      defaults:
        run:
          working-directory: apps/analytics
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-python@v5
          with:
            python-version: '3.12'
            cache: 'pip'
            cache-dependency-path: apps/analytics/requirements*.txt
        - name: Install pip-audit
          run: pip install pip-audit
        - name: Audit
          run: pip-audit -r requirements.txt -r requirements-dev.txt
  ```

- [x] 9. **Mirror `audit-bun` job into `ci.yml`**
  **What**: Add `audit-bun` job (identical to step 7 but inside `ci.yml`). Per Decision D2, also add `audit-bun` to the `deploy` job's `needs:` list.
  **Files**: `.github/workflows/ci.yml`
  **Acceptance**: `deploy.needs` becomes `[validate-web, validate-api, validate-analytics, audit-bun, audit-python]`; deploy still gates correctly on next push to main.

- [x] 10. **Mirror `audit-python` job into `ci.yml`**
  **What**: Add `audit-python` job (identical to step 8). Add to `deploy.needs:` (combined with step 9 — both jobs added in same edit).
  **Files**: `.github/workflows/ci.yml`
  **Acceptance**: Both audit jobs appear; `deploy.needs:` updated; push to main triggers all 5 validation jobs before deploy.

- [x] 11. **Create `.github/dependabot.yml`**
  **What**: Write the Dependabot config file with 4 ecosystems (npm, pip, github-actions, docker), weekly Monday schedule, grouped minor+patch, `chore(deps):` prefix, assignee `rechedev9`, PR limit 5.
  **Files**: `.github/dependabot.yml` (new)
  **Acceptance**: After PR merge, GitHub UI **Insights → Dependency graph → Dependabot** shows 4 ecosystems with no config errors; first scheduled run produces ≤5 PRs per ecosystem.
  **Full file content**:
  ```yaml
  # Dependabot config — weekly dependency updates with grouped minor+patch.
  # Major updates open as separate PRs for individual review.
  # See: https://docs.github.com/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file
  version: 2
  updates:
    # JavaScript/TypeScript (Bun workspace) — note: Dependabot updates package.json
    # but does NOT update bun.lock. See dependabot-bun-lock.yml workflow for auto-rebase.
    - package-ecosystem: "npm"
      directory: "/"
      schedule:
        interval: "weekly"
        day: "monday"
        time: "06:00"
        timezone: "Europe/Madrid"
      open-pull-requests-limit: 5
      assignees:
        - "rechedev9"
      commit-message:
        prefix: "chore(deps)"
        include: "scope"
      groups:
        npm-minor-patch:
          applies-to: version-updates
          update-types:
            - "minor"
            - "patch"

    # Python (analytics app)
    - package-ecosystem: "pip"
      directory: "/apps/analytics"
      schedule:
        interval: "weekly"
        day: "monday"
        time: "06:00"
        timezone: "Europe/Madrid"
      open-pull-requests-limit: 5
      assignees:
        - "rechedev9"
      commit-message:
        prefix: "chore(deps)"
        include: "scope"
      groups:
        pip-minor-patch:
          applies-to: version-updates
          update-types:
            - "minor"
            - "patch"

    # GitHub Actions versions
    - package-ecosystem: "github-actions"
      directory: "/"
      schedule:
        interval: "weekly"
        day: "monday"
        time: "06:00"
        timezone: "Europe/Madrid"
      open-pull-requests-limit: 5
      assignees:
        - "rechedev9"
      commit-message:
        prefix: "chore(deps)"
        include: "scope"
      groups:
        actions-minor-patch:
          applies-to: version-updates
          update-types:
            - "minor"
            - "patch"

    # Docker base images — three Dockerfiles
    - package-ecosystem: "docker"
      directory: "/"
      schedule:
        interval: "weekly"
        day: "monday"
        time: "06:00"
        timezone: "Europe/Madrid"
      open-pull-requests-limit: 5
      assignees:
        - "rechedev9"
      commit-message:
        prefix: "chore(deps)"
        include: "scope"

    - package-ecosystem: "docker"
      directory: "/apps/web"
      schedule:
        interval: "weekly"
        day: "monday"
        time: "06:00"
        timezone: "Europe/Madrid"
      open-pull-requests-limit: 5
      assignees:
        - "rechedev9"
      commit-message:
        prefix: "chore(deps)"
        include: "scope"

    - package-ecosystem: "docker"
      directory: "/apps/analytics"
      schedule:
        interval: "weekly"
        day: "monday"
        time: "06:00"
        timezone: "Europe/Madrid"
      open-pull-requests-limit: 5
      assignees:
        - "rechedev9"
      commit-message:
        prefix: "chore(deps)"
        include: "scope"
  ```
  **Note**: Dependabot's `docker` ecosystem requires one entry per directory containing a Dockerfile (it does not recursively scan). The root entry covers `Dockerfile.api`; `/apps/web` and `/apps/analytics` cover their respective Dockerfiles.

- [x] 12. **(Conditional on D3=B) Create `dependabot-bun-lock.yml` auto-rebase workflow**
  **What**: New workflow that, on Dependabot npm PRs, runs `bun install` and pushes the updated `bun.lock` to the PR branch. Uses `dependabot/fetch-metadata@v2` to detect ecosystem and skip non-npm Dependabot PRs.
  **Files**: `.github/workflows/dependabot-bun-lock.yml` (new)
  **Acceptance**: When Dependabot opens its first npm PR, this workflow runs, commits an updated `bun.lock`, and the `audit-bun` + `web` + `api` jobs pass green.
  **Permissions note**: This workflow IS the exception that needs `contents: write` and `pull-requests: write` (scoped to the workflow, not the repo).
  **Snippet**:
  ```yaml
  name: Dependabot Bun lockfile sync

  on:
    pull_request:
      branches: [main]

  permissions:
    contents: write
    pull-requests: write

  jobs:
    sync-lockfile:
      if: github.actor == 'dependabot[bot]'
      runs-on: ubuntu-latest
      steps:
        - name: Fetch Dependabot metadata
          id: meta
          uses: dependabot/fetch-metadata@v2
          with:
            github-token: ${{ secrets.GITHUB_TOKEN }}

        - name: Checkout PR branch
          if: steps.meta.outputs.package-ecosystem == 'npm_and_yarn'
          uses: actions/checkout@v4
          with:
            ref: ${{ github.event.pull_request.head.ref }}
            token: ${{ secrets.GITHUB_TOKEN }}

        - uses: oven-sh/setup-bun@v2
          if: steps.meta.outputs.package-ecosystem == 'npm_and_yarn'
          with:
            bun-version: latest

        - name: Update bun.lock
          if: steps.meta.outputs.package-ecosystem == 'npm_and_yarn'
          run: bun install --no-frozen-lockfile

        - name: Commit and push if changed
          if: steps.meta.outputs.package-ecosystem == 'npm_and_yarn'
          run: |
            if git diff --quiet bun.lock; then
              echo "bun.lock unchanged"
              exit 0
            fi
            git config user.name "dependabot[bot]"
            git config user.email "49699333+dependabot[bot]@users.noreply.github.com"
            git add bun.lock
            git commit -m "chore(deps): sync bun.lock"
            git push
  ```
  **If D3=A (manual)**: Skip this step. Add a note to PR description telling reviewers to pull each Dependabot npm PR locally and run `bun install` before merging.
  **If D3=C (Renovate)**: Skip this step AND remove the `npm` block from `dependabot.yml`; create a follow-up plan for Renovate adoption.

- [x] 13. **Verify locally before opening PR**
  **What**: Validate YAML syntax and confirm no jobs are accidentally orphaned.
  **Acceptance**: All commands below pass.
  **Commands**:
  ```powershell
  # YAML syntax check (uses Python — already installed for analytics work)
  python -c "import yaml, glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]; yaml.safe_load(open('.github/dependabot.yml'))"
  # Confirm permissions blocks
  Select-String -Path .github/workflows/*.yml -Pattern '^permissions:'
  # Confirm audit jobs present
  Select-String -Path .github/workflows/validate.yml,.github/workflows/ci.yml -Pattern 'audit-bun|audit-python'
  ```

- [x] 14. **Open PR with security-rationale description**
  **What**: Branch name `chore/hardening-permissions-audit-dependabot`. PR body explains the three changes, links to Decision table, and notes the documented Dependabot+Bun caveat with the chosen mitigation (D3 outcome).
  **Acceptance**: PR opens; `validate.yml` runs all 5 jobs; all green. Tag for review.

## Verification
- [ ] All `validate.yml` jobs (web, api, analytics, audit-bun, audit-python) pass on the PR.
- [ ] No regressions: existing web/api/analytics jobs still green.
- [ ] `gh api repos/rechedev9/gravity-room/contents/.github/dependabot.yml` returns 200 after merge.
- [ ] After merge, push to `main` triggers `ci.yml`; `deploy` job still runs and succeeds (assuming no real CVE in current deps).
- [ ] On the next Monday after merge, Dependabot opens between 0 and 5 PRs per ecosystem (≤20 total). Inspect first batch to confirm grouping works.
- [ ] (If D3=B) First Dependabot npm PR triggers `dependabot-bun-lock.yml` and auto-commits updated `bun.lock`; PR's `audit-bun` job passes.
- [ ] No required-status-check changes were made to branch protection (out of scope).

## Rollback Notes
- **Permissions blocks** are zero-risk to revert: delete the 2-line top-level block per file. No functional behavior depends on them.
- **Audit jobs** producing CVE noise: flip Decision D1 by adding `continue-on-error: true` to each audit step (1 line per job × 4 jobs). Re-evaluate weekly.
- **Dependabot too noisy**: lower `open-pull-requests-limit` (e.g. to `2`) or change `interval` from `weekly` to `monthly`. Worst case, delete `.github/dependabot.yml` — Dependabot stops within minutes.
- **`dependabot-bun-lock.yml` misbehaves**: delete the file. Falls back to Decision D3=A (manual `bun install`). No data loss; Dependabot keeps working for pip/actions/docker.
- **Full revert**: `git revert <merge-commit-sha>` is safe — none of these changes touch application code, secrets, or deploy logic.

## Out of Scope (explicit)
- Performance Phase 6 (Recharts → uplot migration)
- E2E test activation in CI
- Prometheus / Grafana observability
- `CONTRIBUTING.md` / `ARCHITECTURE.md`
- `CODEOWNERS` (the user noted: skip unless trivial — and given the single-maintainer repo, it's not strictly trivial because we'd need to define team semantics. Defer.)
- `dependency-review-action` (Decision D5: defer to follow-up)
- Tightening branch-protection required-checks to include the new audit jobs (manual GitHub UI step; recommend doing this 1–2 weeks after merge once audit-job stability is confirmed)
