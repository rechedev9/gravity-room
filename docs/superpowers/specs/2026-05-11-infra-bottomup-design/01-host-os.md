# Host & OS hardening — research (2026-05-11)

> Scope: a single-VPS Gravity Room stack on Hetzner Cloud (`gr-prod`,
> 178.105.107.25). All services run under docker compose on the same host.
> €15/mo ceiling. No Cloudflare, no Railway. Caddy terminates TLS on 80/443;
> API/analytics/Postgres/Redis are container-internal.

## Verified versions (as of 2026-05-11)

- **Ubuntu LTS — recommend 24.04 LTS "Noble Numbat"**. 24.04 standard support
  runs to May 2029; 26.04 "Resolute Raccoon" released 2026-04-23 with support
  to May 2031, but is < 1 month old and not yet considered "battle-tested" for
  prod. (Source: <https://ubuntu.com/about/release-cycle>,
  <https://documentation.ubuntu.com/release-notes/26.04/>)
- **Docker Engine 29.4.3** (released 2026-05-06). Carries fixes for
  CVE-2026-31431 (AF_ALG seccomp/LSM), CVE-2026-34040 (AuthZ bypass),
  CVE-2026-33997 (plugin install privilege), CVE-2026-33748/33747 (BuildKit).
  (Source: <https://docs.docker.com/engine/release-notes/29/>)
- **OpenSSH 10.3p1** (released 2026-04-02). Fixes shell-injection in Match
  exec, principal-matching bypass, ECDSA algorithm-list gaps, ProxyJump
  validation. (Source: <https://www.openssh.org/releasenotes.html>)
- **fail2ban 1.1.x** — actively maintained on GitHub, latest activity
  2026-04-11; `1.1.1.beta0` tracked in Debian. Still the cheapest, smallest
  on-box jail engine for SSH. (Source:
  <https://github.com/fail2ban/fail2ban/releases>,
  <https://tracker.debian.org/pkg/fail2ban>)
- **CrowdSec 1.6.x** — actively maintained alternative with community
  block-list ("crowd intelligence"). Heavier (Go agent + LAPI + bouncer)
  than fail2ban; trade resource cost for pre-emptive blocking.
  (Source: <https://www.crowdsec.net/blog/crowdsec-not-your-typical-fail2ban-clone>)

## Current state in /opt/gravity-room (inferred from repo)

What the repo tells us (`docker-compose.yml`, `.github/workflows/deploy.yml`):

- All containers on one user-defined bridge `gr-net`; only `caddy` publishes
  ports (80/443). API/analytics/Postgres/Redis are not host-exposed.
- Postgres data lives on a separate Hetzner Volume mounted at `/mnt/pg-vol`
  — already best practice (lifecycle/snapshots independent of root disk).
- Deploy is GH Actions → SSH → rsync → `docker compose pull && up -d` via
  a long-lived ed25519 key in secret `VPS_SSH_KEY`.

What the repo does **not** confirm and we should not assume (cannot SSH from
this agent — synthesiser must verify on-box):

- Whether SSH is on default port 22 or moved; whether `PasswordAuthentication`
  is disabled; whether root login is permitted.
- Whether **ufw / nftables / fail2ban / unattended-upgrades / auditd /
  AppArmor** are installed and active.
- Whether the GH Actions SSH user is a non-root account with limited sudo,
  or root.
- `docker info` security options (userns-remap, live-restore, log rotation,
  cgroup driver).
- Kernel sysctl values (`net.ipv4.tcp_syncookies`, `rp_filter`,
  `kptr_restrict`, etc.).
- Whether the Volume is encrypted (Hetzner Volumes are not encrypted by
  default — needs LUKS on top).

## Gaps vs official best practice

1. **Public SSH on long-lived key in CI secret** — single credential, blast
   radius = entire host. Mitigation: Tailscale tailnet OR a short-lived
   deploy key minted per run, plus fail2ban/CrowdSec.
2. **Docker + UFW interaction** — if UFW is enabled today, Docker's
   `iptables` NAT rules bypass UFW chains for any published port, so any
   future `ports: -` mapping silently goes public. Mitigation documented
   below.
3. **No evidence of unattended-upgrades** — without it, kernel/openssl/glibc
   CVEs accumulate.
4. **No evidence of userns-remap / rootless Docker** — container root == host
   root if a container breakout happens.
5. **No evidence of log rotation on json-file driver** — unbounded container
   logs can fill the root disk and take Caddy down.
6. **No evidence of swap, journald limits, fs.protected\_\* sysctls**.

## Concrete recommendations

### P0 — do before next deploy

1. **Disable public SSH password auth, root login, and lower MaxAuthTries.**
   In `/etc/ssh/sshd_config.d/99-hardening.conf`:
   `PermitRootLogin no`, `PasswordAuthentication no`,
   `KbdInteractiveAuthentication no`, `MaxAuthTries 3`,
   `LoginGraceTime 30`, `AllowUsers <deploy-user>`, `X11Forwarding no`,
   `AllowAgentForwarding no`, `AllowTcpForwarding no`,
   `ClientAliveInterval 300 / ClientAliveCountMax 2`.
   _Why:_ the GH Actions key is long-lived; brute force + protocol weakness
   are the dominant SSH risks. Source:
   <https://man.openbsd.org/sshd_config>.

2. **Enable unattended-upgrades for security pocket with reboot at 04:00.**
   `apt install unattended-upgrades update-notifier-common`; in
   `/etc/apt/apt.conf.d/50unattended-upgrades` set
   `Unattended-Upgrade::Automatic-Reboot "true";` and
   `Unattended-Upgrade::Automatic-Reboot-Time "04:00";`. Leave only the
   `-security` origin enabled to avoid drift from `-updates`.
   _Why:_ this is the single highest-ROI hardening control on a one-VPS
   stack. Source:
   <https://ubuntu.com/server/docs/how-to/software/automatic-updates/>.

3. **Add log rotation to Docker daemon and turn on `live-restore`.**
   `/etc/docker/daemon.json`:

   ```json
   {
     "log-driver": "json-file",
     "log-opts": { "max-size": "10m", "max-file": "3", "compress": "true" },
     "live-restore": true
   }
   ```

   _Why:_ prevents disk-fill from runaway logs (Caddy access logs in
   particular); `live-restore` keeps API/Postgres serving traffic while the
   daemon restarts during a patch. Source:
   <https://docs.docker.com/config/containers/logging/json-file/>,
   <https://docs.docker.com/engine/daemon/live-restore/>.

4. **Lock the host firewall to 22 (or 2222), 80, 443 only — and use
   nftables, not UFW.** Docker's iptables NAT bypasses UFW for any published
   port, so UFW gives a false sense of security as soon as anyone adds a
   `ports:` line to compose. nftables-as-backend is supported via Docker 29
   `firewall-backend: nftables`. Even with the default iptables backend,
   raw nftables on the host is the documented escape hatch.
   _Why:_ Docker docs explicitly warn that UFW does not block published
   container ports. Sources:
   <https://docs.docker.com/engine/network/packet-filtering-firewalls/>,
   <https://docs.docker.com/engine/network/firewall-nftables/>.

### P1 — within 2 weeks

5. **Install fail2ban with a tuned sshd jail.** maxretry=3, findtime=10m,
   bantime=1h, ignoreself=true. Don't switch to CrowdSec yet — for one
   public-facing service (SSH) on one box, fail2ban is the documented
   minimum-resource fit; CrowdSec's value is in fleet-wide intel and we
   have a fleet of one. Revisit if we add a second VPS.
   Sources: <https://github.com/fail2ban/fail2ban>,
   <https://www.crowdsec.net/blog/crowdsec-not-your-typical-fail2ban-clone>.

6. **Apply a small kernel sysctl set** in `/etc/sysctl.d/99-hardening.conf`:
   - `net.ipv4.tcp_syncookies = 1`
   - `net.ipv4.conf.all.rp_filter = 1` / `default.rp_filter = 1`
   - `net.ipv4.conf.all.accept_redirects = 0` (+ `default`)
   - `net.ipv4.conf.all.send_redirects = 0`
   - `net.ipv4.conf.all.accept_source_route = 0`
   - `net.ipv4.icmp_echo_ignore_broadcasts = 1`
   - `net.ipv4.icmp_ignore_bogus_error_responses = 1`
   - `net.ipv4.conf.all.log_martians = 1`
   - `kernel.kptr_restrict = 2`
   - `kernel.dmesg_restrict = 1`
   - `fs.protected_hardlinks = 1`, `fs.protected_symlinks = 1`
   - `fs.protected_fifos = 2`, `fs.protected_regular = 2`

   Sources: <https://docs.kernel.org/networking/ip-sysctl.html>,
   <https://www.kernel.org/doc/html/latest/admin-guide/sysctl/kernel.html>.

7. **Run ssh-audit against the host** and apply its hardening guide for
   Ubuntu 24.04 (regenerates moduli, restricts KexAlgorithms / Ciphers /
   MACs / HostKeyAlgorithms to the modern subset incl.
   `sntrup761x25519-sha512@openssh.com`).
   Source: <https://github.com/jtesta/ssh-audit>.

8. **Enable Docker `userns-remap` ("default" user) on this host.** Maps
   container root → unprivileged host UID, so a Postgres/Redis breakout
   can't read the rest of the filesystem. Caveat: must be enabled on a
   clean Docker state — existing images/containers become inaccessible
   under the new namespace. Plan it as part of the next prod refresh, not
   a hot patch. Source:
   <https://docs.docker.com/engine/security/userns-remap/>.

### P2 — opportunistic

9. **Tailscale tailnet for admin SSH; close 22 to the public internet.**
   GH Actions stays via short-lived OIDC + tailscale-action runner, or
   keep 22 open behind fail2ban + key-only as a fallback. Removes the
   single largest internet-facing attack surface.
   Source: <https://tailscale.com/docs/features/tailscale-ssh>.

10. **Minimal auditd ruleset** — watch
    `/etc/ssh/sshd_config`, `/etc/sudoers`, `/etc/passwd`, `/etc/shadow`,
    `/etc/docker/daemon.json`, `/opt/gravity-room/.env`. Keep it small;
    auditd's overhead is proportional to rule count.
    Source (community curated, no single Ubuntu official ruleset):
    <https://github.com/Neo23x0/auditd>.

11. **Set journald + logrotate caps** —
    `SystemMaxUse=500M` in `/etc/systemd/journald.conf`, swap (1–2 GB on
    Hetzner CX), `dmesg_restrict` already covered above.

12. **AppArmor**: shipped enabled by default on Ubuntu LTS; verify
    `aa-status` shows the `docker-default` profile loaded for our
    containers. No action needed unless this check fails.

### Sizing & disk

Current Hetzner Cloud relevant SKUs (post 2026-04-01 price adjustment):

- **CX22** (2 vCPU Intel, 4 GB RAM, 40 GB NVMe) ~ €4.49/mo
- **CX32** (4 vCPU, 8 GB, 80 GB) ~ €6.80/mo
- **CPX21** (3 AMD vCPU, 4 GB, 80 GB) — better CPU for Bun+Postgres
- **Volume**: ~€0.044/GB/mo — `/mnt/pg-vol` already on one
- **Object Storage**: ~€6.49/mo base (1 TB storage + 1 TB egress
  included), S3-compatible, three EU locations.

Recommendation: stay on CX/CPX-class shared-vCPU; move to Object Storage
only when we need offsite Postgres base backups (`pg_basebackup` →
restic → s3 bucket). At our €15/mo ceiling this leaves headroom for
backups but not for a second VM.

Sources: <https://www.hetzner.com/cloud/regular-performance>,
<https://www.hetzner.com/news/new-cx-plans/>,
<https://www.hetzner.com/storage/object-storage/>,
<https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/>.

### Network surface / DDoS posture

Hetzner ships free upstream DDoS protection on all Cloud servers using
Arbor + Juniper hardware with filter signatures for DNS/NTP reflection,
SYN/UDP floods, and challenge-response on suspect flows. At our scale
this is sufficient — we do not need Cloudflare in front for L3/L4. L7
protection (rate limiting, bot mitigation) must come from Caddy itself
(out of scope for this teammate; covered by edge research).
Source: <https://www.hetzner.com/unternehmen/ddos-schutz>.

## Open questions for synthesiser

- **OS choice — pin 24.04 or jump to 26.04?** Recommend 24.04 LTS through
  at least Q4 2026 (26.04 is < 30 days old); revisit at 26.04.1 point
  release.
- **Tailscale yes/no?** Strong technical recommendation yes; cost = $0 on
  Personal plan for ≤3 users + 100 devices; trade-off = extra dependency
  outside our hosting provider.
- **userns-remap migration window?** Needs a planned downtime — Postgres
  data path is on a Volume so it survives, but image/volume UIDs need a
  one-shot chown. Owner decides when.
- **fail2ban now, CrowdSec later** — agree, or invest in CrowdSec immediately
  given multi-region community feed? Cost: ~50–80 MB extra RAM, one more
  systemd unit.
- **Encrypt `/mnt/pg-vol` with LUKS?** Hetzner Volumes are not encrypted at
  rest by default. Threat model: physical disk recycling at Hetzner. LUKS
  adds key-management complexity (initramfs unlock or remote-unlock); may
  not be worth it for a single hobby-scale product.

## Sources

- <https://ubuntu.com/about/release-cycle>
- <https://documentation.ubuntu.com/release-notes/26.04/>
- <https://ubuntu.com/server/docs/how-to/software/automatic-updates/>
- <https://help.ubuntu.com/community/UFW>
- <https://docs.docker.com/engine/release-notes/29/>
- <https://docs.docker.com/engine/security/>
- <https://docs.docker.com/engine/security/userns-remap/>
- <https://docs.docker.com/engine/security/rootless/>
- <https://docs.docker.com/engine/daemon/live-restore/>
- <https://docs.docker.com/config/containers/logging/json-file/>
- <https://docs.docker.com/engine/network/packet-filtering-firewalls/>
- <https://docs.docker.com/engine/network/firewall-nftables/>
- <https://www.openssh.org/releasenotes.html>
- <https://man.openbsd.org/sshd_config>
- <https://github.com/jtesta/ssh-audit>
- <https://github.com/fail2ban/fail2ban>
- <https://github.com/fail2ban/fail2ban/releases>
- <https://tracker.debian.org/pkg/fail2ban>
- <https://www.crowdsec.net/blog/crowdsec-not-your-typical-fail2ban-clone>
- <https://docs.kernel.org/networking/ip-sysctl.html>
- <https://www.kernel.org/doc/html/latest/admin-guide/sysctl/kernel.html>
- <https://github.com/Neo23x0/auditd>
- <https://tailscale.com/docs/features/tailscale-ssh>
- <https://www.cisecurity.org/benchmark/ubuntu_linux>
- <https://www.hetzner.com/cloud/regular-performance>
- <https://www.hetzner.com/news/new-cx-plans/>
- <https://www.hetzner.com/storage/object-storage/>
- <https://www.hetzner.com/unternehmen/ddos-schutz>
- <https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/>
