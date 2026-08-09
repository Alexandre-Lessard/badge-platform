# Deployment Guide — Badge

## Overview

Deploys are automated. Push to a branch, and once CI passes a CD workflow ships it:

| Branch | Workflow | What it deploys |
|--------|----------|-----------------|
| `main` | `cd.yml` | Production Worker (`badge-api`) + D1 migrations, then the Pages site |
| `staging` | `cd-staging.yml` | Staging Worker + D1 migrations + the Pages `staging` branch |

```
badgeid.ca      -->  Cloudflare Pages   -->  React SPA
api.badgeid.ca  -->  Cloudflare Worker  -->  Hono  -->  D1 + R2
```

Nothing is deployed by hand. `ops/deploy.sh` still exists but targets the old self-hosted
stack; it is not the production path any more.

### Order matters

In production the Worker deploys first and the site waits for it (`needs: deploy-worker`).
That way a Worker deploy that fails never leaves a frontend live against an API that did
not update. The staging job runs the same steps in one job, in the same order.

### Secrets are checked first

Both workflows run `ops/check-secrets.mjs <env>` before anything ships. Most secrets are
`.optional()` in the Worker's Zod schema — a missing one does not stop the Worker booting,
it silently disables a feature (no `BREVO_API_KEY`, no verification emails; no
`STRIPE_WEBHOOK_SECRET`, paid orders never marked paid). The check fails the deploy and
prints the exact `wrangler secret put` command for each gap.

`apps/worker/secrets.manifest.json` declares what each environment needs. A unit test fails
if its `required` list drifts from the schema. **When you add a secret, add it to the
manifest in the same commit.**

## Managing secrets

Secrets live on the Worker, not in the repo, and survive deploys — `wrangler deploy`
replaces code only.

```bash
pnpm --filter @badge/worker exec wrangler secret put NAME --env production
pnpm --filter @badge/worker exec wrangler secret list --env production
```

Non-secret values (URLs, CORS origins, `NODE_ENV`) are `vars` in
`apps/worker/wrangler.jsonc` and are versioned.

For local development, copy `apps/worker/.dev.vars.example` to `.dev.vars` (gitignored).

## Rollback

```bash
pnpm --filter @badge/worker exec wrangler rollback --env production
```

Or revert the commit and let CD redeploy. D1 migrations do not roll back automatically —
write a compensating migration, or restore from a backup (see below).

## Configuration

`.deploy.env` at the repo root (gitignored) holds `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` for local wrangler use. CI reads the same values from the GitHub
secret `CLOUDFLARE_API_TOKEN` and the variable `CLOUDFLARE_ACCOUNT_ID`.

The web build runs on a GitHub runner where `apps/web/.env.production` does not exist — it
is not tracked in git. Any `VITE_*` the production build needs must be set in the
`deploy-web` job. This is why enabling OAuth means editing the workflow, not just
uncommenting the local file.

## Backups

| What | How | Where |
|------|-----|-------|
| D1 (`badge-db`) | `Backup D1` workflow, nightly 03:00 ET | R2 `badge-db-backups` |
| D1 point-in-time | Cloudflare Time Travel, 30 days | built in |
| Legacy Postgres | `ops/backup.sh` via cron on the old server | R2 `badge-db-backups` |

The Postgres backup goes away with the old server. Restore a D1 export with
`wrangler d1 execute badge-db --remote --file <dump.sql>`.

## Shop Products & Stripe

Products live in the `products` table. Stripe Price IDs are **not** seeded by migration and
must be set per environment, through `/admin/products` or directly:

```sql
UPDATE products SET stripe_price_id = 'price_xxx' WHERE slug = 'sticker-sheet';
```

Without a valid `stripePriceId`, checkout rejects the product with "no Stripe price
configured".

### Migrating to a new Stripe account

1. In the new Stripe Dashboard:
   - Complete **Stripe Tax registration** for Canada — `automatic_tax: { enabled: true }` in
     `apps/worker/src/routes/shop.ts` makes checkout hard-fail without it, even at $0.
   - Create products and prices, note each `price_xxx`.
   - Create a webhook endpoint at `https://api.badgeid.ca/api/shop/webhook` with
     **`checkout.session.completed`** and **`checkout.session.expired`** only. Copy the `whsec_xxx`.
2. Set the new values:
   ```bash
   pnpm --filter @badge/worker exec wrangler secret put STRIPE_SECRET_KEY --env production
   pnpm --filter @badge/worker exec wrangler secret put STRIPE_WEBHOOK_SECRET --env production
   ```
3. Update each product's `stripePriceId`.
4. Place a $0 test order end to end and confirm the webhook returns 200 in the Dashboard.

**Rotation gotcha**: each Dashboard endpoint has its own `whsec_xxx` and there is no overlap
window. To rotate without downtime, create a second endpoint with the same URL and events,
set the new secret, then delete the old endpoint.

## Domains

| Domain | Serves |
|--------|--------|
| `badgeid.ca`, `www.badgeid.ca` | Pages project `badge-platform` |
| `rnbp.ca`, `www.rnbp.ca`, `nrpp.ca`, `www.nrpp.ca` | Same site, legacy domains |
| `api.badgeid.ca` | Worker `badge-api` |
| `files.badgeid.ca` | R2 bucket `badge-uploads` |
| `api.rnbp.ca` | **Old server, argon2 bridge only.** Every other path returns 410. Leave it on the Tunnel until the bridge is retired. |

Language detection priority: localStorage > navigator.language > default (FR).

## The old stack

`apps/api` (Fastify) and the self-hosted server still exist to serve one endpoint:
`POST /internal/verify-legacy`, which the Worker calls to verify pre-migration argon2
password hashes. The `deploy-legacy-bridge` job keeps it current.

Retire all of it — job, server, Tunnel route, `apps/api` — once this returns 0:

```bash
pnpm --filter @badge/worker exec wrangler d1 execute badge-db --remote --env production \
  --command "SELECT COUNT(*) FROM users WHERE password_hash LIKE '\$argon2%';"
```

See [CLOUDFLARE-MIGRATION.md](CLOUDFLARE-MIGRATION.md) for the full story.
