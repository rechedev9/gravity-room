---
name: vercel-deploy
description: Diagnose a failed Gravity Room Vercel production deploy and monitor deploys from the dashboard, the Vercel CLI, or GitHub commit statuses.
---

# Vercel deploy — diagnosis & monitoring

> Topology and deploy footguns live in the root `CLAUDE.md` ("Vercel deploy (production)").
> This skill covers the operational side: reading a failed deploy and watching one land.

### Diagnosing a failed deploy

Open the deployment in the Vercel dashboard and read the Build Logs (db:deploy +
Vite) and the Function Logs / Runtime Logs (cold-start `validateEnv` errors,
per-request failures). `GET /api/health` returns the `db` block for a quick
liveness check; Vercel Cron invocation results show under the project's Cron tab.

### Monitoring deploys from the CLI / terminal

The **Vercel CLI** (`vercel`, v52+) is installed locally for watching deploys and
pulling logs — `vercel ls`, `vercel inspect <url> --logs`, `vercel logs <url>`,
`vercel link` (to `rechedevs-projects/gravity-room`). It needs auth first: run
`vercel login` (interactive — type `! vercel login` so its output lands in the
session) or export `VERCEL_TOKEN`. The repo is not linked by default.

Without CLI auth, a push-triggered deploy is fully observable through GitHub,
which is the fastest check after pushing to `main`:

```bash
# Vercel posts a commit status; its target_url links to the build:
gh api repos/rechedev9/gravity-room/commits/<sha>/status \
  --jq '.state, (.statuses[]|{context,state,target_url})'   # "Vercel" → success/failure
# Production deployments (environment + sha):
gh api "repos/rechedev9/gravity-room/deployments?per_page=3" \
  --jq '.[]|{sha:.sha[0:7],environment,created_at}'
curl -s https://gravityroom.app/api/health                 # liveness (db + redis blocks)
```

