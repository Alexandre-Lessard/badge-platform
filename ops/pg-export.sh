#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Export the production Postgres tables as JSON, one file per table.
# Feeds ops/pg-to-d1.py, which converts the JSON into D1-compatible SQL.
#
# Usage: ./ops/pg-export.sh <output-dir> [ssh-target]
#   ./ops/pg-export.sh /tmp/pgdata                     # local DATABASE_URL
#   ./ops/pg-export.sh /tmp/pgdata prod@192.168.50.241 # over SSH
# ──────────────────────────────────────────────

OUT_DIR="${1:?usage: pg-export.sh <output-dir> [ssh-target]}"
SSH_TARGET="${2:-}"

TABLES=(
  users products items item_photos item_documents theft_reports
  insurance_requests sessions orders order_items sticker_codes
  partners contact_messages newsletter_subscribers
)

mkdir -p "$OUT_DIR"

for table in "${TABLES[@]}"; do
  # coalesce keeps empty tables as a valid empty array rather than NULL
  query="SELECT coalesce(json_agg(t), '[]'::json) FROM \"$table\" t;"

  if [ -n "$SSH_TARGET" ]; then
    ssh -o BatchMode=yes "$SSH_TARGET" \
      "set -a; . /opt/rnbp/.env; set +a; psql \"\$DATABASE_URL\" -At -c \"$query\"" \
      > "$OUT_DIR/$table.json"
  else
    psql "$DATABASE_URL" -At -c "$query" > "$OUT_DIR/$table.json"
  fi

  count=$(python3 -c "import json,sys; print(len(json.load(open('$OUT_DIR/$table.json'))))")
  echo "$table: $count rows"
done

echo "Exported to $OUT_DIR"
