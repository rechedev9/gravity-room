# Gravity Room — Bottom-Up Hardening Implementation Plan

> Companion to [`00-master-design.md`](./00-master-design.md). Status: ready
> to execute. All 6 §8 decisions of the master spec are accepted by the user
> on 2026-05-11.
>
> Audience: the future implementer with shell access to
> `/home/reche/projects/TrackerRSN` and SSH to `gr-prod`
> (178.105.107.25) as the deploy user. This document is intended to be
> executable without re-reading the master spec or research files; every
> snippet you need is inlined.

---

## TODO — operator must complete BEFORE merging the PR that lands Phase 4 / `deploy.yml`

The SHAs below could not be looked up offline. Resolve each one from the
upstream release tag indicated in the trailing comment **on the day the
PR is opened**, then drop the value in-line in the relevant code block
below. Do NOT merge a `<SHA-LOOKUP-…>` placeholder.

```
<SHA-LOOKUP-CHECKOUT-V5>         # actions/checkout v5.x.y
<SHA-LOOKUP-BUILDX-V3>           # docker/setup-buildx-action v3.x.y
<SHA-LOOKUP-LOGIN-V3>            # docker/login-action v3.x.y
<SHA-LOOKUP-BUILDPUSH-V6>        # docker/build-push-action v6.x.y
<SHA-LOOKUP-ATTEST-V2>           # actions/attest-build-provenance v2.x.y
<SHA-LOOKUP-SBOM-V0>             # anchore/sbom-action (Syft 1.20.0 line)
<SHA-LOOKUP-TRIVY-V0.35.0>       # aquasecurity/trivy-action — post-incident commit
                                  # MUST resolve to the v0.35.0 release tag
                                  # (NOT any later force-pushed tag — see
                                  # GHSA-69fq-xp46-6x23). Verify the commit
                                  # date precedes 2026-03 and matches
                                  # github.com/aquasecurity/trivy-action @ v0.35.0.
<SHA-LOOKUP-OSV-V2.3.5>          # google/osv-scanner-action v2.3.5
<SHA-LOOKUP-COSIGN-V3>           # sigstore/cosign-installer v3.x.y
<SHA-LOOKUP-TAILSCALE-V4>        # tailscale/github-action v4.x.y
<SHA-LOOKUP-CODEQL-V3>           # github/codeql-action v3.x.y
<SHA-LOOKUP-DOWNLOAD-ARTIFACT-V4>
<SHA-LOOKUP-UPLOAD-ARTIFACT-V4>
<SHA-LOOKUP-SETUP-BUN-V2>        # oven-sh/setup-bun v2.x.y
<SHA-LOOKUP-CLAUDE-CODE-ACTION-V1>  # anthropics/claude-code-action — mutable tag accepted by §8 dec. 5
```

The Dependabot config landed in Phase 5 will keep these honest going
forward; this list exists only to bootstrap.

---

## Conventions

- **On VPS** = SSH session to `gr-prod` (178.105.107.25) as the deploy
  user. All `sudo` calls happen there. Working directory is `/opt/gravity-room`
  unless stated.
- **In repo** = local change in `/home/reche/projects/TrackerRSN`, made on
  a feature branch, committed, pushed, opened as a PR. CI runs. Merge to
  `main` triggers `deploy.yml` which rsyncs the new `docker-compose.yml`
  / `Caddyfile` / `web-dist/` to the VPS and runs `docker compose pull
&& up -d`. Never edit files on the VPS that are managed by `deploy.yml`.
- **Step shape**: every numbered step has four fields — **Precondition** /
  **Action** / **Verification** / **Rollback** — and is marked
  **[reversible]** or **[irreversible]**. Reversible = `Rollback` undoes
  everything inside one minute with no data loss; irreversible = best-case
  recovery involves restoring from backup or re-creating a resource.
- **Source citations**: each step cites the master spec section AND the
  research-file P-level it implements, e.g. `→ 00-master §3 L3 / 01-host-os P0-1`.
- **Phase boundaries are commit boundaries.** Do not bundle two phases in
  one PR. Each phase ends with verification before the next begins.
- **Order is fixed.** §8 decisions accepted by the user lock Phase 1 → 2
  → 3 → 4 → 5; Tailscale (Phase 4) MUST replace `VPS_SSH_KEY` before
  port 22 is closed; migrations MUST move out of API boot (Phase 3) before
  `postgresql.conf` is rewritten (also Phase 3); userns-remap is a
  scheduled-downtime step **inside Phase 4** (not bundled with hot patches).
- **WAL-G first restore drill** is the gate to exit Phase 3. The phase
  does not close until a successful restore-to-staging is recorded in the
  Phase 3 verification matrix.
- All file content blocks below are the **complete** target files unless
  the block is explicitly labelled "delta" — in which case paste only the
  delta lines into the existing file.

---

## Pre-flight checklist (before starting Phase 1)

These are external preconditions. Each MUST be true before Phase 1 starts.
Phase 3 and 4 dependencies are listed up front so the user can spin
them up in parallel to Phase 1/2 work.

- [ ] User has shell access to `gr-prod` confirmed (`ssh deploy@gr-prod uptime` succeeds).
- [ ] Hetzner Object Storage bucket `gravity-pg-prod` created in **fsn1** (same region as VPS), versioning ON. Capture endpoint URL and access keys.
  - **Phase 3 dependency** (P3.4 step 11 / WAL-G destination).
- [ ] `WALG_LIBSODIUM_KEY` generated locally with `openssl rand -hex 32`, length-checked = 64 hex chars, and copied to user's password manager (Bitwarden/1Password) + a separate item in GitHub Actions secret named `WALG_LIBSODIUM_KEY` (restore workflow only — NOT exposed to `deploy.yml`).
  - **Phase 3 dependency**.
- [ ] Tailscale Personal account created. Tailnet has `tag:ci` and `tag:prod-vps` declared in ACL. OAuth client `gr-deploy-ci` created with scope `devices:write` and ACL tag `tag:ci`. Client ID + secret stored in GH secrets `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET`.
  - **Phase 4 dependency**.
- [ ] Grafana Cloud Free account created. Capture `prometheus.remote_write` endpoint + token and `loki.write` endpoint + token. Stored in `/opt/gravity-room/.env.alloy` on host with `chmod 600`.
  - **Phase 5 dependency**.
- [ ] UptimeRobot Free account created. Telegram webhook contact configured pointing at the existing `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`.
  - **Phase 5 dependency**.
- [ ] User has confirmed maintenance window for **Phase 3 step 11 (Valkey
      rotation)**: ~5 min low-traffic, ephemeral keys, drains cleanly.
- [ ] User has confirmed maintenance window for **Phase 4 step 18 (userns-remap)**: ~15 min downtime in a low-traffic window. §8 decision 3 accepted.

---

# Phase 1 — Same-day-safe host & OS hardening (on VPS, no service restart)

**Goal.** Land every host/OS-level P0 from `01-host-os.md` that does NOT
require service restarts or repo PRs. All steps are SSH-only against
`gr-prod`. `docker compose` is not touched. If anything fails verification,
roll back inside the same SSH session before logging out.

> Open a SECOND SSH session before starting and leave it idle. If steps
> 1.2/1.4 lock you out of session #1, session #2 is the recovery path.

### Step 1.1 — SSH hardening drop-in [reversible]

→ 00-master §3 L3 / 01-host-os P0-1.

**Precondition.** Deploy user has an authorized public key already in
`~/.ssh/authorized_keys`. Confirm with `ssh-keygen -lf ~/.ssh/authorized_keys`
in session #1. **If this is empty, STOP** — locking down password auth
without a working key is a self-DoS.

**Action.** On VPS, write `/etc/ssh/sshd_config.d/99-hardening.conf`:

```sshd
# /etc/ssh/sshd_config.d/99-hardening.conf — Phase 1 hardening
# Loaded after sshd_config; same-key directives override.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
AllowUsers deploy
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
ClientAliveInterval 300
ClientAliveCountMax 2
```

Then validate and reload, **without** restarting:

```bash
sudo sshd -t                         # syntax check; must print nothing and return 0
sudo systemctl reload ssh
```

**Verification.** From session #1 (still open):

```bash
ssh deploy@gr-prod 'sshd -T 2>/dev/null | grep -iE "^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|maxauthtries|allowusers|x11forwarding|allowagentforwarding|allowtcpforwarding|clientaliveinterval) "'
```

Expected output (case-insensitive, exact values):

```
permitrootlogin no
passwordauthentication no
kbdinteractiveauthentication no
maxauthtries 3
allowusers deploy
x11forwarding no
allowagentforwarding no
allowtcpforwarding no
clientaliveinterval 300
```

Then open a THIRD session as `deploy@gr-prod` to confirm logins still
work post-reload. Do not log out of session #1 until session #3 succeeds.

**Rollback.** `sudo rm /etc/ssh/sshd_config.d/99-hardening.conf && sudo systemctl reload ssh`.

---

### Step 1.2 — Kernel sysctl hardening [reversible]

→ 00-master §3 L3 / 01-host-os P1-6.

**Precondition.** None.

**Action.** On VPS, write `/etc/sysctl.d/99-hardening.conf`:

```conf
# /etc/sysctl.d/99-hardening.conf — Phase 1 hardening
# Network — SYN-flood mitigation and spoof / redirect controls.
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Kernel — restrict pointer / dmesg leaks.
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1

# Filesystem — protect against link-following race conditions.
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.protected_fifos = 2
fs.protected_regular = 2
```

Then apply:

```bash
sudo sysctl --system | tail -20      # confirms file was loaded; should print each key=value
```

**Verification.**

```bash
ssh deploy@gr-prod 'sysctl net.ipv4.tcp_syncookies net.ipv4.conf.all.rp_filter kernel.kptr_restrict fs.protected_symlinks'
```

Expected:

```
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
kernel.kptr_restrict = 2
fs.protected_symlinks = 1
```

**Rollback.** `sudo rm /etc/sysctl.d/99-hardening.conf && sudo sysctl --system`. Reboot if any value won't reset (rare).

---

### Step 1.3 — Unattended-upgrades with 04:00 auto-reboot [reversible]

→ 00-master §3 L3 / 01-host-os P0-2.

**Precondition.** Step 1.2 applied. Disk has > 2 GB free in `/`.

**Action.** On VPS:

```bash
sudo apt-get update
sudo apt-get install -y unattended-upgrades update-notifier-common
```

Write `/etc/apt/apt.conf.d/52-gr-unattended.conf` (a hardening drop-in;
does NOT replace Ubuntu's default config — overrides what we care about):

```apt
// /etc/apt/apt.conf.d/52-gr-unattended.conf — Phase 1
// Keep ONLY the security pocket to avoid drift from -updates.
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
```

Smoke the config:

```bash
sudo unattended-upgrade --dry-run --debug 2>&1 | tail -30
```

**Verification.**

```bash
ssh deploy@gr-prod 'systemctl is-active unattended-upgrades.service && sudo cat /etc/apt/apt.conf.d/52-gr-unattended.conf | head -5'
```

Expected: `active` and the config preamble.

**Rollback.** `sudo rm /etc/apt/apt.conf.d/52-gr-unattended.conf && sudo apt-get purge -y unattended-upgrades`.

---

### Step 1.4 — fail2ban with sshd jail [reversible]

→ 00-master §3 L3 / 01-host-os P1-5.

**Precondition.** Step 1.1 applied (sshd reload succeeded).

**Action.** On VPS:

```bash
sudo apt-get install -y fail2ban
```

Write `/etc/fail2ban/jail.d/sshd.local`:

```ini
# /etc/fail2ban/jail.d/sshd.local — Phase 1
[DEFAULT]
backend = systemd
bantime  = 1h
findtime = 10m
maxretry = 3
ignoreself = true
# Keep your own IPv4 in case of accidental lockout.
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
mode    = aggressive
```

Then:

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

**Verification.** Expected output of the last command:

```
Status for the jail: sshd
|- Filter
|  |- Currently failed: 0
|  |- Total failed:     0
|  `- Journal matches:  _SYSTEMD_UNIT=sshd.service
`- Actions
   |- Currently banned: 0
   |- Total banned:     0
   `- Banned IP list:
```

**Rollback.** `sudo systemctl disable --now fail2ban && sudo apt-get purge -y fail2ban`.

---

### Step 1.5 — Docker `daemon.json` (live-restore + log rotation) [reversible]

→ 00-master §3 L4 / 01-host-os P0-3.

**Precondition.** Docker is running (`systemctl is-active docker` → `active`).

**Action.** On VPS, write `/etc/docker/daemon.json` (overwriting any existing
file — back it up first):

```bash
sudo cp -n /etc/docker/daemon.json /etc/docker/daemon.json.bak 2>/dev/null || true
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": "true"
  },
  "live-restore": true
}
```

**NOTE — userns-remap is NOT added here.** It is part of Phase 4 (planned
downtime). Touching `userns-remap` together with `live-restore` re-chowns
`/var/lib/docker` and breaks every running container, defeating the
"no service restart" property of Phase 1.

Then reload — `live-restore` keeps containers serving traffic through it:

```bash
sudo systemctl reload docker
```

**Verification.**

```bash
ssh deploy@gr-prod 'docker info --format "{{.LiveRestoreEnabled}} {{.LoggingDriver}}" && cat /etc/docker/daemon.json'
ssh deploy@gr-prod 'docker compose -f /opt/gravity-room/docker-compose.yml ps'
```

Expected first line: `true json-file`. Expected second: all five services
healthy and **NOT** restarted in the last 60s (`STATUS` shows their
prior uptime).

**Rollback.** `sudo mv /etc/docker/daemon.json.bak /etc/docker/daemon.json && sudo systemctl reload docker`.

---

### Step 1.6 — nftables baseline (public 80/tcp, 443/tcp+udp, 22/tcp) [reversible]

→ 00-master §3 L2 / 01-host-os P0-4.

**Precondition.** Steps 1.1, 1.4, 1.5 applied. Second SSH session open
and idle, used to confirm rules don't lock you out.

**Action.** On VPS, **do not enable UFW** — Docker's iptables NAT chain
bypasses it and gives a false sense of security. Use raw nftables.

```bash
sudo apt-get install -y nftables
```

Write `/etc/nftables.conf` — back up the existing one first:

```bash
sudo cp -n /etc/nftables.conf /etc/nftables.conf.bak 2>/dev/null || true
```

```nft
#!/usr/sbin/nft -f
# /etc/nftables.conf — Phase 1 baseline
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority filter; policy drop;

        ct state established,related accept
        ct state invalid drop

        # Loopback
        iif "lo" accept

        # ICMPv4/v6 (rate-limited; allow ping + path MTU + ndp)
        ip protocol icmp limit rate 10/second accept
        ip6 nexthdr ipv6-icmp limit rate 10/second accept

        # Public services
        tcp dport 22 accept   comment "SSH — closes in Phase 4 after Tailscale"
        tcp dport 80 accept   comment "HTTP — Caddy ACME + redirect"
        tcp dport 443 accept  comment "HTTPS — Caddy"
        udp dport 443 accept  comment "QUIC / HTTP/3 — Caddy"
    }
    chain forward { type filter hook forward priority filter; policy accept; }
    chain output  { type filter hook output  priority filter; policy accept; }
}
```

> The `forward` chain policy is `accept` on purpose — Docker manages its
> own forward rules via the `DOCKER-USER` iptables/nft chain. Setting
> `drop` here would break container-to-container networking.

Test the rules in a transient session before persisting:

```bash
sudo nft -c -f /etc/nftables.conf   # syntax check
sudo systemctl enable nftables
sudo systemctl restart nftables
```

**Verification.** From your laptop (NOT from the existing SSH session):

```bash
ssh -o ConnectTimeout=5 deploy@gr-prod uptime          # must succeed within 5s
curl -sS -o /dev/null -w '%{http_code}\n' https://gravityroom.app/   # must print 200 or 30x
curl -sS -o /dev/null -w '%{http_code}\n' https://api.gravityroom.app/health  # must print 200
nc -zvw3 178.105.107.25 5432                            # MUST fail (refused/timeout)
nc -zvw3 178.105.107.25 6379                            # MUST fail (refused/timeout)
nc -zvw3 178.105.107.25 3001                            # MUST fail (refused/timeout)
```

On VPS:

```bash
sudo nft list ruleset | head -40
```

Expected: the rules above, in the order written.

**Rollback.** From the open second SSH session:
`sudo mv /etc/nftables.conf.bak /etc/nftables.conf && sudo systemctl restart nftables`,
or `sudo systemctl stop nftables` to drop the filter entirely (everything
accepted).

---

### Step 1.7 — Caddy 2.11.2-alpine pin (hot swap, no behaviour change) [reversible]

→ 00-master §3 L5 / 02-edge-caddy P0-1.

**Precondition.** All prior Phase 1 steps applied. `docker-compose.yml` on
the VPS is the byte-identical copy `deploy.yml` last rsynced. **This step
is the only Phase 1 step that touches a file under repo control.** It
must therefore be a tiny PR; the operator changes the upstream tag in
the repo, lets CI/deploy run, and verifies on the VPS.

**Action — in repo.** Open feature branch `phase1-caddy-pin`. Edit
`docker-compose.yml`:

```yaml
# Before
  caddy:
    image: caddy:2-alpine
# After
  caddy:
    image: caddy:2.11.2-alpine
```

Open PR `phase1: pin caddy to 2.11.2-alpine`. Reasoning in body: 2.11.2
patches CVEs in `forward_auth` identity-injection and `vars_regexp`
placeholder double-expansion. Merge. `deploy.yml` runs and recreates the
caddy container only.

**Verification.** On VPS, after `deploy.yml` reports green:

```bash
ssh deploy@gr-prod 'docker inspect gravity-room-caddy-1 --format "{{.Config.Image}}" && docker exec gravity-room-caddy-1 caddy version'
curl -sSI https://gravityroom.app/ | grep -i '^server:'
```

Expected: `caddy:2.11.2-alpine`, `v2.11.2 …`, `server: Caddy`.

**Rollback.** Revert the PR, merge revert, let deploy.yml recreate. If
the rollback PR can't ship in time, on VPS: `sudo sed -i 's/2.11.2-alpine/2-alpine/'
/opt/gravity-room/docker-compose.yml && docker compose up -d caddy` (this
gets overwritten by the next deploy; the proper fix is still the PR).

---

### Phase 1 exit checks

- [ ] `ssh deploy@gr-prod sshd -T | grep -iE '^(permitrootlogin|passwordauthentication) '` → both `no`.
- [ ] `ssh deploy@gr-prod 'sysctl -n net.ipv4.tcp_syncookies'` → `1`.
- [ ] `ssh deploy@gr-prod 'systemctl is-active unattended-upgrades fail2ban nftables'` → three `active` lines.
- [ ] `ssh deploy@gr-prod 'docker info -f "{{.LiveRestoreEnabled}}"'` → `true`.
- [ ] External: `nc -zvw3 gr-prod 5432` fails; `nc -zvw3 gr-prod 443` succeeds.
- [ ] `curl -sI https://gravityroom.app | grep -i server` → `Server: Caddy`.

Phase 1 done. Proceed to Phase 2 only after these all pass.

---

# Phase 2 — Edge image rebuild + container hardening (in repo + deploy)

**Goal.** Land every container-runtime P0/P1 plus the security headers
and rate-limit zones from the edge research. This is the **biggest PR
in the rollout**; consider splitting into two sequential PRs if review
bandwidth is tight (one: docker-compose + Dockerfiles + DB_POOL_SIZE;
two: xcaddy custom image + new Caddyfile). The phase ends when both
land.

Each numbered step below is one PR or one workflow change. They land in
the listed order. Do not interleave.

### Step 2.1 — API Dockerfile: non-root `bun` user [reversible]

→ 00-master §3 L6 / 03-containers-runtime P0-1.

**Precondition.** Phase 1 complete.

**Action — in repo.** Edit `apps/backend/api/Dockerfile` to chown copies
to `bun` and switch user before `CMD`. Full file content:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.10-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/backend/api/package.json ./apps/backend/api/
COPY apps/frontend/web/package.json ./apps/frontend/web/
COPY apps/frontend/mobile/package.json ./apps/frontend/mobile/
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.10-alpine
RUN apk add --no-cache curl tini
WORKDIR /app
# Bun 1.3 isolated linker: real packages live in /app/node_modules/.bun, and
# each workspace gets its own node_modules with relative symlinks pointing
# back to the store. Both root and workspace node_modules must be carried over
# or `bun src/index.ts` cannot resolve `drizzle-orm/postgres-js` at runtime.
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=deps --chown=bun:bun /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps --chown=bun:bun /app/apps/backend/api/node_modules ./apps/backend/api/node_modules
COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun packages/domain ./packages/domain
COPY --chown=bun:bun apps/backend/api ./apps/backend/api
WORKDIR /app/apps/backend/api
ENV NODE_ENV=production PORT=3001
USER bun
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "src/index.ts"]
```

**Verification.** After the PR merges and `deploy.yml` runs:

```bash
ssh deploy@gr-prod 'docker exec gravity-room-api-1 id'
ssh deploy@gr-prod 'curl -fsS http://gr-prod/health' || \
  ssh deploy@gr-prod 'docker compose exec -T api curl -fsS http://localhost:3001/health'
```

Expected: `uid=1000(bun) gid=1000(bun) groups=1000(bun)` and a `200`/`{"ok":true}`-style body.

**Rollback.** Revert the PR. Merge revert. `deploy.yml` rebuilds prior
image and rolls back the container.

---

### Step 2.2 — Analytics Dockerfile: multi-stage + non-root `app` user [reversible]

→ 00-master §3 L6 / 03-containers-runtime P2-1 (promoted to Phase 2).

**Precondition.** Step 2.1 merged + deployed green.

**Action — in repo.** Replace `apps/backend/analytics/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY apps/backend/analytics/requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app \
    && useradd  --system --uid 10001 --gid 10001 --home-dir /app --shell /usr/sbin/nologin app
COPY --from=deps /install /usr/local
WORKDIR /app
COPY --chown=app:app apps/backend/analytics ./
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Verification.**

```bash
ssh deploy@gr-prod 'docker exec gravity-room-analytics-1 id'
ssh deploy@gr-prod 'docker compose exec -T analytics curl -fsS http://localhost:8000/health'
```

Expected: `uid=10001(app) gid=10001(app)` and `200`.

**Rollback.** Revert PR.

---

### Step 2.3 — `docker-compose.yml`: security defaults + resource limits [reversible]

→ 00-master §3 L4 + L6 / 03-containers-runtime P0-1..P0-3, P1-1..P1-4.

**Precondition.** Steps 2.1 + 2.2 merged + deployed green. The `bun` and
`app` non-root users are confirmed in the live images.

**Action — in repo.** Replace `docker-compose.yml`:

```yaml
name: gravity-room

x-logging: &default-logging
  driver: json-file
  options:
    max-size: '10m'
    max-file: '3'
    compress: 'true'

x-security: &default-security
  security_opt:
    - no-new-privileges:true
  cap_drop: [ALL]
  restart: unless-stopped
  logging: *default-logging

services:
  caddy:
    image: caddy:2.11.2-alpine # Phase 2.4 replaces with custom xcaddy image
    <<: *default-security
    cap_add:
      - NET_BIND_SERVICE
    ports:
      - '80:80'
      - '443:443'
      - '443:443/udp' # HTTP/3 / QUIC — opened in nftables step 1.6
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data/caddy:/data
      - ./data/web-dist:/srv/web:ro
    read_only: true
    tmpfs:
      - /tmp
      - /config
    networks: [gr-net]
    mem_limit: 256m
    cpus: 0.5
    pids_limit: 100
    depends_on:
      api:
        condition: service_healthy

  api:
    image: ghcr.io/rechedev9/gravity-room-api:${IMAGE_TAG:-latest}
    <<: *default-security
    user: '1000:1000' # bun (set in Dockerfile, defence-in-depth)
    env_file: .env
    read_only: true
    tmpfs:
      - /tmp
    networks: [gr-net]
    mem_limit: 768m
    cpus: 1.5
    pids_limit: 200
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-fsS', 'http://localhost:3001/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  analytics:
    image: ghcr.io/rechedev9/gravity-room-analytics:${IMAGE_TAG:-latest}
    <<: *default-security
    user: '10001:10001' # app (set in Dockerfile)
    env_file: .env
    read_only: true
    tmpfs:
      - /tmp
    networks: [gr-net]
    mem_limit: 512m
    cpus: 1.0
    pids_limit: 200
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-fsS', 'http://localhost:8000/health']
      interval: 60s
      timeout: 5s
      retries: 3
      start_period: 20s

  postgres:
    image: postgres:18-alpine
    <<: *default-security
    env_file: .env
    volumes:
      - /mnt/pg-vol:/var/lib/postgresql
    networks: [gr-net]
    mem_limit: 1g
    cpus: 1.5
    pids_limit: 300
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER}']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  redis:
    image: redis:7-alpine # Phase 3.5 replaces with valkey/valkey:9-alpine
    <<: *default-security
    command:
      [
        'redis-server',
        '--save',
        '',
        '--appendonly',
        'no',
        '--maxmemory',
        '256mb',
        '--maxmemory-policy',
        'allkeys-lru',
      ]
    read_only: true
    tmpfs:
      - /data
    networks: [gr-net]
    mem_limit: 320m
    cpus: 0.5
    pids_limit: 100
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5

networks:
  gr-net:
    driver: bridge
```

> **Why digest pins are NOT in this step.** Digest pinning is the
> §3 L6 P1-4 target. We land it in Phase 2.7 (alongside the cosign
> verification gate) so that signature verification and digest pinning
> arrive together — pinning by digest _before_ enforcing signatures buys
> nothing, and pinning by digest _during_ the security-default rollout
> doubles the churn surface of this PR.

**Verification.** After merge + deploy:

```bash
ssh deploy@gr-prod 'docker inspect gravity-room-api-1 --format "{{.HostConfig.SecurityOpt}} {{.HostConfig.CapDrop}} {{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Memory}}"'
ssh deploy@gr-prod 'docker inspect gravity-room-caddy-1 --format "{{.HostConfig.CapAdd}}"'
ssh deploy@gr-prod 'docker compose -f /opt/gravity-room/docker-compose.yml ps'
curl -sSI https://api.gravityroom.app/health | head -1
```

Expected highlights:

- api `SecurityOpt`: `[no-new-privileges:true]`, `CapDrop: [ALL]`,
  `ReadonlyRootfs: true`, `Memory: 805306368` (768 MiB).
- caddy `CapAdd: [NET_BIND_SERVICE]`.
- All five containers `Up (healthy)`.
- `/health` returns `HTTP/2 200`.

**Rollback.** Revert PR. If a service refuses to start on the new
constraints (e.g. PIDs limit too low), bump the limit in a follow-up PR
rather than reverting the whole hardening.

---

### Step 2.4 — `DB_POOL_SIZE` default 50 → 15 [reversible]

→ 00-master §3 L6 / 03-containers-runtime P1-5.

**Precondition.** Step 2.3 deployed green.

**Action — in repo.** Edit `apps/backend/api/src/db/index.ts` line 57:

```ts
// before
const poolSize = Number(process.env['DB_POOL_SIZE']) || 50;
// after
const poolSize = Number(process.env['DB_POOL_SIZE']) || 15;
```

Add to `.env.example` (under `# ─── Optional: Redis ───`):

```
# Database connection pool size per API instance. Default 15.
# Postgres default max_connections=100, shared with analytics + migrate.
# (cores * 2) + spindles is the upper sensible bound for this VPS.
# DB_POOL_SIZE=15
```

Add the same comment-only line to `.env.production.example`.

**Verification.** After merge + deploy:

```bash
ssh deploy@gr-prod 'docker compose exec -T postgres psql -U $${POSTGRES_USER} -d $${POSTGRES_DB} -c "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE '\''postgres.js%'\''"'
```

Should report < 20 connections during steady state. Spot-check API logs
for `ECONNREFUSED` or `too many clients` — should be absent.

**Rollback.** Revert PR.

---

### Step 2.5 — Brotli toolchain in web build container + precompressed sidecars [reversible]

→ 00-master §3 L5 / 02-edge-caddy P1-7.

**Precondition.** Step 2.4 deployed green.

**Action — in repo.** Two changes in one PR:

1. Add `vite-plugin-compression2` (or hand-rolled brotli step) to the
   web build that emits `*.br` and `*.zst` sidecars under `dist/`. Pick the
   plugin variant if Vite 7 supports it; otherwise the hand-rolled CI step:

```yaml
# .github/workflows/deploy.yml — build-web job (delta, append after `Build SPA`)
- name: Precompress static assets
  working-directory: apps/frontend/web/dist
  run: |
    sudo apt-get update && sudo apt-get install -y --no-install-recommends brotli zstd
    find . -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.json' -o -name '*.txt' -o -name '*.xml' \) -size +1k \
      -exec brotli -q 11 -k {} \; \
      -exec zstd -19 -q --rm=0 -o {}.zst {} \;
```

2. **Do not** touch the Caddyfile yet — that lands in Step 2.6 alongside
   the xcaddy custom image. Step 2.5 only produces the sidecars on disk;
   Caddy continues to serve uncompressed/on-the-fly until 2.6.

**Verification.** After merge + deploy:

```bash
ssh deploy@gr-prod 'ls /opt/gravity-room/data/web-dist/assets/ | grep -E "\.(br|zst)$" | head -5'
```

Expected: at least one `.br` and one `.zst` sidecar per JS/CSS bundle.

**Rollback.** Revert PR.

---

### Step 2.6 — Custom xcaddy image with `caddy-ratelimit` + new Caddyfile [irreversible at CI cache layer]

→ 00-master §3 L5 / 02-edge-caddy P0-2..P0-4, P1-5, P1-7.

**Precondition.** Step 2.5 deployed green; `.br`/`.zst` sidecars confirmed
on disk in `/opt/gravity-room/data/web-dist/`.

**Action — in repo.**

1. New file `apps/edge/caddy/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7
# Build Caddy 2.11.2 with the caddy-ratelimit module.
FROM caddy:2.11.2-builder-alpine AS builder
RUN xcaddy build v2.11.2 \
    --with github.com/mholt/caddy-ratelimit

FROM caddy:2.11.2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

2. New workflow job `build-caddy` appended to `deploy.yml` (delta — adds
   one job to the matrix-less section, runs in parallel to `build-images`):

```yaml
build-caddy:
  name: Build custom caddy image
  runs-on: ubuntu-latest
  permissions:
    contents: read
    packages: write
  steps:
    - uses: actions/checkout@v4 # Phase 4.1 replaces with SHA pin
    - uses: docker/setup-buildx-action@v3
    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - uses: docker/build-push-action@v6
      with:
        context: .
        file: apps/edge/caddy/Dockerfile
        push: true
        tags: |
          ghcr.io/${{ github.repository_owner }}/caddy-gr:2.11.2
          ghcr.io/${{ github.repository_owner }}/caddy-gr:${{ github.sha }}
        cache-from: type=gha,scope=caddy
        cache-to: type=gha,scope=caddy,mode=max
```

Wire `deploy` job to also depend on `build-caddy`:

```yaml
deploy:
  needs: [build-images, build-web, build-caddy]
```

3. `docker-compose.yml`: update caddy image:

```yaml
caddy:
  image: ghcr.io/rechedev9/caddy-gr:2.11.2
```

4. Replace `Caddyfile` with end-state from `02-edge-caddy.md §5`:

```caddy
{
    email rechedev@hotmail.com

    # Caddy is the first hop. Trust no upstream proxy. Explicit > implicit.
    servers {
        trusted_proxies static
        client_ip_headers X-Forwarded-For
    }
}

(security_headers) {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options    "nosniff"
        Referrer-Policy           "strict-origin-when-cross-origin"
        # same-origin-allow-popups: preserves window.opener for Google OAuth popup.
        Cross-Origin-Opener-Policy "same-origin-allow-popups"
        Cross-Origin-Resource-Policy "same-site"
        Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()"
        Content-Security-Policy "default-src 'self'; script-src 'self' https://accounts.google.com https://plausible.io https://*.sentry.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://plausible.io https://*.sentry.io https://*.ingest.sentry.io; frame-src https://accounts.google.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
    }
}

(access_log) {
    log {
        output stdout
        format json
        sampling {
            interval   1s
            first      20
            thereafter 50
        }
    }
}

www.gravityroom.app {
    import security_headers
    import access_log
    redir https://gravityroom.app{uri} permanent
}

api.gravityroom.app {
    import access_log
    encode zstd gzip

    rate_limit {
        zone auth_burst {
            match { path /api/auth/* }
            key   {client_ip}
            events 10
            window 1m
        }
        zone import_burst {
            match { path /api/programs/import }
            key   {client_ip}
            events 5
            window 10m
        }
        zone api_general {
            match { path /api/* }
            key   {client_ip}
            events 600
            window 1m
        }
    }

    reverse_proxy api:3001 {
        header_up X-Forwarded-For   {client_ip}
        header_up X-Forwarded-Proto {scheme}
    }
}

gravityroom.app {
    import security_headers
    import access_log
    encode zstd gzip
    root  * /srv/web

    @assets path /assets/*
    header  @assets Cache-Control "public, max-age=31536000, immutable"

    @html path *.html /
    # no-store: authenticated SPA shell must not be restored from BFCache after sign-out.
    header @html Cache-Control "no-store"

    try_files {path} {path}/index.html
    file_server {
        precompressed zstd br gzip
    }

    handle_errors {
        @404 expression `{http.error.status_code} == 404`
        handle @404 {
            rewrite * /404.html
            file_server
        }
    }
}
```

**Verification.** After merge + deploy:

```bash
# 1. Image identity
ssh deploy@gr-prod 'docker exec gravity-room-caddy-1 caddy list-modules 2>/dev/null | grep -i ratelimit'

# 2. Security headers
curl -sSI https://gravityroom.app/ | grep -iE '^(content-security-policy|cross-origin-opener-policy|cross-origin-resource-policy|permissions-policy|strict-transport-security):'

# 3. Precompressed serving
curl -sSI -H 'Accept-Encoding: br' https://gravityroom.app/assets/index-XXX.js | grep -i '^content-encoding: br'
curl -sSI -H 'Accept-Encoding: zstd' https://gravityroom.app/assets/index-XXX.js | grep -i '^content-encoding: zstd'

# 4. Rate limit (must 429 the 11th request inside 1 min)
for i in $(seq 1 12); do
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://api.gravityroom.app/api/auth/google -d '{}' -H 'content-type: application/json'
done
# Expect: 400 x10 then 429 x2 (or similar — at least one 429 by request 11).
```

**Rollback.** Revert PR. The custom image stays in GHCR (cache layer is
not destroyed). The previous `caddy:2.11.2-alpine` image keeps working.

---

### Phase 2 exit checks

- [ ] Every service `docker inspect … --format '{{.HostConfig.SecurityOpt}} {{.HostConfig.CapDrop}}'` shows the expected hardening.
- [ ] `https://gravityroom.app/` response carries the new COOP / CORP / Permissions-Policy headers.
- [ ] Static assets serve `content-encoding: br` and `zstd` to opt-in clients.
- [ ] 11th burst request to `/api/auth/*` from one IP returns `429`.
- [ ] API pool sized at 15 (visible in `pg_stat_activity` count).

Phase 2 done.

---

# Phase 3 — Data layer (migrations out of boot, Postgres tuning, role split, Valkey 9, WAL-G)

**Goal.** Move migrations out of API boot, harden Postgres with config +
role separation + `pg_hba.conf`, swap Redis 7 for Valkey 9, install
WAL-G as a sidecar with off-host encrypted backups, drill a restore.

> **Sequencing inside Phase 3 is critical**: migrations move out FIRST
> (step 3.1), then `postgresql.conf` lands (step 3.2). If the order is
> swapped, a tuning regression that breaks a migration takes the API
> down on boot.

### Step 3.1 — Move migrations out of API boot into a compose `migrate` service [irreversible — schema state changes ownership]

→ 00-master §3 L6 / 04-data-pg-redis P0-2.

**Precondition.** Phase 2 complete.

**Action — in repo.**

1. `apps/backend/api/src/bootstrap.ts` — remove the top-level `await
runMigrations()` and `await runSeeds()`. Keep the functions exported
   so the new entrypoint can call them.

   Replace lines 186 and 203 (`await runMigrations()` and `await runSeeds()`)
   with a guard against accidental in-boot invocation:

   ```ts
   if (process.env['RUN_MIGRATIONS_ON_BOOT'] === 'true') {
     // Legacy path — should ONLY be set in non-production environments
     // (local dev convenience). Production migrations run via the
     // `migrate` compose service before `up -d`.
     await runMigrations();
     await runSeeds();
   }
   ```

   Export `runMigrations` and `runSeeds` from `bootstrap.ts` so a new
   script can call them.

2. New file `apps/backend/api/scripts/migrate.ts`:

   ```ts
   import { runMigrations, runSeeds } from '../src/bootstrap';

   await runMigrations();
   await runSeeds();
   console.log('migrations + seeds done');
   process.exit(0);
   ```

   > Note: `bootstrap.ts` currently top-level-awaits `runMigrations` and
   > `runSeeds`. Refactor those into exported functions wrapped by the
   > guard above. **Do not** start the Elysia app inside `migrate.ts`.

3. `docker-compose.yml` — add a `migrate` service. It shares the api
   image and only runs once per deploy:

   ```yaml
     migrate:
       image: ghcr.io/rechedev9/gravity-room-api:${IMAGE_TAG:-latest}
       <<: *default-security
       user: '1000:1000'
       env_file: .env
       networks: [gr-net]
       depends_on:
         postgres:
           condition: service_healthy
       profiles: [migrate]                # never started by `docker compose up`
       command: ['bun', 'run', '/app/apps/backend/api/scripts/migrate.ts']
       restart: 'no'
   ```

4. `deploy.yml` — between "Validate VPS env" and "Pull images and restart
   stack", insert a "Run migrations" step:

   ```yaml
   - name: Run migrations
     env:
       VPS_USER: ${{ secrets.VPS_USER }}
       VPS_HOST: ${{ secrets.VPS_HOST }}
       IMAGE_TAG: ${{ github.sha }}
     run: |
       ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new \
         "${VPS_USER}@${VPS_HOST}" bash <<EOF
       set -e
       cd /opt/gravity-room
       export IMAGE_TAG=${IMAGE_TAG}
       docker compose --profile migrate pull migrate
       docker compose --profile migrate run --rm migrate
       EOF
   ```

**Verification.** After merge:

- `deploy.yml` log shows the `Run migrations` step printing
  `migrations + seeds done` and exiting 0 BEFORE `Pull images and restart stack`.
- API container logs: no longer print `running database migrations` on boot.
- `docker compose ps` shows no `gravity-room-migrate-*` container running
  (`profiles: [migrate]` keeps it out of the default set).

**Rollback.** This is **irreversible in the sense that the migration
journal state is now considered managed by the new path** — but the
underlying schema is unchanged. To revert: restore the original
`bootstrap.ts` (remove the guard, reinstate `await runMigrations()`),
remove the `migrate` service and the `Run migrations` workflow step,
deploy. Migrations will resume running on API boot as before.

---

### Step 3.2 — `postgresql.conf` delta + `pg_hba.conf` lockdown [reversible]

→ 00-master §3 L6 / 04-data-pg-redis P1-1.

**Precondition.** Step 3.1 deployed and migrations are confirmed running
out-of-boot for at least one deploy.

**Action — in repo.**

1. New file `apps/backend/postgres/postgresql.conf` (full file — replaces
   defaults via `command: postgres -c config_file=...`):

```conf
# memory (sized for 8 GB CCX13; halve if downscaled)
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 16MB
maintenance_work_mem = 256MB
wal_buffers = 16MB
huge_pages = try

# WAL & checkpoints
wal_level = replica
max_wal_senders = 3
archive_mode = on
archive_command = 'wal-g wal-push %p'
archive_timeout = 60s
checkpoint_completion_target = 0.9
min_wal_size = 1GB
max_wal_size = 4GB

# connections / planner
max_connections = 50
random_page_cost = 1.1
jit = off
io_method = worker

# security / timeouts (global ceilings; role-level limits are tighter)
password_encryption = scram-sha-256
ssl = off
statement_timeout = 60s
idle_in_transaction_session_timeout = 5min
lock_timeout = 10s

# logging
log_min_duration_statement = 250ms
log_lock_waits = on
log_temp_files = 0
log_checkpoints = on
log_autovacuum_min_duration = 1s
log_line_prefix = '%m [%p] %q%u@%d '
log_connections = on
log_disconnections = on

# autovacuum (per-table overrides via ALTER TABLE)
autovacuum_naptime = 30s
autovacuum_max_workers = 3
```

2. New file `apps/backend/postgres/pg_hba.conf`:

```
# TYPE   DATABASE  USER                ADDRESS         METHOD
local    all       all                                 peer
host     all       all                 127.0.0.1/32    scram-sha-256
host     all       all                 ::1/128         scram-sha-256

# gr-net bridge subnet — Docker assigns 172.16.0.0/12 by default; pin via
# the network's IPAM block if we ever lock it down. Until then, accept any
# RFC1918 source that reaches us via the bridge (we already drop everything
# else at nftables).
host     all       gravity_app         172.16.0.0/12   scram-sha-256
host     all       gravity_migrate     172.16.0.0/12   scram-sha-256
host     all       gravity_backup      172.16.0.0/12   scram-sha-256

# Deny everything else explicitly.
host     all       all                 0.0.0.0/0       reject
host     all       all                 ::/0            reject
```

3. `docker-compose.yml` — mount the configs and switch postgres command:

```yaml
  postgres:
    image: postgres:18-alpine
    <<: *default-security
    env_file: .env
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - hba_file=/etc/postgresql/pg_hba.conf
    volumes:
      - /mnt/pg-vol:/var/lib/postgresql
      - ./apps/backend/postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./apps/backend/postgres/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro
    # ... rest unchanged
```

4. `deploy.yml` — extend the `rsync compose + Caddyfile` step to include
   the new config dir:

```bash
   rsync -az \
     -e "ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new" \
     docker-compose.yml Caddyfile apps/backend/postgres \
     "${VPS_USER}@${VPS_HOST}:/opt/gravity-room/"
```

**Verification.** After merge + deploy:

```bash
ssh deploy@gr-prod 'docker compose exec -T postgres psql -U $${POSTGRES_USER} -d $${POSTGRES_DB} -c "SHOW shared_buffers; SHOW max_connections; SHOW archive_mode; SHOW io_method;"'
```

Expected:

```
 shared_buffers
----------------
 1GB
 max_connections
-----------------
 50
 archive_mode
--------------
 on
 io_method
-----------
 worker
```

> `archive_command = 'wal-g wal-push %p'` will fail until step 3.4 lands
> WAL-G. Postgres will log archive failures every 60s — this is **expected**
> until 3.4 is complete. The risk is acceptable inside Phase 3 because
> WAL segments stay on disk on `pg_wal` until archived; with the default
> retention there is ample headroom for a 1–2 day Phase-3 rollout.

**Rollback.** Revert PR. Postgres falls back to default config; pg_hba
returns to the postgres-shipped permissive default.

---

### Step 3.3 — Role separation + tight role-level timeouts [irreversible — superuser password rotation]

→ 00-master §3 L6 / 04-data-pg-redis P1-2 + P1-3.

**Precondition.** Step 3.2 deployed green. New SCRAM auth tested.

**Action — on VPS.** This is a one-shot SQL session as the current
`postgres` superuser. The new roles take over `gravity_app`,
`gravity_migrate`, `gravity_backup`; the superuser password is rotated
and removed from `.env`.

1. Generate three random passwords (locally):

```bash
for n in app migrate backup; do echo "PG_${n^^}=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)"; done
```

Store each in the user's password manager AND temporarily on the VPS in
`/opt/gravity-room/.env` (which is already `chmod 600`).

2. On VPS:

```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
-- Role: app — what the API connects as. NO superuser, NO createdb.
CREATE ROLE gravity_app    LOGIN PASSWORD :'PG_APP'  NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE gravity_migrate LOGIN PASSWORD :'PG_MIGRATE' NOSUPERUSER CREATEDB;
CREATE ROLE gravity_backup  LOGIN PASSWORD :'PG_BACKUP'  REPLICATION  NOSUPERUSER NOCREATEDB;

GRANT ALL ON DATABASE :"POSTGRES_DB" TO gravity_migrate;
GRANT CONNECT ON DATABASE :"POSTGRES_DB" TO gravity_app;
GRANT USAGE ON SCHEMA public TO gravity_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gravity_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gravity_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gravity_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gravity_app;

-- Role-level timeouts (tighter than the global ceiling from postgresql.conf).
ALTER ROLE gravity_app  SET statement_timeout = '30s';
ALTER ROLE gravity_app  SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE gravity_app  SET lock_timeout = '5s';
SQL
```

3. Rotate `postgres` superuser password and remove it from `.env`:

```bash
NEW_SUPER=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER ROLE $POSTGRES_USER PASSWORD '$NEW_SUPER';"
# Save NEW_SUPER to the user's password manager. Do NOT write it to .env.
```

4. Edit `/opt/gravity-room/.env` (host side, chmod 600):

```env
# === Postgres app role ===
DATABASE_URL=postgres://gravity_app:${PG_APP}@postgres:5432/gravity

# === Postgres migration role (only consumed by the `migrate` service) ===
MIGRATE_DATABASE_URL=postgres://gravity_migrate:${PG_MIGRATE}@postgres:5432/gravity

# === Backup role (only consumed by WAL-G sidecar — step 3.4) ===
PG_BACKUP_USER=gravity_backup
PG_BACKUP_PASSWORD=${PG_BACKUP}
```

5. Update `apps/backend/api/scripts/migrate.ts` to read
   `MIGRATE_DATABASE_URL` if set, fall back to `DATABASE_URL`:

```ts
process.env['DATABASE_URL'] = process.env['MIGRATE_DATABASE_URL'] ?? process.env['DATABASE_URL'];
```

6. Recycle the stack: `docker compose up -d`. Watch for connection errors
   and roll back per "Rollback" below if anything fails.

**Verification.**

```bash
ssh deploy@gr-prod 'docker compose exec -T postgres psql -U gravity_app -d gravity -c "SELECT current_user, current_database(); SHOW statement_timeout;"'
```

Expected:

```
 current_user | current_database
--------------+------------------
 gravity_app  | gravity
 statement_timeout
-------------------
 30s
```

Also check `pg_stat_activity` 5 minutes after deploy — every API
connection should report `usename=gravity_app`, not `gravity`.

**Rollback.** This is the riskiest step of Phase 3. Mitigation:

- Keep the prior `DATABASE_URL` (with superuser creds) commented out in
  `.env` for one deploy cycle.
- Restore via:
  ```bash
  sudo sed -i 's/^DATABASE_URL=.*$/DATABASE_URL=postgres:\/\/gravity:OLD_PW@postgres:5432\/gravity/' /opt/gravity-room/.env
  docker compose up -d api analytics
  ```
- The new roles persist in the database and are harmless.

---

### Step 3.4 — WAL-G sidecar + Hetzner Object Storage backups [irreversible — first WAL push]

→ 00-master §3 L6 / 04-data-pg-redis P0-1.

**Precondition.** Pre-flight checklist items complete (bucket created,
libsodium key generated and stored in password manager + GH secret). Step
3.3 deployed green.

**Action — in repo.**

1. New file `apps/backend/postgres/walg/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git build-base cmake libsodium-dev
RUN go install github.com/wal-g/wal-g/cmd/pg@v3.0.8 \
 && mv /go/bin/pg /usr/local/bin/wal-g

FROM alpine:3.20
RUN apk add --no-cache libsodium su-exec tzdata
COPY --from=builder /usr/local/bin/wal-g /usr/local/bin/wal-g
COPY walg-entrypoint.sh /usr/local/bin/walg-entrypoint.sh
RUN chmod +x /usr/local/bin/walg-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/walg-entrypoint.sh"]
```

2. New file `apps/backend/postgres/walg/walg-entrypoint.sh`:

```sh
#!/bin/sh
set -e
# Cron loop inside the sidecar — keeps the container alive for
# `archive_command` calls (which exec into the same container via shared
# /usr/local/bin mount) and runs a daily full backup at 02:30 UTC.
LIBSODIUM_KEY=$(cat "$WALG_LIBSODIUM_KEY_PATH")
export WALG_LIBSODIUM_KEY="$LIBSODIUM_KEY"
echo "30 2 * * * wal-g backup-push $PGDATA" > /etc/crontabs/root
echo " 0 3 * * 0 wal-g delete retain FULL 4 --confirm" >> /etc/crontabs/root
exec crond -f -L /dev/stdout
```

3. `docker-compose.yml` — add `wal-g` sidecar (shares pgdata):

```yaml
  wal-g:
    image: ghcr.io/rechedev9/wal-g:3.0.8
    <<: *default-security
    env_file: .env
    environment:
      PGHOST: postgres
      PGUSER: ${PG_BACKUP_USER}
      PGPASSWORD: ${PG_BACKUP_PASSWORD}
      PGDATABASE: ${POSTGRES_DB}
      PGDATA: /var/lib/postgresql/data
      WALG_S3_PREFIX: s3://gravity-pg-prod/wal-g
      AWS_ENDPOINT: https://fsn1.your-objectstorage.com
      AWS_S3_FORCE_PATH_STYLE: 'true'
      WALG_LIBSODIUM_KEY_PATH: /etc/wal-g/libsodium.key
      WALG_LIBSODIUM_KEY_TRANSFORM: hex
      WALG_COMPRESSION_METHOD: zstd
      WALG_DELTA_MAX_STEPS: '6'
    volumes:
      - /mnt/pg-vol:/var/lib/postgresql
      - /etc/wal-g/libsodium.key:/etc/wal-g/libsodium.key:ro
    depends_on:
      postgres:
        condition: service_healthy
    networks: [gr-net]
    mem_limit: 256m
    cpus: 0.5
```

4. New workflow `.github/workflows/wal-g-restore-drill.yml` (manual
   trigger; uses `WALG_LIBSODIUM_KEY` secret stored at pre-flight). Body
   not required to be perfect right now — pasted as part of step 3.6.

5. `deploy.yml`: append `wal-g` to the services pulled by
   `docker compose pull` (no change needed — `pull` pulls all services
   in the file).

**Action — on VPS.** Two one-shots after deploy:

a. Write the libsodium key file (NOT committed to repo; manually placed):

```bash
echo -n 'PASTE_THE_64_HEX_FROM_PASSWORD_MANAGER' | sudo tee /etc/wal-g/libsodium.key >/dev/null
sudo chown root:docker /etc/wal-g/libsodium.key && sudo chmod 640 /etc/wal-g/libsodium.key
```

b. Take the initial full backup:

```bash
docker compose exec -T wal-g wal-g backup-push /var/lib/postgresql/data
docker compose exec -T wal-g wal-g backup-list
```

c. Postgres `archive_command` lands WAL segments — confirm:

```bash
docker compose exec -T postgres psql -U gravity_app -d gravity -c "SELECT pg_walfile_name(pg_current_wal_lsn());"
sleep 90
docker compose exec -T wal-g wal-g wal-show
```

The latest WAL segment should appear in `wal-show` output.

**Verification.**

```bash
docker compose exec -T wal-g wal-g backup-list | tail -5
# Expect at least one row with the date of the initial push.
```

**Rollback.** Sidecar can be removed (`docker compose rm -sf wal-g`) and
`archive_command` changed to `'/bin/true'` to stop archive errors. The
bucket retains any objects already pushed — re-running step 3.4 is idempotent
afterwards.

---

### Step 3.5 — Redis 7 → Valkey 9 (in low-traffic window) [reversible — keys are ephemeral by design]

→ 00-master §3 L6 / 04-data-pg-redis P0-3 + P0-4.

**Precondition.** Step 3.4 green. `REDIS_PASSWORD` generated and added to
`.env` (`openssl rand -base64 32 | tr -d '=+/' | cut -c1-32`).

**Action — in repo.** `docker-compose.yml` redis service:

```yaml
  redis:
    image: valkey/valkey:9-alpine
    <<: *default-security
    command:
      - valkey-server
      - --save
      - ''
      - --appendonly
      - 'no'
      - --maxmemory
      - 256mb
      - --maxmemory-policy
      - allkeys-lru
      - --requirepass
      - ${REDIS_PASSWORD}
    read_only: true
    tmpfs:
      - /data
    networks: [gr-net]
    mem_limit: 320m
    cpus: 0.5
    pids_limit: 100
    healthcheck:
      test: ['CMD', 'valkey-cli', '-a', '${REDIS_PASSWORD}', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5
```

`.env.example` and `.env.production.example`:

```
REDIS_PASSWORD=<generate-strong-random-32+chars>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
```

**Action — on VPS at deploy time.** This is a planned ~5 min window:

```bash
cd /opt/gravity-room
# Update host .env first; then deploy proceeds and recreates redis + api.
sudo nano .env   # add REDIS_PASSWORD; update REDIS_URL
# Workflow deploys; container recreated. Keys are ephemeral (rate-limit
# counters + presence sorted sets), so loss = nothing.
```

**Verification.**

```bash
ssh deploy@gr-prod 'docker exec gravity-room-redis-1 valkey-server --version'
ssh deploy@gr-prod 'docker exec gravity-room-redis-1 valkey-cli -a "$REDIS_PASSWORD" ping'
# Run an /api/auth/* burst from your laptop; confirm 429 still trips.
```

**Rollback.** Revert PR. `valkey-server` shipped a wire-compatible
protocol; the old `redis:7-alpine` image still works.

---

### Step 3.6 — First WAL-G restore drill (Phase 3 EXIT GATE) [reversible]

→ 00-master §4 Phase 3 step 15 / 04-data-pg-redis P0-6.

**Precondition.** Steps 3.1–3.5 deployed green. At least one full backup
visible in `wal-g backup-list`.

**Action.** On VPS, run the restore drill into a throwaway container.
DO NOT touch the live `postgres` service.

```bash
cd /opt/gravity-room
docker run --rm -it \
  --network gr-net \
  --env-file .env \
  -e WALG_S3_PREFIX=s3://gravity-pg-prod/wal-g \
  -e AWS_ENDPOINT=https://fsn1.your-objectstorage.com \
  -e AWS_S3_FORCE_PATH_STYLE=true \
  -v /etc/wal-g/libsodium.key:/etc/wal-g/libsodium.key:ro \
  -e WALG_LIBSODIUM_KEY_PATH=/etc/wal-g/libsodium.key \
  -e WALG_LIBSODIUM_KEY_TRANSFORM=hex \
  -v /tmp/pg-restore:/restore \
  ghcr.io/rechedev9/wal-g:3.0.8 \
  wal-g backup-fetch /restore LATEST

# Inspect:
ls /tmp/pg-restore/
# Should contain a Postgres data dir: base/, global/, pg_wal/, etc.
```

Optional bonus drill (recommended for the FIRST drill to fully prove
PITR): bring up a throwaway `postgres:18-alpine` pointing at the restored
data dir on a side network and run `SELECT count(*) FROM users;`. After
drill, `rm -rf /tmp/pg-restore`.

**Verification.** All of the following true:

- [ ] `wal-g backup-list` shows the daily push from the most recent night.
- [ ] `wal-g wal-show` shows continuous WAL segments since the last full.
- [ ] The restore drill produced a non-empty `base/` directory.
- [ ] A note added to the runbook: "Last restore drill: YYYY-MM-DD, by deploy@gr-prod, RESTORE OK."
- [ ] Calendar reminder created for the next quarterly drill (~90 days).

If any of these fail, do NOT proceed to Phase 4. Investigate.

**Rollback.** Drill is read-only against the bucket; no rollback needed.

---

### Phase 3 exit checks

- [ ] Migrations are no longer run on API boot (confirmed by grepping recent api logs).
- [ ] `SHOW shared_buffers` returns `1GB` and `archive_mode` returns `on`.
- [ ] API connects as `gravity_app`, not `postgres`.
- [ ] WAL-G has at least one full backup in the bucket and a continuous WAL stream.
- [ ] Redis image reads `valkey/valkey:9-alpine`; password set; rate limiter still functional.
- [ ] **First restore drill recorded as OK in the runbook.**

Phase 3 done.

---

# Phase 4 — Supply-chain hardening (cosign, SBOM, Trivy, osv-scanner, Tailscale SSH, userns-remap)

**Goal.** Land SLSA-baseline supply-chain controls in CI/CD and replace
the long-lived SSH key with ephemeral Tailscale nodes. Once Tailscale
SSH is proven for two consecutive deploys, close port 22 on nftables.
Finally, schedule the userns-remap downtime window and execute it.

> **Sequencing inside Phase 4 matters**: Tailscale BEFORE port 22 closes.
> userns-remap is the LAST step of Phase 4 because it forces a planned
> downtime that we don't want to incur twice.

### Step 4.1 — SHA-pin every `uses:` in `.github/workflows/*` [reversible]

→ 00-master §3 L7 / 05-cicd-observability P0-1.

**Precondition.** Operator has populated every `<SHA-LOOKUP-…>` value at
the top of this document.

**Action — in repo.** Edit every workflow under `.github/workflows/` to
replace every `uses: org/action@vX` with the resolved 40-char SHA and a
trailing `# vX.Y.Z` comment. Example for `deploy.yml`:

```yaml
- uses: actions/checkout@<SHA-LOOKUP-CHECKOUT-V5> # v5.x.y
- uses: docker/setup-buildx-action@<SHA-LOOKUP-BUILDX-V3> # v3.x.y
- uses: docker/login-action@<SHA-LOOKUP-LOGIN-V3> # v3.x.y
- uses: docker/build-push-action@<SHA-LOOKUP-BUILDPUSH-V6> # v6.x.y
- uses: actions/upload-artifact@<SHA-LOOKUP-UPLOAD-ARTIFACT-V4> # v4.x.y
- uses: actions/download-artifact@<SHA-LOOKUP-DOWNLOAD-ARTIFACT-V4> # v4.x.y
- uses: oven-sh/setup-bun@<SHA-LOOKUP-SETUP-BUN-V2> # v2.x.y
```

Apply equivalently to `validate.yml`, `claude.yml`, `claude-code-review.yml`.
`claude-code-action` is the only one that stays on a mutable tag (`@v1`)
per §8 decision 5 — Dependabot reviews each bump.

**Verification.** After merge:

```bash
git -C /home/reche/projects/TrackerRSN grep -E '^\s*-\s+uses:' .github/workflows/ \
  | grep -v -E '@[0-9a-f]{40}|anthropics/claude-code-action@v1'
# Expect empty output. Any line printed = unpinned ref left over.
```

**Rollback.** Revert PR.

---

### Step 4.2 — Cosign keyless sign in build + SBOM + provenance + Trivy + osv-scanner [reversible]

→ 00-master §3 L7 / 05-cicd-observability P0-3, P0-4, P0-5.

**Precondition.** Step 4.1 merged.

**Action — in repo.** Edit `.github/workflows/deploy.yml`. Add to
`build-images` job permissions block:

```yaml
permissions:
  contents: read
  packages: write
  id-token: write # Sigstore OIDC + attestations
  attestations: write # actions/attest-build-provenance
```

After `docker/build-push-action`, insert:

```yaml
- uses: sigstore/cosign-installer@<SHA-LOOKUP-COSIGN-V3> # v3.x.y

- name: Cosign keyless sign
  env:
    DIGEST: ${{ steps.build.outputs.digest }}
    IMAGE: ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}
  run: cosign sign --yes "${IMAGE}@${DIGEST}"

- uses: actions/attest-build-provenance@<SHA-LOOKUP-ATTEST-V2> # v2.x.y
  with:
    subject-name: ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}
    subject-digest: ${{ steps.build.outputs.digest }}
    push-to-registry: true

- uses: anchore/sbom-action@<SHA-LOOKUP-SBOM-V0> # v0 / Syft 1.20.0
  with:
    image: ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}@${{ steps.build.outputs.digest }}
    format: cyclonedx-json
    artifact-name: sbom-${{ matrix.service }}.cdx.json

- uses: aquasecurity/trivy-action@<SHA-LOOKUP-TRIVY-V0.35.0> # v0.35.0 (post-incident SHA)
  with:
    image-ref: ghcr.io/${{ github.repository_owner }}/gravity-room-${{ matrix.service }}@${{ steps.build.outputs.digest }}
    severity: HIGH,CRITICAL
    ignore-unfixed: true
    exit-code: '1'
```

> Mark the `docker/build-push-action` step with `id: build` so
> `steps.build.outputs.digest` is available to the steps above.

In a separate PR-only workflow `.github/workflows/scanners.yml` (runs on
`pull_request`), add osv-scanner against `bun.lock` and
`apps/backend/analytics/requirements.txt`:

```yaml
name: scanners
on: pull_request
permissions: { contents: read, security-events: write }
jobs:
  osv:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA-LOOKUP-CHECKOUT-V5>
      - uses: google/osv-scanner-action@<SHA-LOOKUP-OSV-V2.3.5> # v2.3.5
        with:
          scan-args: |-
            --lockfile=bun.lock
            --lockfile=requirements.txt:apps/backend/analytics/requirements.txt
            --fail-on-vuln
```

**Verification.** Push a no-op change. Confirm in GH Actions:

- `cosign sign` step succeeds for both `api` and `analytics`.
- A Sigstore Rekor URL is printed in the log.
- The `attest-build-provenance` step shows a SLSA v1.0 attestation URL.
- Trivy reports `0 fixable HIGH/CRITICAL`.
- On PR, `scanners.yml` reports clean.

On the registry side:

```bash
# Locally:
cosign verify ghcr.io/rechedev9/gravity-room-api@sha256:<digest> \
  --certificate-identity-regexp '^https://github.com/rechedev9/TrackerRSN/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
# Should print a JSON payload + "Verification for ... succeeded".
```

**Rollback.** Revert PR.

---

### Step 4.3 — Cosign verify gate on the VPS (and digest pinning in compose) [reversible]

→ 00-master §3 L7 / 05-cicd-observability P0-3 + P2-1.

**Precondition.** Step 4.2 merged + green; at least one image pair built

- signed.

**Action — on VPS, one-time.** Install cosign:

```bash
COSIGN_VERSION=v2.4.0   # confirm latest on day of run
sudo curl -fsSL -o /usr/local/bin/cosign \
  "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64"
sudo chmod +x /usr/local/bin/cosign
cosign version
```

**Action — in repo.** Add a "Verify signatures" step to `deploy.yml`,
after `Validate VPS env` and before `Run migrations`:

```yaml
- name: Verify image signatures on VPS
  env:
    VPS_USER: ${{ secrets.VPS_USER }}
    VPS_HOST: ${{ secrets.VPS_HOST }}
    IMAGE_TAG: ${{ github.sha }}
    OWNER: ${{ github.repository_owner }}
  run: |
    ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new \
      "${VPS_USER}@${VPS_HOST}" bash <<EOF
    set -euo pipefail
    for svc in api analytics; do
      img="ghcr.io/${OWNER}/gravity-room-\${svc}:${IMAGE_TAG}"
      cosign verify "\${img}" \
        --certificate-identity-regexp "^https://github.com/${OWNER}/TrackerRSN/" \
        --certificate-oidc-issuer https://token.actions.githubusercontent.com \
        >/dev/null
      echo "✓ verified \${img}"
    done
    EOF
```

Once verified to work, **switch `docker-compose.yml` to pin by digest**
in a follow-up commit:

```yaml
api:
  image: ghcr.io/rechedev9/gravity-room-api@sha256:${API_DIGEST}
analytics:
  image: ghcr.io/rechedev9/gravity-room-analytics@sha256:${ANALYTICS_DIGEST}
```

Wire `deploy.yml` to inject `API_DIGEST` and `ANALYTICS_DIGEST` from the
`build-images` matrix outputs.

**Verification.** Deploy a no-op. Logs should show `✓ verified
ghcr.io/.../gravity-room-api:<sha>` before migrations run. Try a poisoned
local push (manually pulled image without a Rekor entry) to a staging tag
and confirm the verify step rejects it.

**Rollback.** Revert the verify-step PR. The signed images keep being
produced but the gate is removed.

---

### Step 4.4 — Rollback pointer on the VPS [reversible]

→ 00-master §3 L7 / 05-cicd-observability P0-6.

**Precondition.** Step 4.3 merged.

**Action — in repo.** In `deploy.yml`, inside the `Pull images and
restart stack` step, before the `docker compose pull` line, write the
rollback pointer:

```bash
cd /opt/gravity-room
[ -f .image_tag ] && cp .image_tag .image_tag.prev
echo "$IMAGE_TAG" > .image_tag
```

Add `scripts/rollback.sh` to the repo (rsynced alongside `Caddyfile`):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/gravity-room
if [ ! -f .image_tag.prev ]; then echo "no previous tag"; exit 1; fi
PREV=$(cat .image_tag.prev)
CURR=$(cat .image_tag)
echo "rolling back: $CURR → $PREV"
# swap pointers, re-pull, recycle stack
mv .image_tag .image_tag.curr
mv .image_tag.prev .image_tag
mv .image_tag.curr .image_tag.prev
export IMAGE_TAG="$PREV"
docker compose pull
docker compose up -d --remove-orphans
```

**Verification.** After next deploy:

```bash
ssh deploy@gr-prod 'ls /opt/gravity-room/.image_tag*'
```

Expected both `.image_tag` and `.image_tag.prev` exist with different SHAs.

Test rollback in a low-traffic window:

```bash
ssh deploy@gr-prod 'cd /opt/gravity-room && ./scripts/rollback.sh'
ssh deploy@gr-prod 'docker compose ps && cat .image_tag'
# Forward-roll by re-running the most recent green deploy.
```

**Rollback.** Revert PR; remove pointer files on VPS.

---

### Step 4.5 — Tailscale SSH from GHA (replaces `VPS_SSH_KEY`) [irreversible — VPS_SSH_KEY decommissioned at end]

→ 00-master §3 L7 + §8 decision 2 / 05-cicd-observability P0-2.

**Precondition.** Pre-flight checklist Tailscale items complete:

- Tailnet ACL has `tag:ci → tag:prod-vps:22` only.
- VPS has Tailscale installed and tagged `tag:prod-vps`.
- GH secrets `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`.

Install Tailscale on the VPS once:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey tskey-auth-<bootstrap> --advertise-tags tag:prod-vps --ssh
```

(Use a bootstrap auth key for the initial join; `--ssh` enables tailnet
SSH. Confirm the host shows up in your tailnet with the `tag:prod-vps`
tag.)

**Action — in repo.** Edit `deploy.yml` deploy job. Replace the
`Configure SSH` step with:

```yaml
- uses: tailscale/github-action@<SHA-LOOKUP-TAILSCALE-V4> # v4.x.y
  with:
    oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
    oauth-secret: ${{ secrets.TS_OAUTH_SECRET }}
    tags: tag:ci

- name: Configure SSH known_hosts (Tailscale)
  env:
    VPS_HOST: gr-prod # tailnet hostname, NOT 178.105.107.25
  run: |
    mkdir -p ~/.ssh
    ssh-keyscan -t ed25519 -H "$VPS_HOST" >> ~/.ssh/known_hosts 2>/dev/null
    chmod 644 ~/.ssh/known_hosts
```

Replace every subsequent `ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_HOST}"`
with `ssh "${VPS_USER}@${VPS_HOST}"` — the Tailscale-action runner has
been authenticated via short-lived OIDC, so SSH key material is not
needed.

Update `VPS_HOST` secret to the tailnet hostname (`gr-prod`) rather than
the public IP.

**Verification.** Trigger a deploy. Confirm:

- The Tailscale action step lists the runner as ephemeral, tagged `tag:ci`.
- `ssh deploy@gr-prod` succeeds without an `id_ed25519` file present.
- The deploy completes green.

Run two consecutive deploys to prove the path. **Then, and only then**,
delete the `VPS_SSH_KEY` GitHub secret and the matching authorized_keys
entry on the VPS:

```bash
sudo sed -i '/COMMENT_FROM_GHA_KEY/d' /home/deploy/.ssh/authorized_keys
```

**Rollback.** Re-add the long-lived key + secret if Tailscale auth fails;
this is the break-glass mechanism noted in `00-master §7`.

---

### Step 4.6 — Close port 22 on nftables [reversible]

→ 00-master §3 L2 + §8 decision 2.

**Precondition.** Step 4.5 has produced two consecutive green Tailscale
deploys. The user has Tailscale SSH working from their laptop
(`tailscale ssh deploy@gr-prod` succeeds).

**Action — on VPS.** Edit `/etc/nftables.conf` and remove the `tcp dport
22 accept` line:

```diff
-        tcp dport 22 accept   comment "SSH — closes in Phase 4 after Tailscale"
```

Apply:

```bash
sudo nft -c -f /etc/nftables.conf
sudo systemctl restart nftables
```

**Verification.** From your laptop:

```bash
nc -zvw3 178.105.107.25 22       # MUST fail
tailscale ssh deploy@gr-prod uptime   # MUST succeed
```

Trigger a deploy — must still succeed via Tailscale.

**Rollback.** Re-add the rule and `systemctl restart nftables`.

---

### Step 4.7 — Docker `userns-remap` rollout (planned downtime, ~15 min) [irreversible — re-chown of /var/lib/docker]

→ 00-master §3 L4 + §8 decision 3.

**Precondition.** User has confirmed the downtime window. Tailscale SSH
working (step 4.5). WAL-G has a fresh backup pushed within the last 24h.
Hetzner Volume snapshot taken within the last 24h.

**Action — on VPS, during the window.**

1. Announce maintenance (UptimeRobot ack):

```bash
# Optional: UptimeRobot pause via API (Phase 5 dependency — skip if not yet installed).
```

2. Stop the stack:

```bash
cd /opt/gravity-room
docker compose down
```

3. Edit `/etc/docker/daemon.json` to include `userns-remap`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3", "compress": "true" },
  "live-restore": true,
  "userns-remap": "default"
}
```

4. Restart Docker (NOT `reload` — userns-remap requires a full restart
   and a re-chown of `/var/lib/docker`):

```bash
sudo systemctl restart docker
# Docker will re-chown /var/lib/docker on first start.
# This is the longest single operation of the window (~5–10 min on this size).
```

5. Bring the stack back up:

```bash
docker compose pull
docker compose --profile migrate run --rm migrate
docker compose up -d
```

6. Confirm `/mnt/pg-vol` ownership: Postgres data dir is on a Hetzner
   Volume mount — userns-remap maps container UIDs to a subuid range
   (default 100000+). The bind mount UIDs must be re-chowned to match.

```bash
# Inspect: which subuid range Docker chose
grep dockremap /etc/subuid
# Re-chown the postgres data dir to match the remapped postgres UID (70 inside container → 100070 host)
sudo chown -R 100070:100070 /mnt/pg-vol/data
```

> Hand-verify the in-container postgres UID first: it's `70` on
> `postgres:18-alpine` (alpine UID for `postgres`). Confirm with
> `docker run --rm postgres:18-alpine id postgres` BEFORE the window starts
> and adjust the host subuid offset.

7. Start postgres and watch logs:

```bash
docker compose up -d postgres
docker compose logs -f postgres
# Wait for `database system is ready to accept connections`.
docker compose up -d
```

**Verification.**

```bash
ssh deploy@gr-prod 'docker info -f "{{.SecurityOptions}}"'
# Must include `name=userns`.

ssh deploy@gr-prod 'docker compose ps'
# All services Up (healthy).

curl -fsS https://api.gravityroom.app/health
```

**Rollback.** Remove `userns-remap` from `daemon.json`, restart docker.
Re-chown `/mnt/pg-vol/data` back to UID 70:70 (the in-container postgres
UID without remap). If this also fails, restore the most recent
Hetzner Volume snapshot, or restore from WAL-G into a freshly created
volume.

---

### Phase 4 exit checks

- [ ] Every workflow `uses:` is SHA-pinned (except `claude-code-action@v1`).
- [ ] At least one production deploy completed with cosign verify gate green.
- [ ] `cosign verify` from a laptop succeeds against current API + analytics digests.
- [ ] Long-lived `VPS_SSH_KEY` secret deleted from GH. `~/deploy/.ssh/authorized_keys` no longer contains the GHA key entry.
- [ ] External port-22 probe of `gr-prod` fails.
- [ ] `docker info` shows `name=userns` under `SecurityOptions`.

Phase 4 done.

---

# Phase 5 — Observability (metrics, logs, uptime probes, Dependabot, CodeQL)

**Goal.** Ship metrics + logs to Grafana Cloud Free, set up external uptime
probes with Telegram alerting, enable Dependabot + CodeQL. Everything is
€0/mo additional and runtime-only.

### Step 5.1 — `grafana-alloy` on VPS scraping `/metrics`, node, cAdvisor → Grafana Cloud [reversible]

→ 00-master §3 L8 / 05-cicd-observability P1-2 + P1-3.

**Precondition.** Phase 4 complete. Grafana Cloud Free credentials in
`/opt/gravity-room/.env.alloy` (chmod 600).

**Action — on VPS.** Alloy installed as a host systemd unit (NOT a
container — it scrapes cAdvisor + node-exporter and needs host privileges
for cgroup metrics, which fights userns-remap).

```bash
# Install Alloy
curl -fsSL https://github.com/grafana/alloy/releases/latest/download/alloy-linux-amd64.zip -o /tmp/alloy.zip
sudo unzip /tmp/alloy.zip -d /usr/local/bin/
sudo chmod +x /usr/local/bin/alloy-linux-amd64
sudo mv /usr/local/bin/alloy-linux-amd64 /usr/local/bin/alloy

# Install node-exporter + cAdvisor as containers (without root inside)
docker run -d --name=node-exporter --restart=unless-stopped --net=host --pid=host \
  -v "/:/host:ro,rslave" prom/node-exporter:latest \
  --path.rootfs=/host

docker run -d --name=cadvisor --restart=unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -v /:/rootfs:ro -v /var/run:/var/run:ro -v /sys:/sys:ro \
  -v /var/lib/docker/:/var/lib/docker:ro -v /dev/disk/:/dev/disk:ro \
  gcr.io/cadvisor/cadvisor:latest
```

Write `/etc/alloy/config.alloy`:

```alloy
prometheus.remote_write "grafana" {
  endpoint {
    url = "https://prometheus-prod-XX-XXX.grafana.net/api/prom/push"
    basic_auth { username = sys.env("GC_PROM_USERNAME"); password = sys.env("GC_PROM_PASSWORD") }
  }
}

prometheus.scrape "api" {
  targets = [{ "__address__" = "127.0.0.1:443", "__metrics_path__" = "/metrics" }]
  scrape_interval = "30s"
  honor_labels = true
  authorization { type = "Bearer"; credentials = sys.env("METRICS_TOKEN") }
  scheme = "https"
  forward_to = [prometheus.remote_write.grafana.receiver]
}

prometheus.exporter.unix "node" { }
prometheus.scrape "node" {
  targets = prometheus.exporter.unix.node.targets
  forward_to = [prometheus.remote_write.grafana.receiver]
}

prometheus.scrape "cadvisor" {
  targets = [{ "__address__" = "127.0.0.1:8080" }]
  forward_to = [prometheus.remote_write.grafana.receiver]
}

loki.write "grafana" {
  endpoint {
    url = "https://logs-prod-XXX.grafana.net/loki/api/v1/push"
    basic_auth { username = sys.env("GC_LOKI_USERNAME"); password = sys.env("GC_LOKI_PASSWORD") }
  }
}

loki.source.docker "containers" {
  host = "unix:///var/run/docker.sock"
  targets = [{ "__path__" = "/var/lib/docker/containers/*/*.log" }]
  forward_to = [loki.write.grafana.receiver]
}
```

Systemd unit `/etc/systemd/system/alloy.service`:

```ini
[Unit]
Description=Grafana Alloy
After=network.target docker.service

[Service]
EnvironmentFile=/opt/gravity-room/.env.alloy
ExecStart=/usr/local/bin/alloy run /etc/alloy/config.alloy
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now alloy
sudo systemctl status alloy
```

**Verification.** In Grafana Cloud, query:

- `up{job="api"}` → 1.
- `node_cpu_seconds_total` → present.
- `{container_name="gravity-room-api-1"}` in Loki → recent log lines.

**Rollback.** `sudo systemctl disable --now alloy node-exporter cadvisor && docker rm -f node-exporter cadvisor`.

---

### Step 5.2 — UptimeRobot Free monitors + Telegram alerts [reversible]

→ 00-master §3 L8 / 05-cicd-observability P1-1.

**Precondition.** UptimeRobot account exists, Telegram bot already
configured.

**Action — in UptimeRobot UI** (no repo change):

- Monitor 1: HTTPS GET `https://gravityroom.app/` — 5 min interval — expect 200.
- Monitor 2: HTTPS GET `https://api.gravityroom.app/health` — 5 min — expect 200.
- Monitor 3: HTTPS GET `https://api.gravityroom.app/metrics` with Authorization header `Bearer <METRICS_TOKEN>` — 5 min — expect 200. **Purpose**: catches token rotation breakage. Add to a private "ignore body" monitor type.

Configure the Telegram alert contact at the existing
`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`. Test by pausing/unpausing
one monitor.

**Verification.** Receive a Telegram test alert.

**Rollback.** Delete monitors in UptimeRobot UI.

---

### Step 5.3 — Dependabot + CodeQL [reversible]

→ 00-master §3 L7 / 05-cicd-observability P1-4 + P1-5.

**Precondition.** Step 4.1 complete (workflows SHA-pinned).

**Action — in repo.** New `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
    groups:
      actions: { patterns: ['*'] }
    cooldown: { default-days: 3 }

  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    groups:
      bun: { patterns: ['*'], update-types: [minor, patch] }
    cooldown: { default-days: 3 }

  - package-ecosystem: pip
    directory: /apps/backend/analytics
    schedule: { interval: weekly }

  - package-ecosystem: docker
    directory: /apps/backend/api
    schedule: { interval: weekly }

  - package-ecosystem: docker
    directory: /apps/backend/analytics
    schedule: { interval: weekly }
```

New `.github/workflows/codeql.yml`:

```yaml
name: CodeQL
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
  schedule:
    - cron: '0 6 * * 1'
permissions:
  actions: read
  contents: read
  security-events: write
jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - { language: javascript-typescript, build-mode: none }
          - { language: python,                build-mode: none }
    steps:
      - uses: actions/checkout@<SHA-LOOKUP-CHECKOUT-V5>
      - uses: github/codeql-action/init@<SHA-LOOKUP-CODEQL-V3>
        with: { languages: ${{ matrix.language }}, build-mode: ${{ matrix.build-mode }} }
      - uses: github/codeql-action/analyze@<SHA-LOOKUP-CODEQL-V3>
```

**Verification.** Within ~24h, the Security tab shows CodeQL alerts (or
zero, ideally). Dependabot opens its first batch of PRs within a week.

**Rollback.** Delete the files.

---

### Phase 5 exit checks

- [ ] Grafana Cloud dashboard shows live `up` series for `api` job and live container logs.
- [ ] UptimeRobot Telegram test alert received.
- [ ] CodeQL Security tab is populated.
- [ ] Dependabot has produced at least one PR by week's end.

Phase 5 done.

---

# Phase 6 — Opportunistic P2 follow-ups (no fixed schedule)

Land each when convenient. No coupling between items.

- **6.1 — Postgres → `postgres:18-bookworm`** ([00-master §3 L6 / 03-containers-runtime P2-3](./03-containers-runtime.md)). Image-size +160 MB; better extension support. Scheduled rebuild → deploy → confirm. Same compose service definition.
- **6.2 — CSP `strict-dynamic` + nonce** ([02-edge-caddy P2-10](./02-edge-caddy.md)). Requires Vite SSR/post-build nonce injection. Add `report-uri` to Sentry.
- **6.3 — `caddy-coraza` WAF** ([02-edge-caddy P2-11](./02-edge-caddy.md)). Only when rate-limit telemetry shows targeted attack patterns. Adds CPU.
- **6.4 — `pg_stat_statements` + Postgres exporter** ([04-data-pg-redis P2-2](./04-data-pg-redis.md)). Wire to the Alloy scrape config.
- **6.5 — ssh-audit pass + tighter KexAlgorithms** ([01-host-os P1-7](./01-host-os.md)). Defer until ssh-audit reports a finding worth fixing.
- **6.6 — Minimal auditd ruleset** ([01-host-os P2-10](./01-host-os.md)). Watch `/etc/ssh/sshd_config`, `/etc/sudoers`, `/etc/docker/daemon.json`, `/opt/gravity-room/.env`.
- **6.7 — `journald SystemMaxUse=500M`** ([01-host-os P2-11](./01-host-os.md)). One-line drop-in.
- **6.8 — Per-table autovacuum overrides on `workout_results` + `undo_entries`** ([04-data-pg-redis P1-5](./04-data-pg-redis.md)). One migration:

```sql
ALTER TABLE workout_results SET (
  autovacuum_vacuum_scale_factor  = 0.02,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit    = 2000
);
ALTER TABLE undo_entries SET (
  autovacuum_vacuum_scale_factor  = 0.02,
  autovacuum_analyze_scale_factor = 0.05
);
```

- **6.9 — Valkey ACL file** ([04-data-pg-redis P1-7](./04-data-pg-redis.md)). Add only if we add a JWT denylist or auth throttle keyspace.
- **6.10 — Deploy by `@sha256:<digest>` only** ([05-cicd-observability P2-1](./05-cicd-observability.md)). Already done in step 4.3.

---

## Verification matrix (one-shot post-rollout)

Run after Phase 5 closes. Each command should print the expected line (or
similar). Save the output to `docs/runbooks/post-rollout-verification.txt`
along with the date.

```bash
# 1. Host hardening
ssh deploy@gr-prod 'sshd -T | grep -iE "^(permitrootlogin|passwordauthentication) "'
# permitrootlogin no
# passwordauthentication no

ssh deploy@gr-prod 'sysctl -n net.ipv4.tcp_syncookies kernel.kptr_restrict fs.protected_symlinks'
# 1
# 2
# 1

ssh deploy@gr-prod 'systemctl is-active unattended-upgrades fail2ban nftables alloy'
# active x4

ssh deploy@gr-prod 'docker info -f "{{.LiveRestoreEnabled}} {{.SecurityOptions}}"'
# true [name=apparmor name=seccomp ... name=userns]

# 2. Network surface
nc -zvw3 178.105.107.25 22       # MUST fail
nc -zvw3 178.105.107.25 5432     # MUST fail
nc -zvw3 178.105.107.25 6379     # MUST fail
nc -zvw3 178.105.107.25 443      # MUST succeed

# 3. Edge headers
curl -sSI https://gravityroom.app/ | grep -iE '^(strict-transport-security|cross-origin-opener-policy|cross-origin-resource-policy|permissions-policy|content-security-policy):'

# 4. Containers
ssh deploy@gr-prod 'for c in caddy api analytics postgres redis; do docker inspect gravity-room-$c-1 --format "$c: cap_drop={{.HostConfig.CapDrop}} no-new-priv={{index .HostConfig.SecurityOpt 0}} ro={{.HostConfig.ReadonlyRootfs}} user={{.Config.User}}"; done'
# caddy:     CapDrop=[ALL] cap_add=[NET_BIND_SERVICE] ReadonlyRootfs=true
# api:       cap_drop=[ALL] no-new-priv user=1000:1000
# analytics: cap_drop=[ALL] no-new-priv user=10001:10001
# postgres:  cap_drop=[ALL] no-new-priv
# redis:     cap_drop=[ALL] no-new-priv ReadonlyRootfs=true

# 5. Data layer
ssh deploy@gr-prod 'docker compose exec -T postgres psql -U gravity_app -d gravity -c "SHOW shared_buffers; SHOW archive_mode; SHOW io_method;"'
# shared_buffers=1GB, archive_mode=on, io_method=worker

ssh deploy@gr-prod 'docker compose exec -T wal-g wal-g backup-list | tail -3'
# At least one row dated within the last 24h.

ssh deploy@gr-prod 'docker exec gravity-room-redis-1 valkey-server --version | head -1'
# Valkey 9.x.y …

# 6. Supply chain
cosign verify ghcr.io/rechedev9/gravity-room-api@sha256:$(ssh deploy@gr-prod 'docker inspect gravity-room-api-1 --format "{{index .RepoDigests 0}}" | cut -d@ -f2') \
  --certificate-identity-regexp '^https://github.com/rechedev9/TrackerRSN/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# 7. Observability
curl -fsS https://gravityroom.app/         | head -1   # 200 — uptime probe target
curl -fsS https://api.gravityroom.app/health
# Verify Grafana Cloud dashboard "Gravity Room — Infra" loads with non-empty panels.

# 8. Restore drill log
grep "RESTORE OK" docs/runbooks/restore-drill.log | tail -3
```

If any line in §1–7 fails, that step's `Rollback` section is the immediate
remediation; raise a ticket for root-cause analysis afterwards.

---

## Open at end (intentionally unfinished)

- **Phase 6 P2 items** — owner: user, no fixed schedule. The runbook in
  `docs/runbooks/` should be the place these are picked up from.
- **userns-remap subuid offset hardening** — Step 4.7 uses the Docker
  default. Tighter subuid policy (CIS Docker Benchmark §2.8) requires a
  custom map; defer until any compliance ask materialises.
- **Distributed rate-limit storage in Valkey** — research called out, but
  with a single Caddy node in-memory is correct. Switch when adding a
  second edge node (would require revisiting the €15 cap).
- **CSP `strict-dynamic` + nonce** — Phase 6.2. Requires a Vite-side
  change that the SPA team has not scoped.
- **Quarterly restore-drill calendar reminder** — owner: user. Phase 3.6
  set the first reminder; future drills are user-driven until automated
  in Phase 6.4.
- **Hetzner Cloud price reviews** — repriced at €15 ceiling on 2026-05-11;
  re-check after each Hetzner adjustment notice (current next due 2027-04).
