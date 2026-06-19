# Production Setup Guide — Badge

Complete guide to deploy the project from scratch.

## Architecture

```
[Browser] → badgeid.ca → [Cloudflare Pages] → React SPA (FR/EN, single domain)
                                  ↓ API calls
[Browser] → api.badgeid.ca → [Cloudflare Tunnel] → 192.168.50.241:3000 → [Fastify]
                                                                              ↓
                                                          192.168.50.239 → [PostgreSQL 16]
```

- **No nginx** — Cloudflare Tunnel connects directly to Fastify (existing nginx on the container does not interfere)
- **No certbot** — Cloudflare handles TLS at the edge
- **No public IP** — the tunnel is an outbound connection
- **Legacy domains** — `rnbp.ca` / `nrpp.ca` (and `api.rnbp.ca`) remain pointed at Cloudflare and still resolve, kept for redirects/back-compat after the Badge rebrand

### Proxmox Infrastructure

| Container | ID | IP | Role |
|-----------|-----|-----|------|
| prod (existing) | 241 | `192.168.50.241` | RNBP API + Cloudflare Tunnel |
| postgresql-prod (Turnkey) | 239 | `192.168.50.239` | Dedicated PostgreSQL 16 |

## Prerequisites

- Proxmox with the 2 containers listed above
- Primary domain: `badgeid.ca` (NS pointing to Cloudflare); legacy `rnbp.ca` / `nrpp.ca` also on Cloudflare for redirects
- Cloudflare account (free tier is sufficient)

---

## 1. Prod Container (192.168.50.241)

The existing prod container (CT 241) already hosts other services. We add RNBP to it.

```bash
# Connect to the container
ssh root@192.168.50.241

# Update
apt update && apt upgrade -y

# Required tools (if not already installed)
apt install -y curl git
```

### Install Node.js 20 LTS (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node -v  # v20.x.x
```

### Install pnpm (if not already installed)

```bash
npm i -g pnpm
pnpm -v  # 9.x.x
```

### Prepare the application directory

We reuse the existing `prod` user on the container.

```bash
mkdir -p /opt/rnbp
chown prod:prod /opt/rnbp
```

## 2. PostgreSQL Container (192.168.50.239)

Create a Turnkey PostgreSQL container (CT 239) on Proxmox.

Once the container is started:

```bash
ssh root@192.168.50.239
```

### Configure network access

By default, PostgreSQL only listens on localhost. It needs to be opened to the prod container.

```bash
# Find the config file (varies depending on the Turnkey version)
PG_CONF=$(find /etc/postgresql -name postgresql.conf)
PG_HBA=$(find /etc/postgresql -name pg_hba.conf)

# Listen on all interfaces
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" $PG_CONF

# Allow the prod container to connect
echo "host    rnbp_prod    rnbp    192.168.50.241/32    scram-sha-256" >> $PG_HBA

# Restart PostgreSQL
systemctl restart postgresql
```

---

### Create the user and database

```bash
# On the PostgreSQL container (192.168.50.239)
sudo -u postgres createuser rnbp
sudo -u postgres createdb rnbp_prod -O rnbp
sudo -u postgres psql -c "ALTER USER rnbp WITH PASSWORD '<SECURE_PASSWORD>';"
```

### Test the connection from the prod container

```bash
# From 192.168.50.241
apt install -y postgresql-client   # if not installed
psql -h 192.168.50.239 -U rnbp -d rnbp_prod -c "SELECT 1;"
```

The connection URL will be:
```
postgresql://rnbp:<PASSWORD>@192.168.50.239:5432/rnbp_prod
```

---

## 3. SSH Access

On the **development machine**:

```bash
# Generate an SSH key (if not already done)
ssh-keygen -t ed25519 -C "dev@rnbp"

# Copy the public key to the server
ssh-copy-id prod@192.168.50.241

# Test the connection
ssh prod@192.168.50.241
```

This access is required for the `ops/deploy.sh` script to work.

---

## 4. Application

### Clone the repo

```bash
sudo -u prod git clone <REPO_URL> /opt/rnbp/repo
```

### Configure the environment

```bash
sudo cp /opt/rnbp/repo/apps/api/.env.example /opt/rnbp/.env
sudo chown prod:prod /opt/rnbp/.env
sudo chmod 600 /opt/rnbp/.env
```

Edit `/opt/rnbp/.env` with production values:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | `postgresql://rnbp:<PASSWORD>@192.168.50.239:5432/rnbp_prod` |
| `JWT_PRIVATE_KEY` | *(see below)* |
| `JWT_PUBLIC_KEY` | *(see below)* |
| `CORS_ORIGINS` | `https://badgeid.ca,https://www.badgeid.ca,https://rnbp.ca,https://nrpp.ca,https://www.rnbp.ca,https://www.nrpp.ca` |
| `UPLOAD_DIR` | `/opt/rnbp/uploads` |
| `FRONTEND_URL` | `https://badgeid.ca` |
| `FROM_EMAIL` | `noreply@badgeid.ca` |
| `BREVO_API_KEY` | *(Brevo key if emails are enabled)* |
| `GOOGLE_CLIENT_ID` | *(Google OAuth client ID)* |
| `GOOGLE_CLIENT_SECRET` | *(Google OAuth client secret)* |
| `MICROSOFT_CLIENT_ID` | *(Microsoft OAuth client ID)* |
| `MICROSOFT_CLIENT_SECRET` | *(Microsoft OAuth client secret)* |
| `FACEBOOK_CLIENT_ID` | *(Facebook OAuth app ID)* |
| `FACEBOOK_CLIENT_SECRET` | *(Facebook OAuth app secret)* |
| `R2_ACCOUNT_ID` | *(Cloudflare account ID)* |
| `R2_ACCESS_KEY_ID` | *(R2 API token access key)* |
| `R2_SECRET_ACCESS_KEY` | *(R2 API token secret key)* |
| `R2_BUCKET_NAME` | `rnbp-uploads` |
| `R2_PUBLIC_URL` | *(R2 public bucket URL, e.g. `https://pub-xxx.r2.dev`)* |
| `STRIPE_SECRET_KEY` | *(Stripe secret key)* |
| `STRIPE_WEBHOOK_SECRET` | *(Stripe webhook signing secret)* |

`R2_PUBLIC_URL` must point to an enabled public domain for the bucket. If the managed `r2.dev` domain or custom public domain is disabled, uploads will still be written to R2 but browsers will receive `401` when requesting the files.

### Generate JWT Ed25519 keys

```bash
openssl genpkey -algorithm Ed25519 -out /tmp/ed25519_private.pem
openssl pkey -in /tmp/ed25519_private.pem -pubout -out /tmp/ed25519_public.pem

# Copy these values into .env
echo "JWT_PRIVATE_KEY=$(base64 -w 0 /tmp/ed25519_private.pem)"
echo "JWT_PUBLIC_KEY=$(base64 -w 0 /tmp/ed25519_public.pem)"

# Delete the temporary files
rm /tmp/ed25519_private.pem /tmp/ed25519_public.pem
```

### Initial build

```bash
cd /opt/rnbp/repo
sudo -u prod pnpm install --frozen-lockfile
sudo -u prod pnpm --filter @rnbp/shared build
sudo -u prod pnpm --filter @rnbp/api build
```

### Migrations

Drizzle migrations are applied automatically on backend startup. No manual step required.

To run manually if needed:
```bash
cd /opt/rnbp/repo/apps/api
sudo -u prod node --env-file=/opt/rnbp/.env dist/migrate.js
```

### Uploads directory

```bash
sudo mkdir -p /opt/rnbp/uploads
sudo chown prod:prod /opt/rnbp/uploads
```

---

## 5. systemd

```bash
sudo cp /opt/rnbp/repo/ops/rnbp-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable rnbp-api
sudo systemctl start rnbp-api
```

### Verify

```bash
sudo systemctl status rnbp-api
curl -s http://localhost:3000/api/health | jq
```

### Useful commands

```bash
# Live logs
sudo journalctl -u rnbp-api -f

# Last 50 log lines
sudo journalctl -u rnbp-api -n 50

# Restart
sudo systemctl restart rnbp-api
```

---

## 6. Cloudflare Tunnel (backend)

The tunnel replaces nginx + certbot. It creates an encrypted outbound connection between the server and Cloudflare — no ports to open, no certificates to manage.

### Install cloudflared

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb
```

### Authenticate

```bash
cloudflared tunnel login
```

This opens a browser to authorize the Cloudflare account.

### Create the tunnel

```bash
cloudflared tunnel create rnbp-api
```

Note the tunnel ID (e.g., `a1b2c3d4-...`).

### Configure the tunnel

Create `/opt/rnbp/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.badgeid.ca
    service: http://localhost:3000
  - hostname: api.rnbp.ca          # legacy, kept for back-compat
    service: http://localhost:3000
  - service: http_status:404
```

> **Note**: Move the credentials JSON file to `/opt/rnbp/.cloudflared/` if the tunnel is installed as a service under the prod user.

### Configure DNS

```bash
cloudflared tunnel route dns rnbp-api api.badgeid.ca
```

This automatically creates a CNAME `api.badgeid.ca` → `<TUNNEL_ID>.cfargotunnel.com`.

### Install as a service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### Verify

```bash
sudo systemctl status cloudflared
curl -s https://api.badgeid.ca/api/health | jq
```

---

## 7. Cloudflare Pages (frontend)

### Create the project

```bash
# From the dev machine, at the repo root
npx wrangler pages project create rnbp-platform
```

### First deployment

```bash
pnpm --filter @rnbp/shared build
pnpm --filter @rnbp/web build
npx wrangler pages deploy apps/web/build/client --project-name rnbp-platform
```

### Custom domains

In the Cloudflare Pages dashboard → project `rnbp-platform` → Custom Domains:

1. `badgeid.ca` (primary)
2. `www.badgeid.ca` (redirect to `badgeid.ca`)
3. `rnbp.ca` / `www.rnbp.ca` (legacy, redirect to `badgeid.ca`)
4. `nrpp.ca` / `www.nrpp.ca` (legacy, redirect to `badgeid.ca`)

### SPA routing and legacy redirects

`apps/web/public/_redirects` declares the FR legacy → EN redirects (301) and the SPA fallback:

```
/connexion        /login        301
# … other FR legacy routes …
/*                /index.html   200
```

The `/*` line lets React Router handle every other path on the client. The home page (`/`) is prerendered at build time by React Router framework mode (`ssr: false` + `prerender: ["/"]`); all other routes are served via the prerendered SPA shell.

---

## 8. Cloudflare DNS

The primary domain (`badgeid.ca`) and the legacy domains (`rnbp.ca`, `nrpp.ca`) must all have their nameservers pointing to Cloudflare.

### badgeid.ca (primary)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `rnbp-platform.pages.dev` | Yes |
| CNAME | `www` | `rnbp-platform.pages.dev` | Yes |
| CNAME | `api` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |

### rnbp.ca (legacy)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `rnbp-platform.pages.dev` | Yes |
| CNAME | `www` | `rnbp-platform.pages.dev` | Yes |
| CNAME | `api` | `<TUNNEL_ID>.cfargotunnel.com` | Yes |

### nrpp.ca

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `rnbp-platform.pages.dev` | Yes |
| CNAME | `www` | `rnbp-platform.pages.dev` | Yes |

> **Note**: The `@` and `www` CNAME records for Pages are often configured automatically by Cloudflare when adding custom domains.

---

## 9. Backups

### Configure automatic backups

```bash
sudo mkdir -p /opt/rnbp/backups
sudo chown prod:prod /opt/rnbp/backups
```

Add to the `prod` user's crontab:

```bash
sudo -u prod crontab -e
```

Add the following line:
```
0 3 * * * /opt/rnbp/repo/ops/backup.sh >> /opt/rnbp/backups/backup.log 2>&1
```

### Test a restore

```bash
# List backups
ls -la /opt/rnbp/backups/

# Test a restore into a temporary database
sudo -u postgres createdb rnbp_restore_test
pg_restore -d rnbp_restore_test /opt/rnbp/backups/<backup_file>
# Verify the data, then delete
sudo -u postgres dropdb rnbp_restore_test
```

### Remote backup (optional)

To send backups to Cloudflare R2:

```bash
sudo apt install -y rclone
rclone config  # Configure an R2 remote
# Add to backup.sh: rclone copy /opt/rnbp/backups/ r2:rnbp-backups/
```

---

## 10. Deployment and Updates

### Local configuration

On the dev machine, create `.deploy.env` at the repo root:

```bash
cp .deploy.env.example .deploy.env
# Edit with the correct values
```

### Deploy

```bash
# Everything (frontend + backend)
pnpm run deploy

# Frontend only
pnpm run deploy:web

# Backend only
pnpm run deploy:api
```

### Migration workflow

1. Modify the schema in `apps/api/src/db/schema.ts`
2. Generate the SQL: `cd apps/api && pnpm db:generate`
3. Review the SQL file in `apps/api/drizzle/`
4. Commit and push
5. Deploy: `pnpm run deploy:api` — migrations are applied automatically on restart

### Rollback

The deploy script creates a snapshot of `apps/api/dist/` and `apps/api/node_modules/` before each deploy. In case of issues:

**Automatic**: If the health check fails after a deploy, the script offers an automatic rollback (or performs it without prompting in non-interactive mode).

**Manual**:
```bash
# Rollback to the latest snapshot
pnpm run rollback

# Rollback to a specific snapshot (2 = second most recent)
pnpm run rollback 2
```

**Snapshots**: Stored in `/opt/rnbp/backups/rollback/` on the prod server. Retention: 3 most recent.

**DB Rollback**: If a migration was applied, dumps are in `/opt/rnbp/backups/rollback/db_*.sql.gz`. To restore:
```bash
ssh prod@192.168.50.241
gunzip -c /opt/rnbp/backups/rollback/db_YYYYMMDD_HHMMSS.sql.gz | psql "$DATABASE_URL"
```

**Disable auto-rollback**: `pnpm run deploy:api -- --no-auto-rollback`

---

## 11. Monitoring

### UptimeRobot

Set up a monitor on [UptimeRobot](https://uptimerobot.com/) (free):

- **URL**: `https://api.badgeid.ca/api/health`
- **Interval**: 5 minutes
- **Alert**: email

### Logs

```bash
# Live API logs
ssh prod@192.168.50.241 'sudo journalctl -u rnbp-api -f'

# Tunnel logs
ssh prod@192.168.50.241 'sudo journalctl -u cloudflared -f'

# Logs from the last 24 hours
ssh prod@192.168.50.241 'sudo journalctl -u rnbp-api --since "24 hours ago"'
```

---

## 12. Troubleshooting

### The API service does not start

```bash
sudo journalctl -u rnbp-api -n 100
# Check for config errors (missing .env, unreachable DB, etc.)

# Test manually
cd /opt/rnbp/repo/apps/api
sudo -u prod node --env-file=/opt/rnbp/.env dist/index.js
```

### The Cloudflare tunnel is disconnected

```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50

# Restart
sudo systemctl restart cloudflared
```

### Migrations fail

Migrations are applied automatically on startup. If the backend does not start because of a migration:

```bash
# Check DB connection
psql -h 192.168.50.239 -U rnbp -d rnbp_prod -c "SELECT 1;"

# Check SQL files
ls -la /opt/rnbp/repo/apps/api/drizzle/

# Run manually (debug)
cd /opt/rnbp/repo/apps/api
sudo -u prod node --env-file=/opt/rnbp/.env dist/migrate.js
```

### Disk space

```bash
# Uploads size
du -sh /opt/rnbp/uploads/

# Backups size
du -sh /opt/rnbp/backups/

# Clean old backups (keep 7 days)
find /opt/rnbp/backups/ -name "*.sql.gz" -mtime +7 -delete
```

### The API returns 502 from the internet but works locally

1. Check that the tunnel is connected: `sudo systemctl status cloudflared`
2. Check that the API is listening: `curl http://localhost:3000/api/health`
3. Check the tunnel config: `/opt/rnbp/.cloudflared/config.yml`
