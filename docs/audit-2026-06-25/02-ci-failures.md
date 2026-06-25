# 02 - Recurring CI failures: analysis + fixes

Workstream 2 of the 2026-06-25 health audit.
Goal: understand WHY CI fails so often and stop the repetition.

## 1. Summary + headline numbers

Six workflows are active (the brief listed four; `ci.yml` and `security.yml` were missed):
`validate.yml` (Validate), `ci.yml` (CI), `security.yml` (Security), `deploy.yml` (Deploy to VPS),
`claude.yml`, `claude-code-review.yml`.

Sampling the last ~60 runs and root-causing ~20 failures across workflows, the failures cluster into
a small number of RECURRING causes - they are not random, and most are CI-side, not product bugs.

| Workflow             | Recent main-push outcome                             | Dominant failure cause                                                        |
| -------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| Security             | fails on ~every push to main AND the weekly schedule | Gitleaks config never loaded + over-strict dependency audit                   |
| CI (api-types-drift) | intermittent, fails on stale client                  | OpenAPI client drift (committed `generated.ts` out of sync)                   |
| Validate             | intermittent                                         | Same OpenAPI drift, plus shared with Security's classes                       |
| Deploy to VPS        | intermittent                                         | Dockerfile workspace footgun, transient registry 503s, Caddy :443 rebind race |

Headline: the single most frequent red X is the **Security workflow**, which has failed on essentially
every push to `main` for the sampled window because of TWO independent always-on jobs (Gitleaks and
Dependency audit). That one workflow alone accounts for the majority of the "CI is always red" feeling.

The most damaging (because it blocks production) is the **Dockerfile workspace footgun**, which broke
the VPS deploy repeatedly on 2026-06-20 until a hotfix on 2026-06-21.

## 2. Recurring failure patterns

### 2.1 Gitleaks secret scan - repo allowlist is never loaded (TOP recurring failure) - FIXED

- Symptom: `Security` workflow, job `Gitleaks secret scan`, step `Run Gitleaks` exits 1 with
  `leaks found: 6` / `##[error]Process completed with exit code 1`.
- How often: on essentially EVERY push to `main` and on the weekly scheduled run.
  It PASSES on some PRs only because PR events scan just the PR commit range (`base..head`), while
  push/schedule events scan the FULL git history (764 commits) and re-flag long-lived false positives.
- Root cause: the repo has a `.gitleaks.toml` allowlist, but the workflow runs gitleaks in a container
  whose working directory is `/` while it scans the mounted `/repo`, so gitleaks never auto-discovers
  `/repo/.gitleaks.toml`. The `docker run ... gitleaks git /repo` command passed NO `--config`, so the
  allowlist was silently ignored and the default ruleset flagged 6 false positives in history:
  - the public IndexNow key `a3f8e1c97b6d452e8f0a1b2c3d4e5f60` in
    `apps/frontend/web/scripts/seo-config.ts`, `apps/frontend/web/scripts/indexnow-ping.ts`, and the
    served `apps/frontend/web/public/<key>.txt` (public by design, not a credential),
  - a fake JWT test fixture in `apps/backend/api/src/lib/google-auth.test.ts` (the `eyJ...` triple),
  - localStorage key NAMES in `apps/frontend/web/src/features/tracker/shortcuts-storage.ts`,
  - illustrative token-shaped strings in `docs/superpowers/**` planning docs and old monorepo paths.
    The pre-existing allowlist was also too narrow: it only covered the `.txt` key file path and the raw
    key regex - not the two `.ts` files, the test fixture, or the storage-key strings.
- Fix applied:
  - `.github/workflows/security.yml` - the gitleaks `docker run` now passes
    `--config=/repo/.gitleaks.toml` so the allowlist is actually honoured, with a comment explaining the
    container-CWD gotcha.
  - `.gitleaks.toml` - broadened the allowlist: the IndexNow key is allowlisted as a `regex` (so it is
    permitted in every file and historical commit), and `paths` now also cover the auth test fixtures
    (`google-auth.test.ts`, `auth-dev.test.ts`), the tracker storage-key file, and `docs/superpowers/**`.
    Added a header comment documenting that the workflow MUST pass `--config` for this file to take effect.
- Validation: TOML structure + patterns verified; could not run gitleaks locally (no Docker/gitleaks on
  this Windows box), so the end-to-end pass should be confirmed on the next Security run.

### 2.2 Dependency audit - `--audit-level=low` over the whole tree (recurring, weekly) - PROPOSED

- Symptom: `Security` workflow, job `Dependency audit`, step `Audit JS dependencies` exits 1 listing
  N advisories, e.g. the 2026-06-22 scheduled run failed with `12 vulnerabilities (3 high, 5 moderate,
4 low)`.
- How often: reactively, roughly whenever a new advisory is published for ANY dependency in the tree -
  in practice on a near-weekly cadence and on pushes that happen to land after a new advisory drops.
- Root cause: the job runs `bun audit --audit-level=low --ignore=GHSA-h67p-54hq-rp68`. Gating at `low`
  over the ENTIRE workspace tree (including dev-only and client toolchain deps such as `esbuild`,
  `vite`, `launch-editor`, Expo/Metro) means any newly-published low/moderate advisory fails the build,
  even when it cannot affect the production API (which is a Linux container and ships none of those dev
  tools). The single `--ignore=<GHSA>` flag shows the team is already chasing advisories one by one,
  which is unsustainable. The current `package.json` `overrides` block is the mitigation lever, and at
  HEAD `bun audit --audit-level=low` reports "No vulnerabilities found" - so the tree is clean RIGHT NOW,
  but the structural fragility remains and it WILL break again on the next advisory.
- Why not auto-fixed: changing the audit gate is a security-posture decision the owner should ratify,
  not something to weaken unilaterally.
- Proposed fix (pick one, in order of preference):
  1. Keep `bun audit` blocking only at `--audit-level=high` (fail closed on high/critical), and run a
     `low`/`moderate` pass as a non-blocking, informational step (`continue-on-error: true`) so new
     low-severity advisories are visible but do not turn `main` red.
  2. Keep `low` but make the SCHEDULED weekly run the only place it is blocking, and make the per-push
     run gate at `high` - so day-to-day pushes are not held hostage to a fresh low-severity advisory.
  3. Continue mitigating via `overrides` (status quo) - rejected as the primary strategy because it is
     manual, reactive, and already shows signs of strain.
- Files: `.github/workflows/security.yml` (job `dependency-audit`, lines ~123-148).

### 2.3 OpenAPI client drift - committed `generated.ts` out of sync (recurring) - FIXED (content)

- Symptom:
  - `CI` workflow, job `OpenAPI client drift detection`, step `Check for drift` exits 1.
  - `Validate` workflow, job `Validate`, step `API types drift check` exits 1.
    Both print a `git diff` of `apps/frontend/web/src/lib/api/generated.ts`.
- How often: recurring - seen on 2026-06-24 (CI 28128713979, Validate 28128713963) and on
  2026-06-23 PR runs (CI 28023883582, Validate 28023883445).
- Root cause: the committed client was stale relative to the live ElysiaJS OpenAPI surface. The recent
  multi-auth work added `/api/auth/dev/password-user` (and `/api/auth/dev`) and tightened several auth
  body schemas (dropped `.passthrough()` on signup/login/reset/forgot-password), but
  `apps/frontend/web/src/lib/api/generated.ts` was never regenerated and committed. CI regenerates the
  client with the dev-auth routes ENABLED (`AUTH_DEV_ROUTE_ENABLED=true`, `NODE_ENV=test`,
  `AUTH_DEV_ROUTE_SECRET` set in both `ci.yml` and `validate.yml`), so the freshly generated client
  includes those routes and diverges from the committed one.
  Deeper structural cause: whether the dev routes appear in the generated client depends on env flags,
  so a developer who regenerates locally WITHOUT those flags produces a client missing the dev routes,
  commits it, and CI (which DOES set the flags) then fails. The committed artifact and the CI
  regeneration environment must match.
- Fix applied: regenerated the client against the live dev API on `:3001` (which is running HEAD's code,
  with the dev flags on, exposing 36 `/api/*` paths including `/api/auth/dev` and
  `/api/auth/dev/password-user`) via `cd apps/frontend/web && bun run api:types`. The regenerated
  `apps/frontend/web/src/lib/api/generated.ts` now includes both dev routes and the tightened schemas,
  matching what CI generates. Verified `bun run --filter web typecheck`, `lint`, and `prettier --check`
  all pass with the new client.
- Recurrence-prevention (proposed, see Open items): the drift check is correct, but the artifact keeps
  going stale because regeneration is manual and env-sensitive. Options to make it self-healing are in
  Open items.

### 2.4 Dockerfile workspace footgun - new package not COPYed into deps stage (recurring, blocks deploy) - HARDENING PROPOSED

- Symptom: `Build api image` (in `deploy.yml`'s `build-images` AND `validate.yml`'s `docker-build`),
  step `RUN bun install --frozen-lockfile` fails with
  `error: Workspace dependency "@gzclp/api-client" not found` /
  `@gzclp/api-client@workspace:* failed to resolve`.
- How often: broke the VPS deploy repeatedly on 2026-06-20 (deploy 27885367763, 27882319890,
  27882095152, 27880589694) until the 2026-06-21 hotfix
  (`fix(deploy): unbreak VPS deploy — api image missing api-client workspace`). It also failed the
  `docker-build` job in `validate.yml`. This is the exact PR #72/#67 class documented in CLAUDE.md.
- Root cause: `apps/backend/api/Dockerfile` resolves the WHOLE workspace during
  `bun install --frozen-lockfile`, so EVERY workspace member's `package.json` must be `COPY`d into the
  `deps` stage - even members the api image never imports (web, mobile, api-client). The deps stage uses
  a hand-maintained list of six `COPY packages/<x>/package.json` / `COPY apps/<x>/package.json` lines.
  Adding a new workspace member without adding a matching line reintroduces the failure. The list is
  currently complete (api-client was added back on 2026-06-21), so it is NOT broken at HEAD - but it is
  a latent, recurring footgun.
- Current guard: `validate.yml`'s `docker-build` job builds both images on every PR, so the next
  occurrence fails the PR pre-merge instead of the post-merge deploy. That moves the failure earlier but
  does not eliminate it.
- Why not auto-fixed here: a robust fix means replacing the brittle per-package `COPY` list with a
  structural copy of all workspace manifests (e.g. BuildKit `COPY --parents ./packages/*/package.json
./apps/*/*/package.json ./`). That requires bumping the Dockerfile `# syntax` directive to a frontend
  that GA's `--parents` (>= `docker/dockerfile:1.8`) and a real Docker build to validate. This file is
  on the in-flight production deploy path and I was asked not to run heavy/Docker builds, so applying it
  blind is too risky right now. Left as a hardening proposal (see Open items + deploy-flow note).

### 2.5 Mobile Jest crash via `@babel/core@8` (recurring-risk) - ALREADY RESOLVED on main

- Symptom: `Validate` / `Run CI checks`, mobile test run: EVERY Jest suite fails with
  `Test suite failed to run` at `ScriptTransformer._getCacheKey`, root message
  `Starting from Babel 8.0.0, the 'loadPartialConfig' function expects a callback...`; ends with
  `error: script "test:mobile" exited with code 1`.
- How often: seen on a 2026-06-23 PR run (28032077091).
- Root cause: a transitive resolution pulled `@babel/core@8.0.1`, whose `loadPartialConfig` signature
  change is incompatible with Jest 29's `@jest/transform` (which calls it synchronously). This is a
  floating-dependency drift, not a test bug.
- Status: ALREADY FIXED on `main`. `package.json` `overrides` now pins
  `"@babel/core": ">=7.29.1 <8.0.0"` (added in `f204069`, PR #83), and `bun.lock` at HEAD resolves
  `@babel/core@7.29.7` (0 occurrences of `@babel/core@8`). No action needed beyond keeping that override.

### 2.6 Transient registry 503s during image build (infra flakiness) - NOTED

- Symptom: `Build api image` / `Build analytics image` fail with
  `ERROR: failed to parse error response 503: upstream connect error ... connection timeout` during
  buildx (base-image pull or `type=gha` cache access).
- How often: occasional, correlated in time (e.g. validate 28036955285 + deploy 28036955260 both at
  ~15:27 on 2026-06-23) - i.e. a GHCR / gha-cache incident, not a code bug.
- Root cause: transient GitHub registry / Actions cache backend unavailability. `build-push-action` does
  not retry registry pulls.
- Proposed (low priority): treat as infra flake. If it proves frequent, add a retry wrapper around the
  image-build step, or make the `cache-from`/`cache-to type=gha` non-fatal. Not worth special-casing yet.

## 3. Files changed this session

- `.github/workflows/security.yml` - pass `--config=/repo/.gitleaks.toml` to the gitleaks container so
  the repo allowlist is honoured (fixes the top recurring Security failure).
- `.gitleaks.toml` - broadened the allowlist (IndexNow key as a regex; added paths for auth test
  fixtures, the tracker storage-key file, and `docs/superpowers/**`); documented the `--config`
  requirement.
- `apps/frontend/web/src/lib/api/generated.ts` - regenerated against the live API to clear the OpenAPI
  drift (adds `/api/auth/dev` + `/api/auth/dev/password-user`, tightens auth body schemas).

Validation run this session: `bun run --filter web typecheck` (pass), `bun run lint` (web + api +
api-client, all pass), `bunx prettier --check` on all changed files (pass), `bun audit
--audit-level=low` at HEAD (No vulnerabilities found).

## 4. For the deploy-flow owner (deploy.yml notes)

These touch `deploy.yml` / the production Dockerfile / compose, which I was asked NOT to edit:

1. Dockerfile workspace footgun (2.4): replace the hand-maintained per-package `COPY` list in
   `apps/backend/api/Dockerfile` deps stage with a structural copy of all workspace manifests, e.g.
   bump `# syntax=docker/dockerfile:1.8` and use
   `COPY --parents ./package.json ./bun.lock ./packages/*/package.json ./apps/backend/*/package.json ./apps/frontend/*/package.json ./`.
   This makes adding a workspace package never again require a Dockerfile edit. Requires a real Docker
   build to validate `--parents` behaviour before merging. (`validate.yml`'s `docker-build` job already
   exercises this on every PR.)

2. Caddy port-443 rebind race (latest deploy 28128713956): the deploy's `Pull images and restart stack`
   step failed with
   `failed to bind host port 0.0.0.0:443/tcp: address already in use` on the `gravity-room-caddy-1`
   container - the previous Caddy container still held `:443` when `docker compose up -d` tried to start
   the new one. Consider an explicit stop/remove of the old edge container (or `--remove-orphans` +
   ordered recreate, or a `docker compose down` of just the caddy service) before re-binding `:443`,
   so the restart is race-free. This is a recurring-risk on the deploy critical path.

3. Dependency-audit gate (2.2) lives in `security.yml`, not `deploy.yml`, but it gates pushes to `main`
   that also trigger deploys; the proposed `high`-blocking / `low`-informational split (above) would stop
   it turning `main` red on every new low-severity advisory. Flagging for visibility since it affects the
   overall green/red state of `main`.

4. Transient registry 503s (2.6) hit `deploy.yml`'s `build-images` too; consider a retry on the
   image-build step if they recur.

## 5. Open items

- [ ] Confirm the next `Security` run passes Gitleaks now that `--config` is wired up and the allowlist
      is broadened (could not run gitleaks locally - no Docker on this box).
- [ ] Decide on the dependency-audit gate policy (2.2) - recommend `high`-blocking + `low`-informational.
      Owner ratification needed before weakening the gate.
- [ ] Make the OpenAPI client self-healing to stop drift recurring (2.3). Options:
  - generate the client in CI and FAIL with the diff (current behaviour) but ALSO upload the regenerated
    file as an artifact / auto-commit on a bot PR, so the fix is one click; or
  - add a Lefthook/pre-push step that regenerates against a locally-running API (already partially
    covered, but it needs the API up); or
  - document that regeneration MUST be done with `AUTH_DEV_ROUTE_ENABLED=true` so local and CI agree.
- [ ] Harden `apps/backend/api/Dockerfile` to copy workspace manifests structurally (2.4) - handed to
      the deploy-flow owner because it is on the in-flight production path and needs a Docker build to verify.
- [ ] Caddy `:443` rebind race on deploy (handed to deploy-flow owner).

## Log

- 2026-06-25: Enumerated ~60 recent runs across all 6 workflows; root-caused ~20 failures.
  Clustered into the six patterns above. Applied fixes for Gitleaks config/allowlist (2.1) and OpenAPI
  drift (2.3). Confirmed the babel-8 mobile crash (2.5) and the latest dependency-audit set (2.2) are
  already clean at HEAD via existing `overrides`. Documented the Dockerfile footgun (2.4), registry
  503s (2.6), and Caddy :443 race for the deploy-flow owner. Validated edits with typecheck/lint/prettier.
