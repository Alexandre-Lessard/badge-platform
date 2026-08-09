#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Nightly D1 export for badge-db.
#
# D1 keeps 30 days of Time Travel on its own; this adds an off-platform copy
# in the same R2 bucket as the Postgres dumps, so a single place holds every
# backup during and after the migration.
#
# Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID and the R2 credentials
# in .backup.env. Run from the repo root.
# ──────────────────────────────────────────────

OUT_DIR="${D1_BACKUP_DIR:-/tmp/badge-d1-backups}"
RETENTION_DAYS=14

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

set -a
# shellcheck disable=SC1091
. "${BACKUP_ENV_FILE:-/opt/rnbp/.backup.env}"
set +a

mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/d1_$(date +%Y%m%d_%H%M%S).sql"

log "Exporting badge-db..."
npx wrangler d1 export badge-db --remote --env production --output "$FILE"
gzip -f "$FILE"
FILE="$FILE.gz"
log "Export OK: $FILE ($(du -h "$FILE" | cut -f1))"

log "Uploading to R2 ($R2_BACKUP_BUCKET)..."
CONTENT_SHA256=$(sha256sum "$FILE" | cut -d' ' -f1)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
  --aws-sigv4 "aws:amz:auto:s3" \
  --user "$R2_BACKUP_ACCESS_KEY:$R2_BACKUP_SECRET_KEY" \
  -H "x-amz-content-sha256: $CONTENT_SHA256" \
  --data-binary @"$FILE" \
  "$R2_BACKUP_ENDPOINT/$R2_BACKUP_BUCKET/$(basename "$FILE")")
if [ "$HTTP_CODE" != "200" ]; then
  log "ERROR: R2 upload failed (HTTP $HTTP_CODE)"
  exit 1
fi
log "R2 upload OK"

find "$OUT_DIR" -name "d1_*.sql.gz" -mtime +$RETENTION_DAYS -delete
log "Done."
