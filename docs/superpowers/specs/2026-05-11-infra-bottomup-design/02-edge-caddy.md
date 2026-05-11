# Edge / Caddy / Reverse Proxy — Bottom-Up Design Research

**Date:** 2026-05-11
**Scope:** The single Caddy 2 instance fronting `gravityroom.app`, `www.gravityroom.app`, `api.gravityroom.app` on the Hetzner VPS. Caddy is the only public-facing process (no Cloudflare, no upstream LB).
**Source of truth for current state:** [`/home/reche/projects/TrackerRSN/Caddyfile`](../../../Caddyfile).

---

## 1. Verified versions (May 2026)

| Component                     | Pinned today            | Latest stable                                     | Notes                                                                                                          |
| ----------------------------- | ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `caddy:2-alpine` (Docker tag) | `2-alpine` (floating)   | **2.11.2** released 2026-03-06                    | 2.11.2 patches two CVEs: `forward_auth` identity-injection and `vars_regexp` placeholder double-expansion. [1] |
| `caddy-ratelimit` (mholt)     | not installed           | master (single tagged release; HEAD is canonical) | Supports per-zone keys + distributed mode via shared storage. [4]                                              |
| `xcaddy`                      | not used                | latest                                            | Required to add any third-party module. [10]                                                                   |
| HTTP/3 / QUIC                 | on by default since 2.6 | on                                                | UDP/443 must be open in the firewall. [3]                                                                      |

> 2.11.2 ships a `tls_resolvers` global option and zstd log rolling, plus reverse-proxy edge-case fixes. Worth pinning. [1]

---

## 2. Current Caddyfile — anchor lines

From `Caddyfile`:

- L10–18 — `(security_headers)` snippet defines HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (`interest-cohort=(), browsing-topics=()`), and a hardcoded CSP allowing `accounts.google.com`, `plausible.io`, `*.sentry.io`.
- L21–24 — `www.gravityroom.app` 301 → apex, imports the snippet.
- L26–37 — `api.gravityroom.app` intentionally skips the snippet (API sets its own CSP); does `encode zstd gzip` and `reverse_proxy api:3001` with `header_up X-Forwarded-For {remote_host}` + `header_up X-Forwarded-Proto {scheme}`.
- L39–67 — apex serves `/srv/web` static, with cache rules: `/assets/*` → `max-age=31536000, immutable`; HTML → `no-cache`. `try_files` + `file_server` + `handle_errors` 404 → `/404.html`.

Nothing here is wrong. The gaps below are additive hardening, not corrections.

---

## 3. Gaps vs. official best practice

1. **No `servers { trusted_proxies }` declaration.** L34 sets `X-Forwarded-For {remote_host}` blindly. It works _only because_ Caddy is the first hop — but with no `trusted_proxies` block, Caddy itself does not parse `X-Forwarded-For` from clients, which is the right behaviour today. We should make this explicit so a future Cloudflare/Tailscale fronting doesn't silently break client-IP-based rate limiting. [5]
2. **No rate limiting** for `/api/auth/*`, `/api/programs/import`, or per-IP global. Currently relies entirely on the Elysia app layer; abuse traffic still consumes a TCP/TLS handshake + a Bun request. [4]
3. **CSP allows `'unsafe-inline'` in `style-src`** (L16). Acceptable for Tailwind-generated runtime classes but worth flagging; CSP-3 strict-dynamic for scripts is also missing. [6]
4. **No COOP / COEP / CORP headers.** With Google OAuth popup flow, the correct COOP is `same-origin-allow-popups` (not `same-origin`, which would break `window.opener` for the OAuth callback). [7]
5. **`Permissions-Policy` is minimal.** Only opts out of interest-cohort / browsing-topics. MDN/OWASP guidance is deny-by-default for camera, microphone, geolocation, etc. [8]
6. **Static assets are not precompressed.** `encode zstd gzip` recompresses every response on the fly. For a Vite build we can precompute `.br` + `.zst` sidecars and serve them with `file_server { precompressed zstd br gzip }`. [9]
7. **No structured access log.** Today Caddy logs to its default stdout text format. Switching to JSON with header redaction unlocks Loki/Vector ingestion later. [11]
8. **`caddy:2-alpine` floats.** Production should pin `caddy:2.11.2-alpine` (or build with xcaddy when modules are added). [10]
9. **No `Cache-Control: no-store` for HTML responses delivering authenticated state.** `no-cache` revalidates but allows BFCache to restore stale auth UI. [12]
10. **Admin API.** Default bind is `localhost:2019` — already off the public interface; confirm Docker doesn't republish it. [Caddy default]

---

## 4. Recommendations

### P0 — Do before next deploy

1. **Pin the image to `caddy:2.11.2-alpine`.** Patches two real CVEs (forward*auth, vars_regexp). [1] \_Cost:* one-line change in `docker-compose.yml`.
2. **Add a `trusted_proxies` global block explicitly stating none.** This makes Caddy's parsing behaviour intentional and audit-friendly:
   ```caddy
   {
       servers {
           trusted_proxies static
           client_ip_headers X-Forwarded-For
       }
   }
   ```
   Empty static list = trust nothing = `{client_ip}` always equals the socket peer, which is correct when Caddy is the first hop. [5]
3. **Fix COOP for OAuth.** Add `Cross-Origin-Opener-Policy "same-origin-allow-popups"` to the `security_headers` snippet. Do NOT use `same-origin` — it severs `window.opener` for the Google popup. [7]
4. **Expand `Permissions-Policy`** to a deny-by-default list of high-risk APIs we don't use:
   ```
   accelerometer=(), camera=(), geolocation=(), gyroscope=(),
   magnetometer=(), microphone=(), payment=(), usb=(),
   interest-cohort=(), browsing-topics=()
   ```
   [8]

### P1 — Schedule for the same sprint

5. **Install `caddy-ratelimit` via xcaddy.** Two-stage Docker build keeps the runtime image alpine-small. [4][10] Recommended zones:
   ```caddy
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
   ```
   Storage defaults to in-memory; if we ever scale to two Caddy nodes we point it at the existing Redis. [4]
6. **Switch to JSON access logs with redaction.** Caddy already redacts Authorization/Cookie to `[REDACTED]` by default; switch to JSON for machine-parseable logs and add a `sampling` block to dampen scanner noise. [11]
7. **Precompressed static assets.** Add a Vite plugin step (`vite-plugin-compression` or hand-rolled CI step running `zstd -19` and `brotli -q11` over `dist/`), then:
   ```caddy
   file_server {
       precompressed zstd br gzip
   }
   ```
   This drops CPU on the VPS and improves p99 TTFB on cold connections. [9]
8. **HTML `Cache-Control: no-store`** for authenticated routes. Authenticated SPA shells must not be restored from BFCache after sign-out. [12]

### P2 — Nice-to-have

9. **Add CORP `same-site` on `/api/*` responses** (set in Elysia, not Caddy) so cross-origin embeds can't pull JSON via `<img>` etc. COEP/`require-corp` is overkill — we don't need SharedArrayBuffer. [7]
10. **CSP `strict-dynamic` + nonce** for `script-src`. Requires Vite SSR-style nonce injection or post-build HTML rewrite. Deferred until we have a real need; current host-allowlist CSP is acceptable for a SPA. [6]
11. **WAF (`caddy-coraza`).** Useful only if we start seeing targeted attacks; adds CPU. Hold off until rate-limit telemetry shows demand. [10]

---

## 5. Proposed Caddyfile diff

This is the recommended end-state Caddyfile after P0+P1 land. **Do not apply yet** — depends on Docker image rebuild with xcaddy + ratelimit, and on precompressed asset generation in the web build pipeline.

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
        # same-site CORP: blocks cross-origin <img>/<script> from embedding our assets.
        Cross-Origin-Resource-Policy "same-site"
        Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()"
        Content-Security-Policy "default-src 'self'; script-src 'self' https://accounts.google.com https://plausible.io https://*.sentry.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://plausible.io https://*.sentry.io https://*.ingest.sentry.io; frame-src https://accounts.google.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
    }
}

(access_log) {
    log {
        output stdout
        format json
        # Authorization/Cookie auto-redact to [REDACTED] unless log_credentials set.
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
        # Caddy is first hop; {client_ip} == socket peer. Forward verbatim.
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

---

## 6. Open questions

- **xcaddy build pipeline**: do we want CI (GitHub Actions) producing a `ghcr.io/<org>/caddy-gr:2.11.2` image, or a `Dockerfile` rebuilt inline by `docker compose build` on the VPS? Former is auditable, latter is one-step.
- **Distributed rate-limit storage**: if we ever run two Caddy instances we'd point the module at Redis. Worth setting up now (cheap) or deferring (KISS)?
- **Brotli precompression** requires `brotli` in the CI image; do we want to add it to the web build container or skip `.br` and use only `.zst` + `.gz`?
- **CSP `report-uri`**: Sentry can ingest CSP reports. Worth the noise for a small user base?

---

## 7. Sources

1. [Caddy releases — caddyserver/caddy](https://github.com/caddyserver/caddy/releases)
2. [Caddy stable image — Docker Hub `caddy`](https://hub.docker.com/_/caddy)
3. [HTTP/3 enabled by default — Caddy 2.6 PR #4707](https://github.com/caddyserver/caddy/pull/4707)
4. [`mholt/caddy-ratelimit`](https://github.com/mholt/caddy-ratelimit)
5. [Caddy global options — `servers` / `trusted_proxies`](https://caddyserver.com/docs/caddyfile/options)
6. [strict-dynamic — Google CSP guide](https://csp.withgoogle.com/docs/strict-csp.html)
7. [MDN — Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy)
8. [MDN — Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy)
9. [Caddy `file_server` directive — precompressed](https://caddyserver.com/docs/caddyfile/directives/file_server)
10. [`caddyserver/xcaddy`](https://github.com/caddyserver/xcaddy)
11. [Caddy `log` directive](https://caddyserver.com/docs/caddyfile/directives/log)
12. [MDN — Cache-Control / BFCache interaction](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
13. [Caddy `encode` directive — ordering](https://caddyserver.com/docs/caddyfile/directives/encode)
14. [Caddy `tls` directive](https://caddyserver.com/docs/caddyfile/directives/tls)
