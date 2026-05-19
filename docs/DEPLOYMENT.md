# Deployment Guide — RNBP / NRPP

## Overview

Backend deployment is automated by GitHub Actions: when CI passes on `main`, a CD workflow runs on a self-hosted runner installed on the prod CT, which syncs the working tree to `/opt/rnbp/repo`, builds, and restarts the `rnbp-api` systemd service. Manual deploys via `pnpm run deploy` (local rsync) still work as a fallback. Frontend deploys are still triggered manually via `pnpm run deploy:web`.

- **Frontend** (React SPA) is deployed to **Cloudflare Pages**.
- **Backend** (Fastify API) is deployed via rsync to a Proxmox container, exposed through a **Cloudflare Tunnel**. No nginx, no certbot, no public IP.

```
rnbp.ca / nrpp.ca  -->  Cloudflare Pages  -->  React SPA
api.rnbp.ca        -->  Cloudflare Tunnel  -->  Fastify (port 3000)  -->  PostgreSQL 16
```

## Deploy Commands

All commands are run from the repo root on the dev machine.

| Command | Description |
|---------|-------------|
| `pnpm run deploy` | Deploy everything (frontend + backend) |
| `pnpm run deploy:web` | Deploy frontend only (Cloudflare Pages) |
| `pnpm run deploy:api` | Deploy backend only (rsync + restart) |
| `pnpm run rollback` | Rollback API to the latest snapshot |
| `pnpm run rollback 2` | Rollback to the 2nd most recent snapshot |

**Important**: Use `pnpm run deploy`, not `pnpm deploy` (which is a native pnpm command).

The deploy script creates a snapshot before each backend deploy. If the health check fails after deploy, automatic rollback is offered. To disable: `pnpm run deploy:api -- --no-auto-rollback`.

## Configuration

### Local (dev machine)

Create `.deploy.env` at the repo root:

```bash
cp .deploy.env.example .deploy.env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DEPLOY_SERVER` | SSH connection string (e.g., `prod@192.168.50.241`) |
| `DEPLOY_DIR` | Path to the repo on the server (e.g., `/opt/rnbp/repo`) |
| `CF_PROJECT` | Cloudflare Pages project name (e.g., `rnbp-web`) |
| `API_HEALTH_URL` | Health check endpoint (e.g., `https://api.rnbp.ca/api/health`) |

SSH access to the production server must be configured (key-based auth).

### Production server

The API environment file lives at `/opt/rnbp/.env` on the server (not inside the repo). It contains database credentials, JWT keys, CORS origins, Brevo API key, Cloudflare R2 credentials, OAuth provider secrets, etc. See `ops/SETUP.md` section 4 for the full list of variables.

## Production Setup

For the complete infrastructure guide (Proxmox containers, PostgreSQL, Node.js, systemd, Cloudflare Tunnel, Cloudflare Pages, DNS, backups, monitoring, troubleshooting), see:

**[ops/SETUP.md](../ops/SETUP.md)**

## Shop Products & Stripe

The `products` table is created by Drizzle migration `0006_low_rattler.sql` with two seeded products (sticker-sheet and door-sticker). However, **the migration does not include Stripe Price IDs** — these must be configured manually after deployment.

### Post-deploy setup for new Stripe environment

1. Create products and prices in the Stripe Dashboard (or via Stripe CLI):
   ```bash
   # Example: create the door sticker price
   stripe products create --name="Collant de protection RNBP"
   stripe prices create --product=prod_XXX --unit-amount=1999 --currency=cad
   ```

2. Update the products in the RNBP admin (`/admin/products`) with the `stripePriceId` from Stripe.

3. Alternatively, update directly in the database:
   ```sql
   UPDATE products SET stripe_price_id = 'price_xxx' WHERE slug = 'sticker-sheet';
   UPDATE products SET stripe_price_id = 'price_xxx' WHERE slug = 'door-sticker';
   ```

Without a valid `stripePriceId`, the checkout will reject the product with a "no Stripe price configured" error.

### Migrating to a new Stripe account

When swapping to a different Stripe account (e.g., personal to official business account):

1. In the new Stripe Dashboard:
   - Complete the **Stripe Tax registration** for Canada (required because `automatic_tax: { enabled: true }` is set in `apps/api/src/routes/shop.ts`; checkout will hard-fail without it, even at $0).
   - Create products and prices, note each `price_xxx`.
   - Create a webhook endpoint pointing at `https://api.rnbp.ca/api/shop/webhook` with events **`checkout.session.completed`** and **`checkout.session.expired`** only. Copy the new `whsec_xxx`.

2. On the prod server (`/opt/rnbp/.env`):
   ```bash
   sudo cp /opt/rnbp/.env /opt/rnbp/.env.preStripe.$(date +%F)
   # edit STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
   sudo systemctl restart rnbp-api
   ```

3. Update each product's `stripePriceId` via `/admin/products` (or the SQL above).

4. Place a $0 test order end-to-end and confirm the webhook event hits with HTTP 200 in the Stripe Dashboard.

**Rollback**: keep the `.env.preStripe.*` backup for at least 48 h. Disable (do not delete) the old webhook endpoint on the old account for 7 days so you can re-enable it if needed.

**Webhook secret rotation gotcha**: each Dashboard endpoint has its own `whsec_xxx`. There is no overlap window when rolling a secret. To rotate without downtime, create a second endpoint with the same URL + events, deploy the new secret, then delete the old endpoint.

### Product management

Products created via the admin UI (`/admin/products`) are stored only in the database — they are **not** in the migration seed. The `customMechanic` and `requiresItem` fields are dev-only and cannot be set from the admin interface.

## Domains

| Domain | Language | Service |
|--------|----------|---------|
| `rnbp.ca` | French (default) | Cloudflare Pages |
| `nrpp.ca` | English (default) | Cloudflare Pages |
| `api.rnbp.ca` | -- | Cloudflare Tunnel to Fastify |

Language detection priority: localStorage > hostname > navigator.language > default.
