# 05 — CI/CD, supply-chain & observability research

**Date:** 2026-05-11 | **Scope:** `.github/workflows/*`, deploy security, image provenance/SBOM/scanning, observability | **Budget cap:** ≤ €15/mo total

---

## Verified versions / tools (May 2026)

| Tool                                                                | Recommended pin                                                       | Source                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions/checkout`                                                  | v5 (SHA pin)                                                          | [docs](https://docs.github.com/en/actions/reference/security/secure-use)                                                                                                                                                                                                                |
| `docker/setup-buildx-action` / `login-action` / `build-push-action` | v3 / v3 / v6                                                          | already in use                                                                                                                                                                                                                                                                          |
| `actions/attest-build-provenance`                                   | v2 — SLSA, signs via Sigstore/Fulcio                                  | [repo](https://github.com/actions/attest-build-provenance)                                                                                                                                                                                                                              |
| `anchore/sbom-action@v0`                                            | Syft 1.20.0; SPDX + CycloneDX                                         | [marketplace](https://github.com/marketplace/actions/anchore-sbom-action)                                                                                                                                                                                                               |
| `aquasecurity/trivy-action`                                         | **v0.35.0** post-incident SHA (`trivy v0.69.3`, `setup-trivy v0.2.6`) | [Snyk](https://snyk.io/articles/trivy-github-actions-supply-chain-compromise/), [StepSecurity](https://www.stepsecurity.io/blog/trivy-compromised-a-second-time---malicious-v0-69-4-release), [advisory](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23) |
| `google/osv-scanner-action`                                         | v2.3.5 (Mar 2026) — supports `bun.lock` + Python transitive scan      | [releases](https://github.com/google/osv-scanner/releases), [lockfiles](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)                                                                                                                                        |
| `tailscale/github-action`                                           | v4 — OAuth client + ephemeral nodes                                   | [docs](https://tailscale.com/kb/1276/tailscale-github-action)                                                                                                                                                                                                                           |
| `github/codeql-action`                                              | v3 — `javascript-typescript` + `python`, `build-mode: none`           | [docs](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning)                                                                                                                           |
| Sigstore `cosign`                                                   | 2.x keyless via GHA OIDC → Fulcio → Rekor                             | [Sigstore](https://docs.sigstore.dev/cosign/signing/overview/)                                                                                                                                                                                                                          |
| Grafana Cloud Free                                                  | 10k metrics series, 50 GB logs, 50 GB traces, 14d retention, 3 users  | [pricing](https://grafana.com/pricing/)                                                                                                                                                                                                                                                 |
| UptimeRobot Free                                                    | 50 monitors, 5-min interval, 3-mo retention                           | [comparison](https://uptimerobot.com/knowledge-hub/monitoring/11-best-uptime-monitoring-tools-compared/)                                                                                                                                                                                |

---

## Current state (from `.github/workflows/`)

**`deploy.yml`** — matrix builds `api` + `analytics`, pushes `:latest` + `:${SHA}` to ghcr.io, builds web SPA artifact, rsyncs compose+Caddyfile and web `dist/` to VPS via long-lived SSH key, runs pre-deploy env validation against the new image (`deploy.yml:127-135`, calls `apps/backend/api/scripts/check-env.ts`), then `docker compose pull && up -d`, then a 10-retry health-check loop. `concurrency: deploy-prod, cancel-in-progress: false` — correct.

Key line — the long-lived secret:

```yaml
printf '%s\n' "$VPS_SSH_KEY" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -t ed25519 -H "$VPS_HOST" >> ~/.ssh/known_hosts
```

**`validate.yml`** — PR + main push: `bun ci` → `bunx playwright install chromium` → `bun run ci` → env-drift check against `apps/backend/api/.env.production.example`. Uses `actions/checkout@v5` + `oven-sh/setup-bun@v2` by mutable tag.

**`claude.yml`, `claude-code-review.yml`** — `anthropics/claude-code-action@v1` by mutable tag.

**Already good:** concurrency group, pre-deploy env gate (catches PR #67 class of regression), build-cache scoping per matrix, separate runtime secret for metrics token.

**Absent:** action SHA pinning, image signing, provenance, SBOM, vuln scan, Dependabot, rollback pointer, external uptime probe, log shipping, metrics scraping.

---

## Gaps vs official best practice

1. **Mutable action refs everywhere.** OSSF Scorecard + [GitHub well-architected](https://wellarchitected.github.com/library/application-security/recommendations/actions-security/) require 40-char SHA pinning. The March 2026 `aquasecurity/trivy-action` incident — 76 of 77 tags force-pushed to malicious commits exfiltrating CI secrets ([advisory](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23)) — proved tag refs are unsafe.
2. **Long-lived SSH key** with no expiry, no `from=`, no audit trail. Single secret = single exfil pathway.
3. **Images unsigned, unverified at pull.** GHCR does not enforce tag immutability ([community #181783](https://github.com/orgs/community/discussions/181783)).
4. **No SLSA provenance / SBOM** — fails SLSA L2 baseline.
5. **No vuln scanning** of built images, `bun.lock`, or `apps/backend/analytics/requirements.txt`.
6. **No CodeQL** despite GHA hosting being free for public repos.
7. **No Dependabot** — base images and pinned actions will drift.
8. **No external uptime probe.** Blackholed VPS or expired cert is invisible until users complain.
9. **No log shipping.** Docker JSON-file logs on a single host = lost on disk-pressure rotation or host loss.
10. **No rollback pointer** on the VPS. A bad deploy requires re-running the workflow with a hand-typed SHA.

---

## Recommendations

### P0 — must do, ~zero cost, high impact

**P0-1. SHA-pin every `uses:`** with `# vX.Y.Z` trailing comment. Manage upgrades via Dependabot `github-actions`. ([StepSecurity guide](https://www.stepsecurity.io/blog/pinning-github-actions-for-enhanced-security-a-complete-guide))

**P0-2. Replace SSH key with Tailscale SSH + GHA OAuth ephemeral nodes.** Free plan covers us. OAuth client with `devices:write`; runner joins as ephemeral node tagged `tag:ci`; ACL grants `tag:ci → tag:prod-vps:22` only; node deregisters at job end ([Tailscale docs](https://tailscale.com/kb/1276/tailscale-github-action), [secure GH runners](https://tailscale.com/kb/1586/secure-github-runners)). VPS closes port 22 to the public internet.

Vs Option B (step-ca / OIDC SSH certs, [Smallstep](https://smallstep.com/blog/github-actions-oidc-tls-credentials/)): needs a CA host + cert renewal infra — heavier ops, same outcome.
Vs Option C (long-lived key + quarterly rotation + `from=`): still a single shared secret. **Pick A.**

**P0-3. Cosign keyless sign + verify on the VPS** before `docker compose pull` succeeds. Sign each image in build job using GHA OIDC → Fulcio short-lived cert → Rekor transparency log. On the VPS, `cosign verify --certificate-identity-regexp '^https://github.com/<owner>/TrackerRSN/' --certificate-oidc-issuer https://token.actions.githubusercontent.com <image>@<digest>`. From this point pin compose images by `@sha256:<digest>`, making tag mutability irrelevant.

**P0-4. `actions/attest-build-provenance` + `anchore/sbom-action`** for both images. SLSA v1.0 provenance is verifiable via `gh attestation verify` or `cosign verify-attestation`. CycloneDX SBOM uploaded to GH dependency graph. Two extra steps per build, no infra.

**P0-5. Trivy + osv-scanner on PR.** Trivy v0.35.0 SHA-pinned, fail on `HIGH,CRITICAL` with `ignore-unfixed: true` (only fail when a patch is available). `google/osv-scanner-action` reusable workflow scans `bun.lock` + `apps/backend/analytics/requirements.txt` on PR; weekly full scan.

**P0-6. Rollback pointer.** Before `docker compose up -d`, `cp .image_tag .image_tag.prev && echo "$IMAGE_TAG" > .image_tag`. Add a one-line script (`./rollback.sh`) that swaps them back. Saves a full workflow re-run during incidents.

### P1 — should do, still €0

**P1-1. Uptime probes — UptimeRobot Free.** Three monitors: web, `/health`, and `/metrics` with token (catches token-rotation breakage). Webhook → existing Telegram bot ([TELEGRAM_BOT_TOKEN](file:///home/reche/projects/TrackerRSN/.env.example)). 50-monitor headroom is plenty.

**P1-2. Metrics — Grafana Cloud Free.** 10k series + 14d retention covers two backend services + node_exporter + cAdvisor with room to spare ([pricing](https://grafana.com/pricing/)). Install `grafana-alloy` on the VPS — scrapes `/metrics` (bearer), node, cAdvisor metrics; `prometheus.remote_write` to GC. Avoids self-hosting Prometheus on a 4 GB VPS where cAdvisor's default 1s housekeeping interval can spike RAM.

**P1-3. Logs — Loki via Alloy → Grafana Cloud Free.** Same Alloy agent, `loki.write` to GC's logs endpoint, 14d retention. 50 GB/mo is comfortable for our scale.

Fallback (defer): Vector → self-hosted Loki on the VPS + Hetzner Object Storage archive ([Vector loki sink](https://vector.dev/docs/reference/configuration/sinks/loki/)). Only needed if GC quotas tighten.

**P1-4. Dependabot config** at `.github/dependabot.yml`: `github-actions` (weekly, batches SHA bumps), `npm` (`bun.lock` supported ≥ 1.1.39 — [docs](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories)), `pip` for analytics, `docker` for both Dockerfiles. Use 2026 `cooldown` + `groups` options to batch minor/patch into one PR.

**P1-5. CodeQL** matrix for `javascript-typescript` + `python` (both with `build-mode: none`). Free for public repos.

### P2 — nice to have

- **P2-1.** Deploy by `@sha256:<digest>` only, not by `:latest` or `:${SHA}` tag, sidestepping the lack of GHCR registry-level immutability.
- **P2-2.** Do **not** add OpenTelemetry. Sentry already covers errors + perf traces.
- **P2-3.** Grafana Cloud → Telegram alerts: 5xx >1%/5m, disk >80%, cert expiry <14d.

---

## Proposed `deploy.yml` diff (illustrative — do NOT apply directly)

```yaml
permissions:
  contents: read
  packages: write
  id-token: write       # NEW — Sigstore OIDC + attestations
  attestations: write   # NEW — actions/attest-build-provenance

jobs:
  build-images:
    runs-on: ubuntu-latest
    strategy:
      matrix: { include: [ {service: api, dockerfile: apps/backend/api/Dockerfile},
                           {service: analytics, dockerfile: apps/backend/analytics/Dockerfile} ] }
    steps:
      - uses: actions/checkout@<SHA>  # v5
      - uses: docker/setup-buildx-action@<SHA>  # v3
      - uses: docker/login-action@<SHA>  # v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - id: build
        uses: docker/build-push-action@<SHA>  # v6
        with:
          context: .
          file: ${{ matrix.dockerfile }}
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}:${{ github.sha }}
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to:   type=gha,scope=${{ matrix.service }},mode=max

      # NEW — SLSA build provenance, signed via Sigstore keyless
      - uses: actions/attest-build-provenance@<SHA>  # v2
        with:
          subject-name: ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true

      # NEW — CycloneDX SBOM
      - uses: anchore/sbom-action@<SHA>  # v0
        with:
          image: ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}@${{ steps.build.outputs.digest }}
          format: cyclonedx-json

      # NEW — Trivy v0.35.0, fail on fixable HIGH/CRITICAL
      - uses: aquasecurity/trivy-action@<SHA-of-v0.35.0>  # post-incident commit
        with:
          image-ref: ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}@${{ steps.build.outputs.digest }}
          severity: HIGH,CRITICAL
          ignore-unfixed: true
          exit-code: '1'

      # NEW — cosign keyless signature for VPS-side verification gate
      - uses: sigstore/cosign-installer@<SHA>  # v3
      - run: cosign sign --yes ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}@${{ steps.build.outputs.digest }}

  deploy:
    needs: [build-images, build-web]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA>
      - uses: actions/download-artifact@<SHA>
        with: { name: web-dist, path: ./web-dist }

      # NEW — Tailscale ephemeral node REPLACES long-lived SSH key
      - uses: tailscale/github-action@<SHA>  # v4
        with:
          oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
          oauth-secret:    ${{ secrets.TS_OAUTH_SECRET }}
          tags: tag:ci

      - run: ssh-keyscan -H gr-prod >> ~/.ssh/known_hosts
      - run: rsync -az docker-compose.yml Caddyfile gr-prod:/opt/gravity-room/
      - run: rsync -az --delete ./web-dist/ gr-prod:/opt/gravity-room/data/web-dist/

      # NEW — verify image signatures on the VPS BEFORE pull/up
      - env: { IMAGE_TAG: ${{ github.sha }} }
        run: |
          ssh gr-prod bash -se <<'EOF'
          set -e
          for svc in api analytics; do
            img="ghcr.io/<owner>/gravity-room-${svc}:${IMAGE_TAG}"
            cosign verify "$img" \
              --certificate-identity-regexp '^https://github.com/<owner>/TrackerRSN/' \
              --certificate-oidc-issuer https://token.actions.githubusercontent.com >/dev/null
          done
          EOF

      # EXISTING pre-deploy env gate — keep as-is
      - run: ssh gr-prod docker run --rm --env-file /opt/gravity-room/.env -e NODE_ENV=production \
               ghcr.io/<owner>/gravity-room-api:${{ github.sha }} \
               bun run /app/apps/backend/api/scripts/check-env.ts

      # NEW — record rollback pointer
      - env: { IMAGE_TAG: ${{ github.sha }} }
        run: |
          ssh gr-prod bash -se <<'EOF'
          set -e
          cd /opt/gravity-room
          [ -f .image_tag ] && cp .image_tag .image_tag.prev
          echo "$IMAGE_TAG" > .image_tag
          export IMAGE_TAG
          docker compose pull
          docker compose up -d --remove-orphans
          EOF

      # health check unchanged
```

> All `<SHA>` placeholders are full 40-char commits, verified against each action's official release tag before merging.

---

## Observability budget table

| Component                                | Hosting                 | €/mo         | Scope                   |
| ---------------------------------------- | ----------------------- | ------------ | ----------------------- |
| Metrics (API `/metrics`, node, cAdvisor) | Grafana Cloud Free      | 0            | 10k series, 14d         |
| Logs (Docker JSON via Alloy)             | Grafana Cloud Free      | 0            | 50 GB/mo, 14d           |
| Errors + perf traces                     | Sentry (existing)       | 0            | unchanged               |
| Uptime probes                            | UptimeRobot Free        | 0            | 3 of 50 monitors, 5-min |
| Alerts                                   | Telegram bot (existing) | 0            | webhook contact point   |
| Product analytics                        | Plausible (existing)    | unchanged    | unchanged               |
| **Observability subtotal**               |                         | **0**        |                         |
| VPS (Hetzner)                            | Hetzner                 | ~5           | unchanged               |
| **Total**                                |                         | **≤ 5 €/mo** | well under €15 cap      |

---

## Open questions

1. **Tailscale ACL** — `srcIPs` restriction on top of tag-based ACL is overkill (GHA IP range is huge). Confirm tag + ephemerality is enough.
2. **GHCR tag immutability** — deploy-by-digest as workaround until GitHub ships registry-level immutability.
3. **Secondary scanner** — add `grype` alongside Trivy post-incident, or accept one well-pinned scanner?
4. **`anthropics/claude-code-action@v1`** — SHA-pin and accept Dependabot review cadence?
5. **Auto-rollback on health-check fail?** — recommend manual: auto-rollback masks the root cause and adds a second mystery deploy to debug.

---

## Sources

- [GitHub Docs — Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Well-Architected — Actions security](https://wellarchitected.github.com/library/application-security/recommendations/actions-security/)
- [StepSecurity — Pinning GHA](https://www.stepsecurity.io/blog/pinning-github-actions-for-enhanced-security-a-complete-guide)
- [actions/attest-build-provenance](https://github.com/actions/attest-build-provenance) · [cosign verify #162](https://github.com/actions/attest-build-provenance/issues/162)
- [anchore/sbom-action](https://github.com/marketplace/actions/anchore-sbom-action) · [SBOM formats](https://oss.anchore.com/docs/guides/sbom/formats/)
- [Trivy advisory GHSA-69fq-xp46-6x23](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23) · [StepSecurity post-incident](https://www.stepsecurity.io/blog/trivy-compromised-a-second-time---malicious-v0-69-4-release) · [Snyk](https://snyk.io/articles/trivy-github-actions-supply-chain-compromise/)
- [google/osv-scanner releases](https://github.com/google/osv-scanner/releases) · [supported lockfiles](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)
- [Tailscale GHA docs](https://tailscale.com/kb/1276/tailscale-github-action) · [Secure GH runners KB](https://tailscale.com/kb/1586/secure-github-runners)
- [Sigstore cosign signing](https://docs.sigstore.dev/cosign/signing/overview/) · [policy-controller](https://docs.sigstore.dev/policy-controller/overview/)
- [GitHub CodeQL action](https://github.com/github/codeql-action) · [Code scanning docs](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning)
- [Dependabot ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories) · [cooldown + groups](https://www.stepsecurity.io/blog/announcing-dependabot-configuration-enhancements-cooldown-and-group-support)
- [Grafana Cloud pricing 2026](https://grafana.com/pricing/) · [Loki sizing](https://grafana.com/docs/loki/latest/setup/size/)
- [Vector Loki sink](https://vector.dev/docs/reference/configuration/sinks/loki/)
- [UptimeRobot pricing 2026](https://uptimerobot.com/knowledge-hub/monitoring/11-best-uptime-monitoring-tools-compared/)
- [GHCR immutability discussion #181783](https://github.com/orgs/community/discussions/181783)
- [Smallstep — GHA OIDC short-lived certs](https://smallstep.com/blog/github-actions-oidc-tls-credentials/)
