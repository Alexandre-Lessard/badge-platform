# Badge

![CI](https://github.com/Alexandre-Lessard/badge-platform/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/Alexandre-Lessard/badge-platform/actions/workflows/cd.yml/badge.svg)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-blue)
![Node](https://img.shields.io/badge/node-20-green)
![pnpm](https://img.shields.io/badge/pnpm-10-orange)

A platform for Canadians to register, protect, and recover their valuable belongings.

## What is this?

Badge is a bilingual Canadian web application that lets users catalog their personal
property, claim Badge codes for their items, report thefts to aid recovery, and request
insurance discounts from participating insurers. Anyone can look up a Badge code or serial
number to check whether an item is registered or reported stolen.

It runs at `badgeid.ca` in French and English on the same domain. The former `rnbp.ca` and
`nrpp.ca` domains still resolve and point at the same site.

## Key Features

- **Item Registration** — Catalog belongings with photos, documents, serial numbers, tracker IDs (AirTag/Tile/SmartTag), and estimated values
- **Badge Codes** — Unique identifiers on sticker sheets, claimed by the customer and attached to an item
- **Theft Reporting** — Declare stolen items with police report details; items are flagged across the registry
- **Public Lookup** — Look up a Badge code or serial number to check an item's status
- **Insurance Integration** — Send proof of registration to your insurer to request a home insurance discount
- **Stripe Checkout** — Purchase sticker sheets with tax calculation and shipping
- **Bilingual UI** — Full French/English support with instant language toggle
- **OAuth Login** — Google and Facebook, currently switched off pending business verification (see `apps/web/.env.production`)

## Architecture

```
badgeid.ca                     api.badgeid.ca
     |                                |
Cloudflare Pages              Cloudflare Worker
     |                                |
  React SPA                      Hono API
  (Vite 6)                    D1  +  R2
```

Everything runs on Cloudflare. There is no server to maintain: the API is a Worker, the
database is D1 (SQLite), files live in R2 and are served from `files.badgeid.ca`.

One exception, temporary: the previous self-hosted server still answers a single endpoint
that verifies pre-migration argon2 password hashes. It disappears once every account has
logged in once. See [docs/CLOUDFLARE-MIGRATION.md](docs/CLOUDFLARE-MIGRATION.md).

## Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| API Framework | **Hono** | Runs on the Workers fetch runtime, small, TypeScript-first |
| Compute | **Cloudflare Workers** | No server, no scaling to think about, free at this size |
| Database | **D1** (SQLite) | Same platform as the Worker, no connection pooling, no egress cost |
| ORM | **Drizzle** | Type-safe SQL, no codegen step, raw-SQL escape hatch |
| JWT Algorithm | **EdDSA (Ed25519)** | Smaller tokens than RS256, fast, modern standard (RFC 8037) |
| Password Hashing | **PBKDF2-SHA256 + pepper** | WebCrypto, the only option on Workers; a server-side pepper offsets the free plan's iteration cap |
| Image Resizing | **Browser canvas** | sharp is a native addon and cannot run on Workers, so the resize moved client-side |
| File Storage | **Cloudflare R2** | No egress fees, bound directly to the Worker, served from a custom domain |
| Monorepo | **pnpm workspaces** | Shared types and constants, single lockfile |
| Validation | **Zod** | Same schemas on both sides, TypeScript inference |
| Email Verification | **HMAC signed tokens** | Stateless, timing-safe comparison, expiry inside the token |
| Error Handling | **Centralized error codes** | Shared constants, bilingual mapping via i18n |

## Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, React Router 7 |
| Backend | Hono, Drizzle ORM, Cloudflare D1 |
| Auth | JWT EdDSA (Ed25519 via jose), PBKDF2 (WebCrypto), OAuth (Google, Facebook) |
| Validation | Zod (shared frontend/backend) |
| Payments | Stripe Checkout |
| Emails | Brevo (transactional) |
| File Storage | Cloudflare R2 |
| Infrastructure | Cloudflare Pages + Workers + D1 + R2 |
| Monorepo | pnpm workspaces, Vite (web), wrangler (worker) |
| CI/CD | GitHub Actions — lint, typecheck, tests, then deploy |
| Testing | Vitest |

## Environments

| | Production | Staging |
|---|---|---|
| Site | `badgeid.ca` | `staging.badge-platform.pages.dev` |
| API | `api.badgeid.ca` | `badge-api-staging.alexandre-lessard92.workers.dev` |
| Database | D1 `badge-db` | D1 `badge-db-staging` |
| Files | `files.badgeid.ca` | `files-staging.badgeid.ca` |
| Deploys from | `main` | `staging` |

The two environments share nothing. A push to `staging` deploys staging; merging to `main`
deploys production. Both refuse to deploy when a required secret is missing.

## Project Structure

```
badge-app/
├── apps/
│   ├── worker/           # Production API — Hono on Cloudflare Workers
│   │   ├── src/
│   │   │   ├── routes/       # API endpoints
│   │   │   ├── middleware/   # Auth, rate limiting
│   │   │   ├── db/           # Drizzle schema (sqlite-core) and client
│   │   │   ├── utils/        # Tokens, password, email, R2, OAuth
│   │   │   └── __tests__/    # Unit tests (Vitest)
│   │   └── migrations/       # D1 migrations
│   ├── api/              # Legacy Fastify API — serves the argon2 bridge only
│   └── web/              # React SPA
│       └── src/          # pages, components, lib, i18n, __tests__
├── packages/
│   └── shared/           # Shared types, schemas, constants, error codes
├── ops/                  # Deploy and backup scripts, migration tooling, SETUP guide
├── docs/                 # Architecture, deployment, development, API, migration log
└── .github/workflows/    # CI, CD, CD Staging, nightly D1 backup
```

`apps/api` is on its way out. Until the argon2 migration finishes, treat `apps/worker` as
the API.

## Testing

Vitest across all workspaces, run with `pnpm test`. Coverage focuses on the parts where a
mistake is expensive: password hashing and its legacy migration path, token handling, badge
code sequencing, error mapping, and the deploy-time secrets manifest.

## Getting Started

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for prerequisites, setup, and scripts.

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) — Setup, scripts, testing, environment variables
- [Deployment Guide](docs/DEPLOYMENT.md) — How deploys work, environments, rollback
- [Architecture](docs/ARCHITECTURE.md) — Technical decisions, auth flow, i18n strategy
- [Cloudflare Migration](docs/CLOUDFLARE-MIGRATION.md) — How the platform got here, and what is left
- [Production Setup](ops/SETUP.md) — Infrastructure reference
- [API Reference](docs/API.md)

## License

Copyright (c) 2025-2026 Badge. All rights reserved. See [LICENSE](LICENSE).
