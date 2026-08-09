# Infrastructure Setup — Badge

Everything runs on Cloudflare. There is no server to provision, no OS to patch, no TLS to
renew. This document is the reference for recreating or reasoning about that infrastructure.

For how deploys work day to day, see [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md). For how the
platform got here, see [docs/CLOUDFLARE-MIGRATION.md](../docs/CLOUDFLARE-MIGRATION.md).

## Architecture

```
badgeid.ca       -->  Pages project `badge-platform`   -->  React SPA
api.badgeid.ca   -->  Worker `badge-api`               -->  Hono
                                                            |-- D1  `badge-db`
                                                            `-- R2  `badge-uploads`
files.badgeid.ca -->  R2 `badge-uploads` (public custom domain)
```

Cloudflare account: `3aa12f83f9d4006cfd805489b6d65eb8` (Alexandre.lessard92@gmail.com).
`wrangler whoami` lists several accounts — always set `CLOUDFLARE_ACCOUNT_ID`.

## Resources

| Kind | Production | Staging |
|---|---|---|
| Worker | `badge-api` | `badge-api-staging` |
| D1 | `badge-db` | `badge-db-staging` |
| R2 uploads | `badge-uploads` → `files.badgeid.ca` | `badge-uploads-staging` → `files-staging.badgeid.ca` |
| Pages | `badge-platform` (branch `main`) | `badge-platform` (branch `staging`) |
| R2 backups | `badge-db-backups` (shared, 90-day lifecycle) | — |

Bindings and non-secret vars are declared per environment in `apps/worker/wrangler.jsonc`.
That file is the source of truth; nothing here should contradict it.

## Domains

| Domain | Points at |
|---|---|
| `badgeid.ca`, `www.badgeid.ca` | Pages `badge-platform` |
| `rnbp.ca`, `www.rnbp.ca`, `nrpp.ca`, `www.nrpp.ca` | Pages `badge-platform` (legacy aliases) |
| `api.badgeid.ca` | Worker `badge-api` (custom domain, declared in `wrangler.jsonc`) |
| `files.badgeid.ca` | R2 `badge-uploads` |
| `api.rnbp.ca` | **Old server via Cloudflare Tunnel — argon2 bridge only.** Do not repoint until the bridge is retired. |

### Moving a domain between Pages projects

Two steps, and the second is the one that bites: **detaching and reattaching a custom domain
does not update its DNS.** The CNAME keeps pointing at the old project and the domain serves
523 until you patch it.

```bash
# 1. detach, 2. attach, 3. repoint the CNAME to <new-project>.pages.dev
```

Move a low-traffic domain first as a canary. Certificate issuance takes a few minutes, during
which the domain is down.

## Access tokens

The API token `badge-cicd` (no expiry, no IP filter) is stored in the GitHub secret
`CLOUDFLARE_API_TOKEN` and in `.deploy.env` at the repo root for local use. It covers Workers
Scripts, D1, R2, Pages, KV, Tail and Account Settings at account level, plus DNS, Workers
Routes and Zone Read on the `badgeid.ca`, `rnbp.ca` and `nrpp.ca` zones.

It deliberately **cannot manage tokens**. Widening its scope needs a fresh bootstrap token
with token-management rights — so when creating one, cover every zone the project touches the
first time. A permission change takes a minute or two to apply; writes in that window fail
with `10405 Method not allowed for this authentication scheme`, which is misleading. Wait and
retry.

## Secrets

Secrets live on the Worker, survive deploys, and are never in the repo.

```bash
export CLOUDFLARE_ACCOUNT_ID=3aa12f83f9d4006cfd805489b6d65eb8
pnpm --filter @badge/worker exec wrangler secret put NAME --env production
pnpm --filter @badge/worker exec wrangler secret list --env production
```

`apps/worker/secrets.manifest.json` declares what each environment needs; CD runs
`ops/check-secrets.mjs` and refuses to deploy when one is missing. Add new secrets to the
manifest in the same commit.

### Generating JWT keys

```bash
node -e "const {generateKeyPairSync}=require('crypto');const{privateKey,publicKey}=generateKeyPairSync('ed25519');console.log('JWT_PRIVATE_KEY='+Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'));console.log('JWT_PUBLIC_KEY='+Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64'))"
```

Production reuses the keypair from the pre-migration server, so existing sessions stayed
valid through the cutover. Replacing it signs everyone out.

`PASSWORD_PEPPER` is mixed into every PBKDF2 derivation — changing it invalidates every
stored password hash. There is no rotation path short of a forced reset for all users.

## R2

One bucket per environment. Sharing a bucket means a staging upload lands next to real
customer files.

Public access is a **custom domain on the bucket**, not `r2.dev`: r2.dev is rate-limited and
Cloudflare does not recommend it for production traffic. Note that a deleted file keeps
serving from CDN cache for up to its `max-age` (4 h).

When creating an R2 token via the API rather than the dashboard, the S3 credentials are
derived: **Access Key ID is the token id**, **Secret Access Key is the SHA-256 hex digest of
the token value**. The bucket-scoped resource key is
`com.cloudflare.edge.r2.bucket.<account_id>_default_<bucket_name>`.

`curl` before 8.2 omits `x-amz-content-sha256` from `--aws-sigv4` requests and R2 rejects
them; `ops/backup.sh` passes the header explicitly.

## Backups

| What | How | Retention |
|---|---|---|
| D1 `badge-db` | `Backup D1` workflow, nightly 03:00 ET → R2 | 90 days (bucket lifecycle) |
| D1 point-in-time | Cloudflare Time Travel | 30 days |
| Legacy Postgres | `ops/backup.sh` via cron on the old server → R2 | 14 days local, 90 in R2 |

Restore a D1 export:

```bash
pnpm --filter @badge/worker exec wrangler d1 execute badge-db --remote --env production --file dump.sql
```

## Migrating data from Postgres

`ops/pg-export.sh` dumps each table as JSON (locally or over SSH); `ops/pg-to-d1.py` converts
it to D1-compatible SQL — timestamps to epoch milliseconds, booleans to 0/1, `text[]` to
JSON — and can repoint stored file URLs with `--rewrite-url OLD=NEW`.

```bash
./ops/pg-export.sh /tmp/pgdata prod@192.168.50.241
./ops/pg-to-d1.py /tmp/pgdata --rewrite-url https://pub-OLD.r2.dev=https://files.badgeid.ca > import.sql
pnpm --filter @badge/worker exec wrangler d1 execute badge-db --remote --env production --file import.sql
```

## The legacy stack (being retired)

A Proxmox container at `192.168.50.241` runs the old Fastify API (`rnbp-api`, systemd) against
a local PostgreSQL 16, reachable through a Cloudflare Tunnel. It exists for one endpoint:
`POST /internal/verify-legacy`, which the Worker calls to verify pre-migration argon2 password
hashes.

The tunnel config (`/etc/cloudflared/config.yml`) matches only that path on `api.rnbp.ca` and
returns 410 for everything else, so nothing can write to that Postgres by accident. The
pre-cutover config is kept as `config.yml.bak-precutover`.

Note that the container's `.git` is frozen (deploys rsync without it) — GitHub `main` is the
truth, never `git log` on the server.

Retire the container, the Tunnel route, the `deploy-legacy-bridge` CD job and `apps/api` once
this returns 0:

```bash
pnpm --filter @badge/worker exec wrangler d1 execute badge-db --remote --env production \
  --command "SELECT COUNT(*) FROM users WHERE password_hash LIKE '\$argon2%';"
```
