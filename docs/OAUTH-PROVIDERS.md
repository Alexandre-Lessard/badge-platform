# OAuth Providers — Configuration & Production Checklist

> **⚠ Review before enabling OAuth.** This document records what was registered with Google
> and Facebook when the app lived at `rnbp.ca` / `nrpp.ca`. The app now serves from
> `badgeid.ca`, so the redirect URIs, authorized domains, home page and policy links below
> are almost certainly out of date on the provider side. Verify each one in the provider
> console before switching the buttons on — a stale redirect URI fails the flow with
> `redirect_uri_mismatch`. The values here have not been updated because they describe
> external state that cannot be checked from the repo.
>
> The buttons are currently off: they are gated on `VITE_*_CLIENT_ID`, commented out in
> `apps/web/.env.production`. The Worker already holds the Google and Facebook secrets.

This document captures everything needed to configure and ship the OAuth sign-in providers (Google, Facebook, Microsoft) to public production. It is written so a future maintainer can pick it up cold without re-discovering every console URL and form field.

## Provider status

| Provider | Status | Action owner |
|---|---|---|
| Google | In production, branding verification under manual T&S review | Alexandre |
| Facebook | App Mode "In development", business verification pending Jason | Jason → Alexandre |
| Microsoft | Code wired but disabled in production (no `VITE_MICROSOFT_CLIENT_ID` set) | Post-launch |

## Code touchpoints

| Concern | File |
|---|---|
| Frontend OAuth flow (PKCE, state, redirect) | [apps/web/src/lib/oauth.ts](../apps/web/src/lib/oauth.ts) |
| Frontend buttons (provider availability) | [apps/web/src/components/auth/OAuthButtons.tsx](../apps/web/src/components/auth/OAuthButtons.tsx) |
| OAuth callback page | [apps/web/src/pages/OAuthCallbackPage.tsx](../apps/web/src/pages/OAuthCallbackPage.tsx) |
| Backend token exchange | [apps/api/src/utils/oauth.ts](../apps/api/src/utils/oauth.ts) |
| User schema (provider IDs) | [apps/api/src/db/schema.ts](../apps/api/src/db/schema.ts) (`googleId`, `facebookId`, `microsoftId`) |
| Privacy policy disclosure | [apps/web/src/i18n/locales/fr.ts](../apps/web/src/i18n/locales/fr.ts) + [en.ts](../apps/web/src/i18n/locales/en.ts) (`legal.privacyContent` section #4) |
| Account deletion procedure | [apps/web/src/pages/DataDeletionPage.tsx](../apps/web/src/pages/DataDeletionPage.tsx) |
| Privacy declaration (W3C) | [apps/web/src/root.tsx](../apps/web/src/root.tsx) — `<link rel="privacy-policy">` |

## Data we receive and store

OAuth providers return more than we keep. We deliberately store the **strict minimum** required for authentication and account identification.

| Field | Google | Facebook | Microsoft | Stored in DB |
|---|---|---|---|---|
| Provider unique ID (`sub` / `id`) | ✅ | ✅ | ✅ | `users.googleId` / `facebookId` / `microsoftId` |
| Email | ✅ | ✅ | ✅ | `users.email` |
| Email verified | ✅ | ✅ | ✅ | `users.emailVerified` |
| First name | ✅ | ✅ | ✅ | `users.firstName` |
| Last name | ✅ | ✅ | ✅ | `users.lastName` |
| Profile photo, contacts, calendar, friends, posts, etc. | ❌ Not requested | ❌ Not requested | ❌ Not requested | — |

This list is reflected in [the privacy policy section #4](../apps/web/src/i18n/locales/fr.ts) (`legal.privacyContent` — "Connexion via fournisseurs tiers (OAuth)").

---

## Google

### Console links

- Cloud Console (project): https://console.cloud.google.com/ — select project `rnbp-ca`
- OAuth consent screen / Branding: https://console.cloud.google.com/auth/branding
- Audience (publishing status, test users): https://console.cloud.google.com/auth/audience
- Clients (OAuth client IDs): https://console.cloud.google.com/apis/credentials
- Verification Center: https://console.cloud.google.com/auth/verification

### Configuration checklist

| Item | Value |
|---|---|
| Project ID | `rnbp-ca` |
| Scopes | `openid`, `email`, `profile` (non-sensitive — no extra verification required) |
| Publishing status | In production |
| User type | External |
| App name | RNBP |
| User support email | `tech@rnbp.ca` |
| Developer contact | `tech@rnbp.ca` |
| App logo | 120×120+ PNG, light background, no text |
| Application home page | `https://rnbp.ca/` |
| Application privacy policy link | `https://rnbp.ca/privacy` |
| Application terms of service link | `https://rnbp.ca/terms` |
| Authorized domains | `rnbp.ca`, `nrpp.ca` |
| Search Console domain ownership | `rnbp.ca` and `nrpp.ca`, owner = `tech@rnbp.ca` |

### OAuth clients

Two clients in `Credentials → OAuth 2.0 Client IDs`:

**RNBP Prod**
- Authorized JavaScript origins: `https://rnbp.ca`, `https://nrpp.ca`
- Authorized redirect URIs: `https://rnbp.ca/auth/google/callback`, `https://nrpp.ca/auth/google/callback`
- Used by: production deploys (set in `apps/web/.env` and `apps/api/.env` on the prod server)

**RNBP Dev**
- Authorized JavaScript origins: `http://localhost:5173`
- Authorized redirect URIs: `http://localhost:5173/auth/google/callback`
- Used by: local dev (`pnpm dev`)

### Branding verification

Because Google's automated branding verifier returns non-deterministic results on conformant HTML, the supported escape hatch is to request a **manual review** from the Trust & Safety team.

1. Form: https://support.google.com/cloud/contact/oauth_app_verification
2. Authenticate as `tech@rnbp.ca` (the project owner)
3. Reference the `rnbp-ca` project
4. Provide evidence (Rich Results Test URL, verified domain, prerendered HTML)
5. Wait 1–14 days for a human reply

A submission template is preserved in the project sprint plan; reuse it verbatim if a fresh submission is needed.

### Recovery if the auto-verifier rejects

1. Confirm the page is still rendered correctly via https://search.google.com/test/rich-results?url=https://rnbp.ca/
2. Confirm the privacy policy and terms pages return 200 publicly (`curl -I`)
3. Confirm `<link rel="privacy-policy">` is still in the served HTML head
4. Re-submit a manual T&S review with the latest commit hash and the rendered HTML excerpt
5. Do **not** keep clicking the auto-verify button — each retry burns reputation with the classifier

---

## Facebook

### Console links

- Apps list: https://developers.facebook.com/apps/
- App dashboard (RNBP): https://developers.facebook.com/apps/1667886064239370/
- Basic settings: https://developers.facebook.com/apps/1667886064239370/settings/basic/
- Use cases: https://developers.facebook.com/apps/1667886064239370/use_cases/
- App Review → Permissions and Features: https://developers.facebook.com/apps/1667886064239370/app-review/permissions/
- Business Manager / Security Center: https://business.facebook.com/settings/security

### Configuration checklist

| Item | Value |
|---|---|
| App ID | `1667886064239370` |
| Display name | RNBP |
| App secret | Stored in `apps/api/.env` as `FACEBOOK_CLIENT_SECRET` |
| App icon | 1024×1024 PNG (RNBP shield) |
| Category | Utility & productivity |
| Business Use | Selected via business portfolio link |
| App domains | `rnbp.ca`, `nrpp.ca` |
| Contact email | `tech@rnbp.ca` |
| Privacy Policy URL | `https://rnbp.ca/privacy` |
| Terms of Service URL | `https://rnbp.ca/terms` |
| User data deletion | Mode "Data deletion instructions URL" → `https://rnbp.ca/data-deletion` |
| Business linked | "Registre national des biens personnels" (Business Portfolio) |
| Use case | "Authenticate and request data from users with Facebook Login" — customised |
| Permissions enabled | `email`, `public_profile` |
| App Mode | In development → switch to **Live** after business verification + app review |

### Path to Live mode

Three gates must be cleared, in order:

1. **Business verification** (one-time per business portfolio)
   - Started in https://business.facebook.com/settings/security → Business verification → Start verification
   - Requires: legal entity name (matching the Quebec REQ entry exactly), incorporation document, address
   - Meta may force a specific admin to complete it (not always the one who started). The chosen admin gets an in-app notification.
   - Currently in progress under Jason's account.

2. **App Review for `email`** (and `public_profile` if not auto-granted)
   - https://developers.facebook.com/apps/1667886064239370/app-review/permissions/
   - For each requested permission, click "Request Advanced Access"
   - Required artifact: a 30–60 second screencast (MP4, ≤10 MB) showing:
     1. RNBP homepage
     2. Click "Continue with Facebook"
     3. Facebook consent screen
     4. Successful return to RNBP, user logged in
   - Submit with a short written description of the use case (account creation and login)

3. **Switch App Mode to Live**
   - From the app dashboard, top-right toggle "In development → Live"
   - If prerequisites are missing Meta surfaces a checklist popup; complete each item before retrying

After Live, validate end-to-end with a Facebook account that is **not** an admin or test user of the app.

---

## Microsoft (deferred to post-launch)

The code path is wired (`apps/api/src/utils/oauth.ts` `exchangeMicrosoftCode`, frontend button in `OAuthButtons.tsx`, `microsoftId` column in DB) but the production env does **not** set `VITE_MICROSOFT_CLIENT_ID`, so the button is hidden in the UI and the `/auth/microsoft/callback` route is unreachable in practice.

To activate after launch:

1. Register an app at https://entra.microsoft.com/ → App registrations → New registration
2. Set redirect URIs: `https://rnbp.ca/auth/microsoft/callback`, `https://nrpp.ca/auth/microsoft/callback`, `http://localhost:5173/auth/microsoft/callback`
3. Note the Application (client) ID and Directory (tenant) ID
4. Generate a client secret in Certificates & secrets
5. Add to env vars:
   - Frontend: `VITE_MICROSOFT_CLIENT_ID=...`
   - Backend: `MICROSOFT_CLIENT_ID=...`, `MICROSOFT_CLIENT_SECRET=...`
6. Update the privacy policy section #4 to mention Microsoft alongside Google and Facebook
7. Re-deploy

No additional verification is needed — Microsoft's app registration does not gate basic sign-in scopes (`openid profile email`) behind a review process.

---

## Quick troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Google sign-in shows "unverified app" warning to users | Branding verification not yet approved | Wait for T&S manual review; users can click "Advanced → Continue" in the meantime |
| Google auto-verifier rejects with "no privacy policy link" | Classifier ML noise — page is conformant | Submit manual T&S review, do not retry auto-verifier |
| Facebook sign-in returns "App not active" | App Mode = In development | Verify business verification + app review status, switch to Live |
| OAuth callback returns "redirect_uri mismatch" | Redirect URI not whitelisted in the provider console | Add the exact URI (including protocol and trailing path) to the OAuth client |
| Local dev OAuth button does nothing | `VITE_*_CLIENT_ID` env var missing in `apps/web/.env` | Set the dev client IDs and restart `pnpm dev` |
