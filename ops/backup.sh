#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Badge nightly database backup
# - pg_dump (gzip) to /opt/rnbp/backups/nightly/
# - integrity check, 14-day local rotation
# - offsite copy to Cloudflare R2 (badge-db-backups) via S3 API
#
# Requires:
#   /opt/rnbp/.env         → DATABASE_URL
#   /opt/rnbp/.backup.env  → R2_BACKUP_ACCESS_KEY, R2_BACKUP_SECRET_KEY,
#                            R2_BACKUP_ENDPOINT, R2_BACKUP_BUCKET
# Install (cron, as prod user):
#   0 3 * * * /opt/rnbp/repo/ops/backup.sh >> /opt/rnbp/backups/backup.log 2>&1
# ──────────────────────────────────────────────

BACKUP_DIR=/opt/rnbp/backups/nightly
RETENTION_DAYS=14

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

set -a
# shellcheck disable=SC1091
. /opt/rnbp/.env
. /opt/rnbp/.backup.env
set +a

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql.gz"

log "Dumping database..."
pg_dump "$DATABASE_URL" | gzip > "$FILE"
gunzip -t "$FILE"
log "Dump OK: $FILE ($(du -h "$FILE" | cut -f1))"

log "Uploading to R2 ($R2_BACKUP_BUCKET)..."
# curl <8.2 omits x-amz-content-sha256 from aws-sigv4 requests; pass it explicitly
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

DELETED=$(find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -print -delete | wc -l)
log "Rotation: $DELETED old local backup(s) removed (>$RETENTION_DAYS days)"
log "Done."
