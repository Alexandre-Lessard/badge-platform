# Cloudflare migration — Workers + D1

Running log of the move from the self-hosted API (Fastify on a home server behind
a Cloudflare Tunnel, PostgreSQL 16) to a fully serverless stack (Workers + D1).
Written so the work can be resumed, audited, or reversed by someone who was not
in the room.

Started 2026-08-09. Production data at that point: 17 users, 5 items, 23 orders.

## Why this shape

The evaluation compared three targets:

| Option | Verdict |
|---|---|
| **Workers + D1** | Chosen. Zero-cost, fully serverless, but requires replacing every native dependency and reshaping the schema. |
| Containers + hosted Postgres | Fallback. Runs the Fastify app nearly unchanged (~5-20 $/month); the escape hatch if D1 or the Workers runtime becomes a wall. |
| Workers + hosted Postgres (Hyperdrive) | Middle ground; keeps Postgres but still needs the full framework rewrite, so it buys little over the option above. |

Workers + D1 was picked deliberately as an experiment: the point is to learn what
100 % Cloudflare actually costs in engineering terms, on a project small enough
that the answer is affordable. The fallback stays documented for that reason.

## What blocked a naive port, and what replaced it

Three dependencies cannot run on Workers, and each needed a real decision:

**argon2 → PBKDF2-SHA256 (WebCrypto) + pepper.** argon2 is a native N-API addon.
A hash cannot be converted without the plaintext password, so the 17 existing
hashes could only migrate at login time. The Worker verifies a `$argon2id$...`
hash by calling `POST /internal/verify-legacy` on the old server (still reachable
through the Tunnel, gated by a shared secret), then rehashes to PBKDF2 on
success. Network wait does not count against Worker CPU, so this works on the
free plan and nobody is forced to reset a password. The free plan caps PBKDF2 at
100k iterations, which is below the OWASP recommendation of 600k — a secret
`PASSWORD_PEPPER` mixed into the derivation input compensates. Once no
`$argon2%` hashes remain, the endpoint and the old server can go.

**sharp → client-side canvas resize.** Also a native addon. Images are now
downscaled to WebP (max 1920px, quality 0.8) in the browser by
`apps/web/src/lib/image-resize.ts` before upload. The Worker still validates
magic bytes and size, so a hand-rolled request cannot bypass the type check —
only the resize moved, not the validation. Cloudflare Images was rejected as a
paid service for something the browser does for free.

**@aws-sdk/client-s3 → native R2 binding.** `env.UPLOADS.put/delete` needs no
credentials, no signing, and no SDK.

Fastify itself has no fetch adapter, so the HTTP layer moved to **Hono**. To keep
the ~3400 lines of route code recognisably the same, the Worker keeps the
`getConfig()` / `getDb()` module-scope accessors of `apps/api` — bindings are
identical for every request an isolate serves, so caching them at module scope is
safe and let the routes port almost line-for-line.

## Postgres → D1 (SQLite), the parts that actually differ

- **Types**: `timestamptz` → integer epoch-ms, `boolean` → integer 0/1,
  `uuid` → text with `crypto.randomUUID()` defaults, `text[]` → JSON text,
  pg enums → text columns with the same allowed values.
- **No interactive transactions.** The 8 `db.transaction()` blocks became
  `db.batch()` where the statements are independent, or a conditional `UPDATE ...
  WHERE <still-unclaimed>` where the transaction existed to win a race (sticker
  code claiming). Registration relies on the `UNIQUE` constraint on
  `users.email` rather than a check-then-insert inside a transaction.
- **Postgres-only SQL** in `admin.ts` was rewritten: `ilike` → `like` (SQLite's
  LIKE is already case-insensitive for ASCII), `concat()` → `||`, `date_trunc()`
  → `date()`/`strftime()` over `created_at / 1000`.
- **Host metrics are gone.** `pg_database_size`, `pg_stat_activity`,
  `os.loadavg()`, `process.memoryUsage()` have no serverless equivalent. The
  `/admin/metrics/live` SSE stream now emits what is real (D1 row counts, the
  isolate's request counter) over a streamed `ReadableStream` response, closing
  after two minutes so `EventSource` reconnects.

## Migrating the data

`ops/pg-export.sh` dumps each table as JSON (locally or over SSH);
`ops/pg-to-d1.py` converts it to D1 SQL, applying the type conversions above and
emitting tables in foreign-key order. Rehearsed against the real production dump:
209 rows, all counts matching, timestamps, booleans, JSON arrays and argon2
hashes intact.

## Verified so far

- Full auth cycle on D1: register (PBKDF2), login, `/auth/me`, wrong-password rejection
- **The migration path itself**: a real argon2 account logs in through the
  Worker, the legacy endpoint verifies it, and the stored hash becomes
  `pbkdf2$100000$...`; the next login no longer touches the old server
- Public lookup by serial number, including the normalisation (spaces, dashes,
  underscores stripped) that used to rely on Postgres string functions
- Products, insurers, admin authorisation (401/403 where expected)
- CORS: the staging origin is allowed, an unknown origin gets no
  `Access-Control-Allow-Origin`
- End-to-end in a browser on the deployed staging site: the SPA on Pages queries
  the Worker, which reads D1, and a lookup returns real migrated production data
- The only console error on staging (React #418, a hydration mismatch) is present
  on production too — pre-existing, not introduced here

## Not done yet

- Stripe checkout + webhook on staging (needs test keys wired into the staging Worker)
- OAuth on staging (needs staging redirect URIs registered with each provider)
- R2 uploads on staging (bucket bound, public URL not yet configured)
- Production cutover (Phase 4) — deliberately gated on Alex's go-ahead

## The RNBP → Badge rename

The rebrand had only reached what users see. The plumbing was renamed alongside
this migration, since renaming a Pages project forces a redeploy anyway and the
cutover already needs a maintenance window.

Done: workspace packages `@rnbp/*` → `@badge/*`, browser storage keys (with
`apps/web/src/lib/storage-migration.ts` copying each old key across at boot, so
nobody is signed out), `AssignRnbpModal` → `AssignBadgeCodeModal`, DOM ids, the
GitHub repo (`badge-platform`, old URLs redirect), and the Pages project.

File URLs moved to **custom domains on badgeid.ca** rather than a new opaque
`pub-*.r2.dev`: `files.badgeid.ca` over `badge-uploads`,
`files-staging.badgeid.ca` over `badge-uploads-staging`. r2.dev is rate-limited
and Cloudflare does not recommend it for production traffic — the 401s seen
while testing were exactly that throttle. The two environments no longer share
a bucket.

Deliberately **not** renamed: `/opt/rnbp/`, `ops/rnbp-api.service`, the
`rnbp-prod` runner label. That machine is decommissioned once the argon2 hashes
finish migrating; renaming it is work on something we are about to delete.

## The cutover (done 2026-08-09)

Production runs on Workers + D1. `api.badgeid.ca` is the Worker, `badgeid.ca`
is the `badge-platform` Pages project, and all 209 rows moved with matching
counts table by table. A real argon2 account was logged in through production
to prove the bridge: the login succeeded and the stored hash became `pbkdf2$`.

Two things the rehearsal did not predict:

**Moving a Pages custom domain does not update its DNS.** Detaching the domain
from the old project and attaching it to the new one leaves the CNAME pointing
at `<old-project>.pages.dev`, and the domain serves 523 until the record is
repointed by hand. The `rnbp.ca` canary is what surfaced this — had the primary
domain gone first, `badgeid.ca` would have been down for the ten minutes it
took to diagnose. The working recipe is: detach, attach, **patch the CNAME**,
then wait for verification and certificate issuance (a few minutes).

**The Worker cannot reach the argon2 bridge at `api.badgeid.ca`.** That
hostname now resolves to the Worker itself, so `LEGACY_VERIFY_URL` was moved to
`api.rnbp.ca`, which stays on the Tunnel. Keep that record pointed at the
Tunnel until the last argon2 hash is gone.

All six domains are on `badge-platform`; `rnbp-platform` now owns none and can
be deleted after a few days of stability. `nrpp.ca` took two attempts: the
`badge-cicd` token had been scoped to the `badgeid.ca` and `rnbp.ca` zones
only. Adding the third zone to its policy works, but **a token permission
change takes a minute or two to take effect** — the first writes afterwards
came back `10405 Method not allowed for this authentication scheme`, which
reads like a scheme problem and is really just propagation. Wait and retry
before concluding anything from that error.

## Original cutover checklist

Already prepared and verified, so the window itself is short:

- ✔ `badge-platform` Pages project created and serving the site on its own
  `pages.dev`; the old project still owns the custom domains
- ✔ `badge-uploads` bucket created, 17 objects copied, `files.badgeid.ca` live
- ✔ `badge-db` created and migrated; `badge-api` deployed with production
  secrets — **including the current server's JWT keypair, so existing sessions
  survive the cutover** — and pointing at an empty D1 until the data moves
- ✔ `ops/pg-to-d1.py --rewrite-url` repoints file URLs during the conversion

Remaining, in order:

1. Merge `staging` → `main` to deploy `POST /internal/verify-legacy`, then set
   `LEGACY_VERIFY_SECRET` in `/opt/rnbp/.env` (value waiting in the operator's
   scratchpad, already set on the Worker) and restart `rnbp-api`. Confirm the
   endpoint no longer answers 503.
2. Fresh backup, freeze writes.
3. `pg-export.sh` → `pg-to-d1.py --rewrite-url <old-r2>=https://files.badgeid.ca`
   → load into `badge-db`. Compare row counts table by table.
4. Point `api.badgeid.ca` (+ `api.rnbp.ca`) at `badge-api`. Test health, a login,
   a lookup.
5. Move the Pages custom domains **one at a time, `rnbp.ca` first as the canary**:
   remove from `rnbp-platform`, add to `badge-platform`, verify. Only then
   `badgeid.ca` and `www.badgeid.ca`.
6. Verify end to end: a real argon2 login (the bridge should fire and leave a
   `pbkdf2$` hash), item creation, photo upload, public lookup, admin, and a
   live Stripe webhook.
7. Leave the server running until `SELECT COUNT(*) FROM users WHERE
   password_hash LIKE '$argon2%'` reaches zero. Only then retire the Tunnel, the
   systemd service, and the endpoint.

## Environments

| | Production | Staging |
|---|---|---|
| API | Worker `badge-api` on `api.badgeid.ca` | Worker `badge-api-staging` |
| DB | D1 `badge-db` | D1 `badge-db-staging` |
| Files | R2 `badge-uploads` / `files.badgeid.ca` | `badge-uploads-staging` / `files-staging.badgeid.ca` |
| Web | Pages `badge-platform`, `badgeid.ca` | `badge-platform`, branch `staging` |
| Deploy | `main` → CI → CD | `staging` → CI → CD Staging |

The old server still runs, serving only `POST /internal/verify-legacy` through
`api.rnbp.ca`. Its Postgres is now a read-only historical copy; nothing writes
to it. Nightly backups cover both: `ops/backup.sh` for Postgres and
`ops/backup-d1.sh` for D1, into the same R2 bucket.

## Rollback

Production is untouched by all of the above except one additive, secret-gated
endpoint (`/internal/verify-legacy`, inert while `LEGACY_VERIFY_SECRET` is unset).
Until DNS moves, rolling back means doing nothing. After the cutover it means
pointing `api.badgeid.ca` back at the Tunnel; the server, its database and its
systemd service stay in place until the last argon2 hash is gone.

Backups: nightly `pg_dump` at 03:00 with 14-day local rotation and an offsite
copy to R2 `badge-db-backups` (90-day lifecycle) — see `ops/backup.sh`. None of
this existed before this migration; the only prior safety net was the pre-deploy
snapshot taken when a deploy happened to carry a migration.
