# Supply-chain security policy

## Dependency advisory gate

`pnpm run security:dependencies` audits the **complete frozen install** used to
build and test release artifacts, including runtime, development, test, and build
tooling dependencies. It applies
[`.github/dependency-audit-policy.json`](../.github/dependency-audit-policy.json).
CI blocks every unexcepted **high** or **critical** advisory. Lower severities are
reported so maintainers can schedule upgrades without making CI permanently red.

The checker treats exit status `1` as pnpm's advisory status only when stdout is a
valid audit document containing advisories. Command failures, signals, malformed
JSON, explicit registry errors, and missing/invalid schema fields all fail closed;
they cannot be interpreted as an empty audit. Run
`pnpm run security:dependencies:test` after changing the parser or policy format.

The default and preferred policy has no exceptions. An exception is allowed only
when the advisory cannot be patched immediately and its affected code path has
been shown not to be reachable in Gravity Room. Each entry must contain the exact
numeric advisory ID, a concrete justification, and a near-term `YYYY-MM-DD`
expiry. The checker fails on expired, duplicate, malformed, or no-longer-reported
exceptions, so suppressions cannot become permanent. Broad package-, path-, or
severity-based exceptions are not accepted.

When the gate fails:

1. Inspect the dependency path with `pnpm why <package>`.
2. Upgrade the direct dependency or the narrow root override to the first patched
   release; regenerate `pnpm-lock.yaml` with the pinned pnpm version.
3. Run `pnpm run security:dependencies`, relevant tests, and a frozen install.
4. Use a temporary policy exception only after documenting reachability and an
   owner/removal date in the pull request.

## Immutable CI inputs

Every GitHub Action is referenced by a full commit SHA and every container by an
OCI digest. Version comments are informational. Dependency automation may open
updates, but the reviewed SHA/digest must change in the same pull request; never
replace it with a mutable major version or image tag.

## Secret scanning scope

Gitleaks scans the explicit PR base-to-head range for pull requests and the full
history reachable from `github.sha` for pushes. It does not scan unrelated remote
branches. `.gitleaks.toml` exceptions must pair an exact public/fixture value with
the exact rule that misclassifies it; path allowlists are prohibited because they
can hide unrelated credentials in the same file. Historical one-off findings
belong in `.gitleaksignore` as an exact commit/path/rule/line fingerprint, never as
a directory-wide suppression.

## Production promotion boundary

Repository CI cannot configure GitHub rulesets or Vercel project permissions.
The required external branch/promotion controls and post-deploy route check are
specified in [`VERCEL_CUTOVER.md`](./VERCEL_CUTOVER.md). Production must not rely
on an unprotected direct push to `main`.
