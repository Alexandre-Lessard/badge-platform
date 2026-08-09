# API Reference

Base URL: `https://api.badgeid.ca/api` (production) / `http://localhost:8787/api` (development)

## Authentication

Most endpoints require authentication via a Bearer token in the `Authorization` header:
```
Authorization: Bearer <accessToken>
```

Auth levels:
- **None** — Public endpoint
- **requireAuth** — Valid access token required
- **requireVerifiedEmail** — Valid access token + verified email required
- **requireAdmin** — Valid access token + admin role required

---

## Auth

All auth endpoints that return a `user` use the same DTO shape:
```
user: {
  id, email, contactEmail, firstName, lastName, phone,
  address1, address2, city, province, postalCode, country,
  emailVerified, isAdmin, clientNumber,
  preferredLanguage, termsAcceptedAt, createdAt
}
```

### POST /auth/register
Auth: None | Rate limit: 5/min
```
Body: { email, password, firstName, lastName, phone?, preferredLanguage?: "fr"|"en" }
Response: { user, accessToken, refreshToken }
```

### POST /auth/login
Auth: None | Rate limit: 5/min
```
Body: { email, password }
Response: { user, accessToken, refreshToken }
```

### POST /auth/refresh
Auth: None | Rate limit: 30/min
```
Body: { refreshToken }
Response: { accessToken, refreshToken }
```

### POST /auth/logout
Auth: requireAuth
```
Body: { refreshToken? }
Response: { code: "LOGOUT_SUCCESS" }
```
If refreshToken provided, only that session is deleted. Otherwise all sessions are revoked.

### GET /auth/me
Auth: requireAuth
```
Response: { user }
```

### PATCH /auth/profile
Auth: requireAuth
```
Body: {
  firstName?, lastName?, phone?, contactEmail?,
  address1?, address2?, city?, province?, postalCode?, country?,
  preferredLanguage?: "fr"|"en"
}
Response: { success: true }
```
Empty strings are normalized to `null`. If address fields are provided without `country`, the backend defaults it to `CA`.

`contactEmail` is the address a finder can be relayed to when one of the user's items is recovered. It is
validated as an email, trimmed and lowercased, and is **never exposed publicly** — the lookup relay sends
to it without revealing it. Send `""` to clear it. Omitting the field leaves the stored value untouched.
When unset, `users.email` is the fallback. Not independently verified.

### POST /auth/forgot-password
Auth: None | Rate limit: 3/min
```
Body: { email }
Response: { code: "PASSWORD_RESET_SENT" }
```
Silent failure on non-existent email.

### POST /auth/reset-password
Auth: None | Rate limit: 5/min
```
Body: { token, password }
Response: { code: "PASSWORD_RESET_SUCCESS" }
```

### POST /auth/verify-email
Auth: None | Rate limit: 10/min
```
Body: { token }
Response: { code: "EMAIL_VERIFIED" }
```

### POST /auth/resend-verification
Auth: requireAuth | Rate limit: 3/min
```
Response: { code: "VERIFICATION_SENT" | "EMAIL_ALREADY_VERIFIED" }
```

### POST /auth/register-with-item
Auth: None
```
Body: {
  account: { email, password, firstName, lastName, phone?, preferredLanguage? },
  item: { name, category, brand?, model?, year?, serialNumber?, trackerId?, estimatedValue?, description?, purchaseDate? }
}
Response: { user, item, accessToken, refreshToken }
```
Atomic user + item creation in a single transaction.

---

## OAuth

### POST /auth/google
Auth: None | Rate limit: 5/min
```
Body: { code, redirectUri, codeVerifier }
Response: { user, accessToken, refreshToken } | { needsEmail: true, pendingToken }
```
Authorization Code + PKCE flow.

### POST /auth/facebook
Auth: None | Rate limit: 5/min
```
Body: { code, redirectUri }
Response: { user, accessToken, refreshToken } | { needsEmail: true, pendingToken }
```
Authorization Code flow (no PKCE).

### POST /auth/microsoft
Auth: None | Rate limit: 5/min
```
Body: { code, redirectUri, codeVerifier }
Response: { user, accessToken, refreshToken } | { needsEmail: true, pendingToken }
```
Authorization Code + PKCE flow.

### POST /auth/oauth-complete
Auth: None | Rate limit: 5/min
```
Body: { token, email }
Response: { user, accessToken, refreshToken }
```
Completes the missing-email OAuth flow.

---

## Items

### GET /items
Auth: requireVerifiedEmail
```
Query: ?archived=true (optional)
Response: { items: [{ ..., primaryPhotoUrl }] }
```
`primaryPhotoUrl` is selected from the oldest `isPrimary=true` photo; if none is marked primary, the API falls back to the oldest photo for that item.

### POST /items
Auth: requireVerifiedEmail
```
Body: { name, category, brand?, model?, year?, serialNumber?, trackerId?, estimatedValue?, description?, purchaseDate?,
        isInsured?, insurerId?, insurerName? }
Response: { item } (201)
```

### GET /items/:id
Auth: requireVerifiedEmail
```
Response: { item: { ...item, photos: [...], documents: [...] } }
```
Photos are returned with the primary photo first, then the remaining photos in ascending creation order.

### PATCH /items/:id
Auth: requireVerifiedEmail
```
Body: { name?, category?, brand?, model?, year?, serialNumber?, trackerId?, estimatedValue?, description?, purchaseDate?,
        isInsured?, insurerId?, insurerName? }
Response: { item }
```

**Insurance fields.** `isInsured` is a boolean (default `false`); `insurerId` is an id from the shared
`INSURERS` list (`packages/shared/src/constants/insurers.ts`); `insurerName` is a snapshot of the label at
save time, kept as a fallback if an insurer is ever removed from the list. Clients should render the name
from `insurerId` so it follows the active language, and fall back to `insurerName` only when the id no
longer resolves.

### POST /items/:id/archive
Auth: requireVerifiedEmail
```
Body: { reason: "destroyed"|"lost"|"discarded"|"registration_error"|"other", customReason? }
Response: { item }
```
Cannot archive stolen items.

### PATCH /items/:id/recover
Auth: requireVerifiedEmail
```
Response: { item }
```
Marks stolen item as active. Resolves pending theft reports (transactional).

### DELETE /items/:id
Auth: requireVerifiedEmail
```
Response: 204 No Content
```
Deletes R2 files before database cascade delete.

---

## Uploads

All upload endpoints accept multipart/form-data. Photos are resized to max 1920px and converted to WebP.

### POST /items/:id/photos
Auth: requireVerifiedEmail
```
Body: multipart form data (field: "photos")
Response: { photos: [{ id, url, caption, isPrimary }], maxReached: boolean } (201)
```
Max 5 photos per item.

### POST /items/:id/documents
Auth: requireVerifiedEmail
```
Body: multipart form data (field: "documents")
Response: { documents: [{ id, url, type, fileName }], maxReached: boolean } (201)
```
Max 10 documents per item. PDFs uploaded as-is, images resized to WebP.

### DELETE /items/:id/photos/:photoId
Auth: requireVerifiedEmail
```
Response: 204 No Content
```
If the deleted photo was primary and photos remain, the oldest remaining photo is promoted to `isPrimary=true`.

### DELETE /items/:id/documents/:docId
Auth: requireVerifiedEmail
```
Response: 204 No Content
```

---

## Public Lookup

### GET /lookup
Auth: None | Rate limit: 30/min
```
Query: ?q=BADGE-XXXXXXXX (or serial number)
Response: { found: false } | { found: true, status, category, brand, model }
```
Normalizes serial numbers (strips spaces, dashes, underscores).
The unified lookup currently supports Badge codes and serial numbers only.

### GET /lookup/:badgeCode
Auth: None | Rate limit: 30/min
```
Response: { found: false } | { found: true, status, category, brand, model }
```
Backward compatibility endpoint.

---

## Reports

### POST /reports
Auth: requireVerifiedEmail
```
Body: { itemId, policeReportNumber?, theftDate?, theftLocation?, description? }
Response: { report } (201)
```
Updates item status to "stolen" (transactional). Prevents duplicate reports.

### GET /reports
Auth: requireAuth
```
Response: { reports: [...] }
```

---

## Shop

### GET /shop/products
Auth: None
```
Response: { products: [...] }
```
Active products only, ordered by sortOrder.

### GET /shop/status
Auth: None
```
Response: { available: boolean }
```

### POST /shop/checkout
Auth: requireVerifiedEmail
```
Body: { items: [{ productId, quantity: 1-50, itemId? }], email? }
Response: { url: string }
```
Returns a Stripe Checkout session URL. Items with `requiresItem=true` need a valid `itemId`.

### POST /shop/webhook
Auth: Stripe signature | Rate limit: 200/min
```
Body: Raw Stripe event
Response: { received: true }
```
Handles `checkout.session.completed` and `checkout.session.expired`. On expired, soft-voids any unclaimed `sticker_codes` linked to the order's lines.

---

## Sticker Codes

### POST /sticker-codes/:code/claim
Auth: requireVerifiedEmail | Rate limit: 5/min
```
Body: { itemId: uuid }
Response: { success: true, code, itemId, alreadyClaimed?: true }
```
Assigns one of the caller's purchased Badge codes to one of their items. The `:code` param is normalized (whitespace stripped, uppercased) before validation. Errors: `INVALID_BADGE_FORMAT` (400), `BADGE_CODE_UNKNOWN` (404), `BADGE_CODE_VOIDED` (410), `BADGE_CODE_NOT_YOURS` (403), `BADGE_CODE_ALREADY_USED` (409), `ITEM_NOT_FOUND` (404), `ITEM_ALREADY_STOLEN` (400). If the target item already holds another code, that previous code is released atomically.

### GET /sticker-codes/:code/scan
Auth: optional (`tryAuth`) | Rate limit: 30/min
```
Response (always 200):
{
  format: "valid" | "invalid",
  exists?: boolean,                     // true if code sold (in sticker_codes)
  voided?: boolean,                     // true if soft-voided
  ownedByMe?: boolean,                  // requester purchased this code
  assignableByMe?: boolean,             // ownedByMe && code not yet assigned
  item?: {                              // present if code is assigned to an item
    found: true,
    status: "active" | "stolen" | "recovered" | "transferred",
    category, brand, model,
    isYours: boolean,                   // requester owns the linked item
    itemId?: uuid                       // present only if isYours
  }
}
```
Backs the public QR-scan landing page at `/c/:code`. Always returns 200 so the SPA can render a single context-aware view (anonymous public lookup, claim affordance for the code's owner, private shortcut for the item's owner). The `:code` param is normalized before validation; an unrecognized format returns `{ format: "invalid" }` rather than 4xx.

---

## Admin

### GET /admin/clients
Auth: requireAdmin
```
Query: ?q=searchterm&page=1&limit=50
Response: { clients: [{ id, email, firstName, lastName, clientNumber, emailVerified, createdAt }], total, page, limit }
```
Registered users, newest first. `q` matches case-insensitively on email, first name, last name or client
number. `limit` defaults to 50 and is capped at 100. Never returns `passwordHash`.

### GET /admin/items
Auth: requireAdmin
```
Query: ?status=stolen&q=searchterm&page=1&limit=25
Response: { items: [{ id, name, category, status, badgeCode, serialNumber, createdAt, ownerName, ownerEmail }], pagination: { page, limit, total } }
```

### PATCH /admin/items/:id/recover
Auth: requireAdmin
```
Response: { item }
```

### GET /admin/orders
Auth: requireAdmin
```
Query: ?status=paid|shipped|cancelled
Response: { orders: [{ ...order, items: [...] }] }
```

### GET /admin/orders/:id
Auth: requireAdmin
```
Response: { order: { ...order, customer, items: [{ ..., codes: [{ code, claimedAt, voidedAt }] }] } }
```
Each sticker-sheet order line carries the codes registered during shipment preparation.

### POST /admin/orders/:id/items/:orderItemId/codes
Auth: requireAdmin
```
Body: { ranges: [{ firstCode: "BADGE-XXXXXXXX", lastCode: "BADGE-XXXXXXXX" }, ...] }
Response: { codes: string[] } (201)
```
Registers sticker codes during shipment preparation. One range = one sheet of 10 sequential codes. Total `ranges.length × 10` must equal `orderItem.quantity × 10`. Returns the expanded list of codes.

### DELETE /admin/orders/:id/items/:orderItemId/codes
Auth: requireAdmin
```
Response: { voidedCount: number }
```
Soft-voids all unclaimed codes for the order line (admin correction). Refused if any code has been claimed by the customer.

### PATCH /admin/orders/:id/ship
Auth: requireAdmin
```
Response: { order }
```
Validates that every sticker-sheet line has exactly `quantity × 10` codes registered via POST /codes. Rejects with `CODES_NOT_REGISTERED` otherwise.

### GET /admin/products
Auth: requireAdmin
```
Response: { products: [...] }
```

### GET /admin/products/:id
Auth: requireAdmin
```
Response: { product }
```

### POST /admin/products
Auth: requireAdmin
```
Body: { slug, nameFr, nameEn, descriptionFr?, descriptionEn?, featuresFr?, featuresEn?, priceCents, stripePriceId?, imageUrl?, isActive?, sortOrder? }
Response: { product } (201)
```

### PATCH /admin/products/:id
Auth: requireAdmin
```
Body: { slug?, nameFr?, nameEn?, priceCents?, stripePriceId?, imageUrl?, isActive?, sortOrder?, ... }
Response: { product }
```

### GET /admin/stats
Auth: requireAdmin
```
Response: { totalUsers, verifiedUsers, totalItems, totalEstimatedValue, totalOrders, totalRevenue, activeTheftReports, newsletterSubscribers, itemsByCategory, itemsByStatus }
```

### GET /admin/stats/charts
Auth: requireAdmin
```
Query: ?period=day|week|month
Response: { registrations: [...], items: [...], revenue: [...] }
```

### GET /admin/metrics/live
Auth: JWT token via query param
```
Query: ?token=<accessToken>
Response: Server-Sent Events (SSE) stream
```
Real-time server metrics: CPU, memory, database, request rate.

### GET /admin/activity
Auth: requireAdmin
```
Query: ?limit=20 (max 100)
Response: { activity: [{ type, date, id, ... }] }
```

---

## Contact

### POST /contact
Auth: None | Rate limit: 5/15min
```
Body: { name, email, phone?, company?, type, message, website? }
Response: { code: "MESSAGE_SENT" } (201)
```
Honeypot: if `website` is filled, returns success without saving.

---

## Newsletter

### POST /newsletter/subscribe
Auth: None | Rate limit: 5/min
```
Body: { email }
Response: { code: "SUBSCRIPTION_SUCCESS" }
```

---

## Insurance

### POST /insurance/request
Auth: requireVerifiedEmail
```
Body: { insurerId, messageContent }
Response: { request } (201)
```

### GET /insurance/insurers
Auth: None
```
Response: { insurers: [{ id, fr, en }] }
```

---

## Health

### GET /health
Auth: None
```
Response: { status: "healthy"|"degraded", timestamp, checks: { database: "ok"|"error" } }
```
Returns 503 if database check fails.
