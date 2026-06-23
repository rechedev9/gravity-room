# Multi-method authentication — design

- **Date:** 2026-06-23
- **Status:** In progress (PR1 — identity foundation)
- **Branch:** `feat/multi-auth-foundation`

## Context

Today Gravity Room only supports **Sign in with Google** (plus a client-only guest
mode and a gated dev login). The constraint is not just UI: the database enforces
Google identity via `users.google_id NOT NULL UNIQUE`. Email/password auth existed
historically and was deliberately removed in migration `0004_google_oauth.sql`
(which dropped `password_hash` and the `password_reset_tokens` table).

We want to be flexible for the client and offer several login methods.

## Locked decisions

| Decision                        | Choice                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Methods (in addition to Google) | **Email + password** (with email verification + reset), **Apple** (OIDC ID-token), **GitHub** (OAuth2 code flow)                                        |
| Identity model                  | **`user_identities` table** (one user → N provider identities)                                                                                          |
| Platform scope (this effort)    | **Web first**; mobile parity is a later phase                                                                                                           |
| Login-page redesign             | **Mockup B — social-first**: 3 full-width provider buttons + progressive-disclosure "Continuar con email"; cinematic left panel and guest link retained |
| Password hashing                | **`Bun.password` (argon2id)** — native to the Bun runtime, no extra dependency                                                                          |
| Email transport                 | **Resend over HTTP** (no SMTP server, no dependency)                                                                                                    |
| `users.google_id`               | Made **nullable** and kept as legacy (non-destructive); source of truth becomes `user_identities`                                                       |

### Non-goals (for now)

- Passkeys / WebAuthn, magic-link, SMS OTP (revisit later).
- Mobile parity for the new methods (web-first).
- Replacing the bespoke JWT + refresh-rotation system with a third-party library.

## Data model

### New: `user_identities`

```
id                   uuid pk default random
user_id              uuid not null → users.id (on delete cascade)
provider             varchar(20) not null      -- 'google' | 'apple' | 'github' | 'password'
provider_account_id  varchar(255) not null     -- provider sub / id; for 'password' = the user id
created_at           timestamptz not null default now()

unique (provider, provider_account_id)
index  (user_id)
```

### Changed: `users`

- `google_id` → **nullable** (kept for legacy/backfill; no longer the identity key).
- `password_hash text` (nullable) — argon2id hash for the email/password method.
- `email_verified boolean not null default false`.

### Reinstated / new token tables

- `password_reset_tokens` (`id`, `user_id` fk cascade, `token_hash` unique, `expires_at`, `created_at`).
- `email_verification_tokens` (same shape).

These two are consumed in PR2 (email/password). They are introduced in PR1 so the
`users` table is altered exactly once.

## Service layer

`findOrCreateGoogleUser` is generalized to:

```
findOrCreateUserByIdentity({ provider, providerAccountId, email, emailVerified, name })
  → { user, isNewUser }
```

Algorithm (inside one transaction; one retry on unique-violation to absorb the
first-sign-in race):

1. Look up `user_identities` by `(provider, providerAccountId)`. If found → return
   its user (reject if soft-deleted), `isNewUser=false`.
2. Else look up `users` by lowercased `email`:
   - Soft-deleted → 403 `ACCOUNT_DELETED`.
   - **Account linking** is allowed **only when the incoming email is
     provider-verified AND the existing user's `email_verified` is true.** Then
     insert the identity row and return the user, `isNewUser=false`.
   - Otherwise → 409 `ACCOUNT_EXISTS_DIFFERENT_METHOD` (tell the user to sign in
     with their original method). This is the anti-takeover default.
3. Else create `users` + `user_identities` and return `isNewUser=true`.

`findOrCreateGoogleUser(googleId, email, name)` becomes a thin wrapper:
`findOrCreateUserByIdentity({ provider: 'google', providerAccountId: googleId, email, emailVerified: true, name })`.
Google sign-in behaviour is therefore unchanged in PR1.

### Account-takeover note

Email-based linking is the classic takeover vector. We never auto-link to an
**unverified** existing account, and we only accept an incoming email as proof of
ownership when the provider marks it verified (Google/Apple always do; GitHub only
the user's primary _verified_ email). Password accounts must verify their email
before they can be linked to.

## Migration & backfill (`0041`)

`bun run db:generate` emits the DDL (new table, altered `users`, token tables).
A hand-added data step backfills existing Google users so they keep working:

```sql
INSERT INTO user_identities (user_id, provider, provider_account_id)
SELECT id, 'google', google_id FROM users WHERE google_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE users SET email_verified = true WHERE google_id IS NOT NULL;
```

Migrations apply automatically on API bootstrap; the backfill runs before any new
code reads `user_identities`.

## API (later PRs — summary)

- PR2: `/auth/signup`, `/auth/login`, `/auth/verify-email`, `/auth/forgot-password`,
  `/auth/reset-password` + `lib/email.ts` (Resend). Strict rate limits, generic
  responses (no user enumeration), email-verified required before password login.
- PR4: `/auth/apple` (reuse JWKS verify, generalized to `lib/oidc.ts`).
- PR5: `/auth/github/start` + `/auth/github/callback` (OAuth2 code flow).

CSP stays `script-src 'self'`: redirect/popup + server-side verification, no
third-party SDK scripts.

## Web UI — Mockup B (PR3)

`features/auth/login-page.tsx`: three full-width provider buttons (Google/Apple/
GitHub), an `— O —` divider, and a "▸ Continuar con email" control that expands
inline into email + password with an Entrar/Crear-cuenta toggle and a forgot-password
link. Keep the cinematic left panel, the guest link, and the dev login (DEV-only).
New `login.*` i18n keys in `en` and `es`.

## Environment variables (added across PRs)

| Var                                                                        | Service | Required in prod                | Phase |
| -------------------------------------------------------------------------- | ------- | ------------------------------- | ----- |
| `RESEND_API_KEY`                                                           | api     | yes (once email/password ships) | PR2   |
| `EMAIL_FROM`                                                               | api     | yes (once email/password ships) | PR2   |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | api     | yes (once Apple ships)          | PR4   |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`                                | api     | yes (once GitHub ships)         | PR5   |

Each must be added to `env-validation.ts` `REQUIRED_ENV` **and**
`.env.production.example` (CI sync gate).

## PR breakdown

1. **PR1 — Identity foundation** (this branch): schema + migration + backfill +
   `findOrCreateUserByIdentity`. No behaviour change for Google.
2. **PR2 — Email/password** API + email transport + web client regen.
3. **PR3 — Web UI** (Mockup B) wiring Google + email/password + guest; Apple/GitHub
   buttons flag-gated off.
4. **PR4 — Apple**.
5. **PR5 — GitHub**.
6. **Later — mobile parity** (`/auth/mobile/*` mirrors + Expo UI).

## Testing strategy

- Unit (`bun run test:api`, mocked DB): `findOrCreateUserByIdentity` branch logic.
- Integration (`bun run test:e2e`, real Postgres via `DATABASE_URL_TEST`): migration
  apply + backfill + identity upsert/link/conflict/soft-delete against a live DB.
- Gates before handoff: `typecheck · lint · test · test:api · api:types · db:generate
· build · e2e`.

## External prerequisites (block PR2/PR4/PR5)

- **Resend** account + verified sending domain → `RESEND_API_KEY`, `EMAIL_FROM`.
- **Apple Developer**: Service ID + Sign in with Apple key (`.p8`) + Team/Key IDs.
- **GitHub OAuth App**: client id/secret + callback
  `https://gravityroom.app/api/auth/github/callback`.

PR1 and the PR3 UI shell need none of these.
