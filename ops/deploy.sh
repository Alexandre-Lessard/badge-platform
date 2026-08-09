#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# RNBP Deploy Script
# Usage: ./ops/deploy.sh [all|web|api] [--no-auto-rollback]
# ──────────────────────────────────────────────

LOCK_FILE="/tmp/rnbp-deploy.lock"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.deploy.env"
ROLLBACK_DIR=/opt/rnbp/backups/rollback

RSYNC_EXCLUDES=(
  --exclude='node_modules'
  --exclude='.git'
  --exclude='dist'
  --exclude='.env'
  --exclude='.deploy.env'
  --exclude='NOTES.md'
  --exclude='notes'
  --exclude='design'
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[deploy]${NC} $1"; }
ok()    { echo -e "${GREEN}[  ok  ]${NC} $1"; }
warn()  { echo -e "${YELLOW}[ warn ]${NC} $1"; }
error() { echo -e "${RED}[error ]${NC} $1" >&2; }

usage() {
  echo "Usage: ./ops/deploy.sh [all|web|api] [--no-auto-rollback]"
  echo ""
  echo "  all                  Deploy both frontend and backend (default)"
  echo "  web                  Deploy frontend to Cloudflare Pages only"
  echo "  api                  Deploy backend to server only"
  echo "  --no-auto-rollback   Disable automatic rollback on failure"
  echo ""
  echo "Requires .deploy.env at project root (see .deploy.env.example)"
  exit 0
}

cleanup() {
  rm -f "$LOCK_FILE"
}

# ── Args ──────────────────────────────────────

TARGET="all"
AUTO_ROLLBACK=true

for arg in "$@"; do
  case "$arg" in
    --help|-h) usage ;;
    --no-auto-rollback) AUTO_ROLLBACK=false ;;
    all|web|api) TARGET="$arg" ;;
    *) error "Unknown argument: $arg"; usage ;;
  esac
done

# ── Lock ──────────────────────────────────────

if [[ -f "$LOCK_FILE" ]]; then
  error "Deploy already in progress (lock: $LOCK_FILE)"
  error "If this is stale, remove it: rm $LOCK_FILE"
  exit 1
fi

trap cleanup EXIT
echo $$ > "$LOCK_FILE"

# ── Load config ───────────────────────────────

if [[ ! -f "$ENV_FILE" ]]; then
  error ".deploy.env not found at $ENV_FILE"
  error "Copy .deploy.env.example and fill in your values"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

# Validate required vars
for var in DEPLOY_SERVER DEPLOY_DIR CF_PROJECT API_HEALTH_URL; do
  if [[ -z "${!var:-}" ]]; then
    error "Missing $var in .deploy.env"
    exit 1
  fi
done

cd "$ROOT_DIR"

# ── Pre-checks ────────────────────────────────

COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
log "Deploying commit: $COMMIT ($(git log -1 --format='%s' 2>/dev/null || echo 'unknown'))"

# ── Build ─────────────────────────────────────

log "Building..."
pnpm --filter @badge/shared build
if [[ "$TARGET" == "web" || "$TARGET" == "all" ]]; then
  pnpm --filter @badge/web build
fi
if [[ "$TARGET" == "api" || "$TARGET" == "all" ]]; then
  pnpm --filter @badge/api build
fi
ok "Build complete"

# ── Rollback helper ──────────────────────────

SNAPSHOT_FILE=""

do_rollback() {
  if [[ -z "$SNAPSHOT_FILE" ]]; then
    error "No snapshot available for rollback"
    return 1
  fi

  warn "Rolling back to previous dist..."
  ssh "$DEPLOY_SERVER" "tar -xzf $SNAPSHOT_FILE -C $DEPLOY_DIR" || {
    error "Rollback restore failed!"
    return 1
  }
  ok "Snapshot restored"

  ssh "$DEPLOY_SERVER" "sudo systemctl restart rnbp-api"
  sleep 3

  for i in 1 2 3; do
    if ssh "$DEPLOY_SERVER" "curl -sf http://localhost:3000/api/health" > /dev/null 2>&1; then
      ok "Rollback health check passed — service restored"
      return 0
    fi
    sleep 2
  done

  error "Rollback health check also failed!"
  error "Manual intervention required: ssh $DEPLOY_SERVER 'sudo journalctl -u rnbp-api -n 50'"
  return 1
}

try_auto_rollback() {
  if [[ "$AUTO_ROLLBACK" != "true" ]]; then
    error "Auto-rollback disabled. To rollback manually: pnpm run rollback"
    exit 1
  fi

  if [[ -t 0 ]]; then
    read -rp "$(echo -e "${YELLOW}Automatic rollback? [Y/n]${NC} ")" REPLY
    if [[ "$REPLY" =~ ^[Nn]$ ]]; then
      error "Rollback skipped. To rollback manually: pnpm run rollback"
      exit 1
    fi
  else
    warn "Non-interactive mode — auto-rollback in progress..."
  fi

  do_rollback
  exit 1
}

# ── Deploy Web ────────────────────────────────

deploy_web() {
  log "Deploying frontend to Cloudflare Pages..."
  CLOUDFLARE_ACCOUNT_ID=3aa12f83f9d4006cfd805489b6d65eb8 npx wrangler pages deploy build/client --project-name "$CF_PROJECT" --cwd apps/web
  ok "Frontend deployed"
}

# ── Deploy API ────────────────────────────────

deploy_api() {
  # Snapshot current dist for rollback
  log "Snapshotting current API build for rollback..."
  SNAPSHOT_FILE=$(ssh "$DEPLOY_SERVER" bash -s <<SNAPSHOT
    mkdir -p $ROLLBACK_DIR
    DIST_DIR=$DEPLOY_DIR/apps/api/dist
    if [ -d "\$DIST_DIR" ]; then
      TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
      FILE="$ROLLBACK_DIR/\${TIMESTAMP}_${COMMIT}.tar.gz"
      tar -czf "\$FILE" -C $DEPLOY_DIR apps/api/dist apps/api/node_modules
      if tar -tzf "\$FILE" > /dev/null 2>&1; then
        echo "\$FILE"
      else
        rm -f "\$FILE"
        echo ""
      fi
      # Keep only last 3 dist snapshots
      ls -1t $ROLLBACK_DIR/*.tar.gz 2>/dev/null | grep -v 'db_' | tail -n +4 | xargs -r rm
    else
      echo ""
    fi
SNAPSHOT
  )

  if [[ -n "$SNAPSHOT_FILE" ]]; then
    ok "Snapshot saved: $(basename "$SNAPSHOT_FILE")"
  else
    warn "No existing dist to snapshot (first deploy?)"
  fi

  log "Syncing code to $DEPLOY_SERVER..."
  rsync -avz "${RSYNC_EXCLUDES[@]}" "$ROOT_DIR/" "$DEPLOY_SERVER:$DEPLOY_DIR/"
  ok "Code synced"

  log "Installing dependencies and building on server..."
  if ! ssh "$DEPLOY_SERVER" "source ~/.nvm/nvm.sh && cd $DEPLOY_DIR && pnpm install --frozen-lockfile && pnpm --filter @badge/shared build && pnpm --filter @badge/api build"; then
    error "Server build failed!"
    try_auto_rollback
  fi
  ok "Server build complete"

  # Pre-restart DB backup (if migration files present)
  log "Checking for pending migrations..."
  MIGRATION_FILES=$(ssh "$DEPLOY_SERVER" "ls -1 $DEPLOY_DIR/apps/api/drizzle/*.sql 2>/dev/null" || true)

  if [[ -n "$MIGRATION_FILES" ]]; then
    log "Migration files detected — backing up database..."
    DB_BACKUP=$(ssh "$DEPLOY_SERVER" bash -s <<'DBDUMP'
      source /opt/rnbp/.env
      ROLLBACK_DIR=/opt/rnbp/backups/rollback
      TIMESTAMP=$(date +%Y%m%d_%H%M%S)
      FILE="$ROLLBACK_DIR/db_${TIMESTAMP}.sql.gz"
      if pg_dump "$DATABASE_URL" | gzip > "$FILE" 2>/dev/null; then
        echo "$FILE"
      else
        rm -f "$FILE"
        echo ""
      fi
      # Keep only last 3 db dumps
      ls -1t $ROLLBACK_DIR/db_*.sql.gz 2>/dev/null | tail -n +4 | xargs -r rm
DBDUMP
    )

    if [[ -n "$DB_BACKUP" ]]; then
      ok "Database backed up: $(basename "$DB_BACKUP")"
    else
      warn "Database backup failed — migrations will still run at startup"
    fi
    log "Migrations will be applied automatically on service restart"
  else
    ok "No pending migrations"
  fi

  log "Restarting API service..."
  ssh "$DEPLOY_SERVER" "sudo systemctl restart rnbp-api"
  ok "API service restarted"

  # Health check
  log "Waiting for API to start..."
  sleep 3

  for i in 1 2 3; do
    if ssh "$DEPLOY_SERVER" "curl -sf http://localhost:3000/api/health" > /dev/null 2>&1; then
      ok "Health check passed"
      return 0
    fi
    warn "Health check attempt $i/3 failed, retrying in 2s..."
    sleep 2
  done

  error "Health check failed after 3 attempts!"
  error "Check logs: ssh $DEPLOY_SERVER 'sudo journalctl -u rnbp-api -n 50'"
  try_auto_rollback
}

# ── Execute ───────────────────────────────────

case "$TARGET" in
  web) deploy_web ;;
  api) deploy_api ;;
  all)
    deploy_web
    deploy_api
    ;;
esac

# ── Done ──────────────────────────────────────

echo ""
ok "Deploy complete!"
log "Commit deployed: $COMMIT"
