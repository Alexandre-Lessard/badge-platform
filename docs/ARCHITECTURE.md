# Badge -- Architecture & Technical Decisions

## 1. System Architecture

```
                         badgeid.ca
                             |
                             v
                    +------------------+
                    | Cloudflare Pages |
                    | React Router 7   |
                    | (prerendered /,  |
                    |  SPA elsewhere)  |
                    +------------------+
                             |
                        API calls
                             |
                             v
                    +------------------+
                    | Cloudflare Worker|
                    | (api.badgeid.ca) |
                    |    Hono API      |
                    +------------------+
                          |        |
                          v        v
                    +---------+ +---------+
                    |   D1    | |   R2    |
                    | SQLite  | | files.  |
                    |         | | badgeid |
                    +---------+ +---------+
```

Everything runs on Cloudflare. There is no server, no connection pool, no TLS to renew.
The API is a Worker bound directly to its database and its bucket.

### One domain, two languages

`badgeid.ca` serves both French and English. Language comes from localStorage, then
`navigator.language`, then French as the default. The former `rnbp.ca` and `nrpp.ca`
domains still resolve and serve the same site — kept for links printed on stickers and for
search engines, not as separate language sites.

The home page (`/`) is prerendered to static HTML at build time so crawlers and OAuth
verifiers see fully rendered content. Other routes use the prerendered SPA shell and hydrate
on the client. A Cloudflare Pages Function (`apps/web/functions/[[path]].ts`) injects
per-route Open Graph, canonical, hreflang and JSON-LD tags at request time.

### One temporary exception

The previous self-hosted Fastify server still answers a single endpoint,
`POST /internal/verify-legacy` on `api.rnbp.ca`, which the Worker calls to verify
pre-migration argon2 password hashes. Every other path on that host returns 410. It is
retired once no account has an argon2 hash left — see
[CLOUDFLARE-MIGRATION.md](CLOUDFLARE-MIGRATION.md).

---

## 2. Technical Decisions

### Hono on Cloudflare Workers

The API was Fastify on a self-hosted server until August 2026. Moving to Workers forced the
framework choice: Fastify has no fetch adapter and assumes a Node HTTP server.

1. **Runs on the fetch runtime** -- Hono is built for it, so there is no adapter layer.
2. **Small** -- matters when the whole Worker is a single bundle with a size budget.
3. **Close to Fastify** -- routing and middleware map almost one to one, which is what made
   porting ~3400 lines of routes tractable.

The old Fastify app survives in `apps/api` only to serve the argon2 bridge.

### JWT EdDSA (Ed25519) over RS256

The project uses Ed25519 (EdDSA) via the `jose` library instead of the more common RS256:

1. **Smaller tokens** -- Ed25519 signatures are 64 bytes vs 256 bytes for RSA-2048, producing meaningfully shorter JWTs that travel in every HTTP header.
2. **Faster signing and verification** -- Ed25519 is ~10x faster than RSA for signing and ~5x faster for verification, reducing per-request CPU cost.
3. **Modern and concise keys** -- Ed25519 private keys are 32 bytes. No RSA key size debates, no padding oracle attack surface.

### PBKDF2-SHA256 with a pepper, not argon2

argon2id is the better algorithm and was the original choice. It is a native N-API addon and
cannot run on Workers, so the move to Cloudflare forced a change.

1. **PBKDF2 via WebCrypto** -- the only password KDF the runtime offers.
2. **A server-side pepper** -- the free plan caps PBKDF2 at 100k iterations, below the OWASP
   recommendation. `PASSWORD_PEPPER`, a secret mixed into the derivation input, means an
   attacker with only the database cannot brute-force offline at all.
3. **Lazy migration, nobody reset** -- a stored hash cannot be converted without the
   plaintext, so existing `$argon2id$` hashes are verified by calling the old server
   (`LEGACY_VERIFY_URL`) and rewritten to PBKDF2 on the next successful login. Network wait
   does not count against Worker CPU, which is what keeps this on the free plan.

### Drizzle ORM over Prisma

1. **Type-safe without code generation** -- Drizzle infers types directly from the schema definition in TypeScript. No `prisma generate` step, no generated client to keep in sync.
2. **Lighter runtime** -- No query engine binary. Drizzle compiles to plain SQL, so the deployment footprint is smaller and startup is faster.
3. **SQL-close API** -- Drizzle's query builder mirrors SQL closely, making it easy to reason about the generated queries.
4. **Works on D1** -- the same query builder targets `sqlite-core`, so the port from
   Postgres was a schema rewrite rather than a rewrite of every query.

Migrations no longer run at startup: a Worker has no startup hook to hang them on. CD applies
them with `wrangler d1 migrations apply` before deploying.

### D1 over a hosted Postgres

Keeping Postgres would have meant Hyperdrive plus a hosted provider, and a bill. D1 is on the
same platform as the Worker: no pooling, no egress, no cost at this size. The price is
SQLite's constraints, and they are real:

- **No interactive transactions.** The eight `db.transaction()` blocks became `db.batch()`
  where the statements are independent, or a conditional `UPDATE ... WHERE <still-unclaimed>`
  where the transaction existed to win a race.
- **Types are narrower.** `timestamptz` became epoch-millisecond integers, `boolean` became
  0/1, `text[]` became JSON.
- **Postgres-only SQL had to go.** `ilike`, `date_trunc`, `pg_database_size`.

If D1 ever becomes the wall, the documented fallback is Containers plus hosted Postgres —
see [CLOUDFLARE-MIGRATION.md](CLOUDFLARE-MIGRATION.md).

### No server at all

The previous setup was a Proxmox container behind a Cloudflare Tunnel: no public IP, no
nginx, no certbot. Workers removes the machine entirely — nothing to patch, nothing to
restart, nothing to monitor for disk space.

### pnpm workspaces monorepo

1. **Shared types and constants** -- The `@badge/shared` package exports Zod schemas, error codes, and TypeScript types used by both frontend and backend. A single source of truth eliminates drift.
2. **Single lockfile** -- One `pnpm-lock.yaml` for the entire project ensures consistent dependency resolution across all packages.
3. **Disk-efficient** -- pnpm's content-addressable store deduplicates dependencies across workspaces, unlike npm or yarn classic.

### Zod for validation

1. **Shared between frontend and backend** -- The same Zod schemas in `@badge/shared` validate form inputs on the frontend and request bodies on the backend. If a validation rule changes, it changes once.
2. **TypeScript type inference** -- `z.infer<typeof schema>` derives types from schemas, so validation logic and types never diverge.
3. **Composable** -- Schemas can be extended, merged, and refined, making it easy to build API-specific schemas from base definitions.

### HMAC signed tokens for email verification

Email verification and password reset tokens use HMAC-SHA256 signatures instead of database-stored tokens:

1. **Stateless** -- No tokens table in the database. The token itself contains the userId, expiry, a random nonce, and a signature. Verification is a single HMAC computation.
2. **No DB lookup required** -- Verifying a token is a pure cryptographic operation. The server recomputes the HMAC and compares. No query, no cleanup of expired tokens.
3. **Purpose-bound** -- The HMAC includes the token purpose (`verify-email` or `reset-password`) in the signed data, preventing cross-purpose token reuse.
4. **Timing-safe comparison** -- The verification uses constant-time byte comparison to prevent timing attacks on the signature.

Token format: `userId.expiresAt.randomNonce.hmacSignature`

---

## 3. Authentication Flow

The system uses a JWT access/refresh token pattern backed by a `sessions` table.

### Token lifecycle

1. **Login** (email/password or OAuth) -- The server creates a session row in the `sessions` table, generates an access token (short-lived) and a refresh token (long-lived), and returns both to the client. The refresh token is stored as a SHA-256 hash in the session row -- the plaintext is never persisted.

2. **Authenticated requests** -- The client sends the access token in the `Authorization: Bearer` header. The `requireAuth` middleware verifies the JWT signature (EdDSA), checks the token type is `access`, loads the user from the database, and checks the `tokenRevokedBefore` timestamp.

3. **Token refresh** -- When the access token expires, the client sends the refresh token to the refresh endpoint. The server hashes it with SHA-256, looks up the matching session, verifies it has not expired, and issues a new access/refresh pair.

4. **Logout** -- The session row is deleted from the database. The refresh token becomes unusable immediately. The access token remains valid until it expires (short TTL mitigates this).

### Mass revocation via `tokenRevokedBefore`

The `users` table has a `tokenRevokedBefore` timestamp column. When set (e.g., on password reset), the auth middleware rejects any access token whose `iat` (issued-at) is before that timestamp. This invalidates all existing sessions for a user in a single database update, without needing to delete session rows.

### Authorization layers

- `requireAuth` -- Validates the JWT, loads user, checks revocation.
- `requireAdmin` -- Calls `requireAuth`, then checks `isAdmin`.
- `requireVerifiedEmail` -- Calls `requireAuth`, then checks `emailVerified`.
- `tryAuth` -- Attempts authentication silently. If the token is missing or invalid, the request proceeds as unauthenticated. Used for endpoints that behave differently for logged-in users.

---

## 4. OAuth Flow

The project supports Google, Facebook, and Microsoft OAuth.

### Providers

Google and Facebook are implemented; Microsoft is scaffolded but has no credentials.
All of them are currently switched off in production — the buttons are gated on build-time
`VITE_*_CLIENT_ID` vars, commented out in `apps/web/.env.production` pending business
verification. The Worker side is ready.


| Provider | Flow | PKCE | Profile endpoint |
|----------|------|------|-----------------|
| Google | Authorization Code + PKCE | Yes | `/oauth2/v3/userinfo` |
| Facebook | Authorization Code (no PKCE) | No | `/v21.0/me?fields=id,email,first_name,last_name,name` |
| Microsoft | Authorization Code + PKCE | Yes | `/v1.0/me` |

### Flow

1. **Frontend** -- Generates a `state` parameter (CSRF protection) and redirects the user to the provider's authorization URL. For Google and Microsoft, PKCE `code_verifier` and `code_challenge` are also generated and stored in sessionStorage. Facebook does not support PKCE.

2. **Callback** -- The provider redirects back to the frontend with an authorization `code` and the `state` parameter. The frontend verifies the state matches, then sends the code, redirect_uri, and code_verifier (if applicable) to the backend.

3. **Backend code exchange** -- The server exchanges the authorization code for an access token with the provider, passing the `client_secret` for server-side authentication and `code_verifier` for PKCE validation (Google/Microsoft only).

4. **Profile fetch** -- The server uses the provider's access token to fetch the user profile.

5. **Account linking** -- The server matches the OAuth profile to a local user by provider ID (`googleId`, `facebookId`, or `microsoftId`) or by email. If a user with that email already exists, the provider ID is linked to the existing account. If no user exists, a new account is created with `emailVerified: true`. A session is created and JWT tokens are returned.

### Why PKCE

PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks. Even though the backend uses a client secret, PKCE adds defense-in-depth: the code is useless without the verifier that only the original client possesses. Facebook does not support PKCE, so only state + client_secret are used for that provider.

---

## 5. Bilingual Error Handling

Error handling follows a code-based pattern that decouples the API from display language.

### How it works

1. **Shared error codes** -- The `@badge/shared` package exports string constants for every error and success code (`INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `ITEM_NOT_FOUND`, etc.). These are plain strings, not messages.

2. **Backend throws codes** -- The API never returns user-facing messages in French or English. It throws `AppError` with an HTTP status and an error code:
   ```typescript
   throw new AppError(401, TOKEN_INVALID, "Invalid or expired token");
   ```
   The third argument is a developer-facing message for logs. The client receives only the code.

3. **Frontend maps codes to locale** -- The frontend i18n layer maps each error code to a localized string in the user's current language. The same `TOKEN_INVALID` code becomes "Jeton invalide" in French or "Invalid token" in English.

This design means the API is language-agnostic. Adding a third language requires only frontend translation files -- no backend changes.

---

## 6. i18n Strategy

### Language detection priority

The `detectLocale` function applies this cascade:

1. **localStorage** -- If the user previously chose a language, respect it.
2. **Browser language** -- `navigator.language` as a fallback.
3. **Default** -- French (`fr`).

Hostname detection was removed with the move to a single domain: `badgeid.ca` serves both
languages, and `rnbp.ca` / `nrpp.ca` are now just aliases for the same site rather than a
French and an English edition. During the prerender, `BUILD_LOCALE=en` selects the English
build instead.

### Implementation

- All translations live in static TypeScript objects (one per locale). No async loading, no network requests for translations.
- A `LanguageProvider` React context holds the current locale and the resolved translation object (`t`).
- `useLanguage()` returns `{ locale, setLocale, t }`. Components access translations via `t.someKey`.
- Changing language updates React state and `localStorage`. No page reload -- the entire UI re-renders instantly.
- The `document.documentElement.lang` attribute is updated on locale change (`fr-CA` or `en-CA`) for accessibility.

### Fixed-width UI elements

Because French text is typically longer than English, all interactive elements (buttons, tabs, links styled as buttons) use a fixed `minWidth` based on the longer language. This prevents layout shifts when the user toggles language.

---

## 7. Database Schema

All tables use UUID primary keys with `defaultRandom()` and `timestamptz` for temporal columns.

| Table | Description |
|---|---|
| **users** | User accounts. Supports both email/password and OAuth (Google, Facebook, Microsoft). Tracks `emailVerified`, `isAdmin`, `clientNumber` (RNBP-assigned), `preferredLanguage` (`fr`/`en`, default `fr`), optional civic address fields (`address1`, `address2`, `city`, `province`, `postalCode`, `country`), `termsAcceptedAt` (timestamp of terms acceptance), and `tokenRevokedBefore` for mass session invalidation. `passwordHash` is nullable (OAuth-only users have no password). |
| **sessions** | Active refresh token sessions. Stores a SHA-256 hash of the refresh token (never plaintext), device info, and expiry. Cascades on user deletion. Indexed by `userId`. |
| **items** | Registered personal property. Each item belongs to an owner, has a category, optional brand/model/serial number/tracker ID, estimated value, and a status enum (`active`, `stolen`, `recovered`, `transferred`). The `badgeCode` (format `BADGE-XXXXXXXX`) is denormalized from `sticker_codes` when the customer claims a code. Supports archival via `archivedAt`, `archiveReason` (destroyed/lost/discarded/registration_error/other), and `archiveReasonCustom` (free text for "other"). Archived items are excluded from listings by default. |
| **item_photos** | Photos attached to items, stored in Cloudflare R2. One photo per item can be marked `isPrimary`. Dashboard thumbnails use the oldest `isPrimary=true` photo and fall back to the oldest photo if no primary flag is set. When the primary photo is deleted, the oldest remaining photo is promoted automatically. Cascades on item deletion (R2 files cleaned up). |
| **item_documents** | Documents attached to items (receipts, warranties, appraisals), stored in Cloudflare R2. Stores URL, file type, and original filename. Cascades on item deletion (R2 files cleaned up). |
| **theft_reports** | Theft declarations filed by item owners. Links to the item and the reporter. Tracks police report number, theft date/location, and a status enum (`pending`, `confirmed`, `resolved`, `dismissed`). |
| **insurance_requests** | Records of emails sent to insurers on behalf of users. Stores the insurer name, the message content, and the send timestamp. |
| **partners** | Business partners (insurers, retailers, security companies). Tracks company info, type enum, contact details, and active status. |
| **contact_messages** | Inbound messages from the contact form. Stores name, email, phone (optional), company, partner type, and message body. |
| **newsletter_subscribers** | Email addresses subscribed to the newsletter. Unique constraint on email. |
| **orders** | Stripe checkout orders. Tracks the Stripe session/payment intent IDs, total amount in cents, order status (`pending`, `paid`, `shipped`, `cancelled`), and shipping info. `userId` is nullable (guest checkout allowed, set null on user deletion). |
| **order_items** | Line items within an order. Links to the order, optionally to an item, and optionally to a product. Tracks the assigned `badgeCode`, product type (slug), quantity, and unit price in cents. |
| **products** | Shop product catalog. Bilingual name/description/features (FR/EN). Tracks `priceCents`, `stripePriceId` (Stripe Price ID), `imageUrl`, `isActive`, `sortOrder`. `requiresItem` indicates if the product must be linked to a registered item at checkout. `customMechanic` (dev-only, not editable from admin UI) flags products with special coded behavior (e.g., `item-linked-stickers` for RNBP number assignment). |
