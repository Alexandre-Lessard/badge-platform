#!/usr/bin/env python3
"""Convert the production Postgres data into SQL statements D1 can load.

Reads one JSON array per table (produced by `pg-export.sh`) and emits INSERT
statements matching apps/worker/src/db/schema.ts, which differs from the
Postgres schema in three ways:

  - timestamps are epoch-millisecond integers, not timestamptz
  - booleans are 0/1 integers
  - text[] columns are JSON arrays

Tables are emitted in foreign-key order so the file loads in one pass.

Stored file URLs can be repointed at the same time with --rewrite-url, which
is how the move from the rnbp-uploads bucket to badge-uploads is applied to
item_photos.url and item_documents.url.

Usage:
    ./ops/pg-export.sh /tmp/pgdata          # dumps <table>.json files
    ./ops/pg-to-d1.py /tmp/pgdata > /tmp/d1-import.sql
    ./ops/pg-to-d1.py /tmp/pgdata \\
        --rewrite-url https://pub-OLD.r2.dev=https://files.badgeid.ca > /tmp/d1-import.sql
    wrangler d1 execute badge-db --remote --file /tmp/d1-import.sql
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Load order respects foreign keys: parents before children.
TABLES = [
    "users",
    "products",
    "items",
    "item_photos",
    "item_documents",
    "theft_reports",
    "insurance_requests",
    "sessions",
    "orders",
    "order_items",
    "sticker_codes",
    "partners",
    "contact_messages",
    "newsletter_subscribers",
]

TIMESTAMP_COLUMNS = {
    "created_at",
    "updated_at",
    "expires_at",
    "claimed_at",
    "voided_at",
    "archived_at",
    "purchase_date",
    "theft_date",
    "terms_accepted_at",
    "token_revoked_before",
    "sent_at",
}

BOOLEAN_COLUMNS = {
    "email_verified",
    "is_admin",
    "is_insured",
    "is_primary",
    "is_active",
    "requires_item",
}

JSON_ARRAY_COLUMNS = {"features_fr", "features_en", "image_urls"}


def to_epoch_ms(value):
    """Postgres timestamptz (ISO 8601) → epoch milliseconds."""
    if value is None:
        return None
    text = value.replace("Z", "+00:00")
    # Postgres emits "+00" style offsets; datetime wants "+00:00"
    if len(text) >= 3 and text[-3] in "+-":
        text += ":00"
    return int(datetime.fromisoformat(text).timestamp() * 1000)


def sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def convert(column, value, url_rewrites):
    if column in TIMESTAMP_COLUMNS:
        return to_epoch_ms(value)
    if column in BOOLEAN_COLUMNS:
        return 1 if value else 0
    if column in JSON_ARRAY_COLUMNS:
        return json.dumps(value or [])
    if column == "url" and isinstance(value, str):
        for old, new in url_rewrites:
            if value.startswith(old):
                return new + value[len(old):]
    return value


def main(source_dir: Path, url_rewrites) -> int:
    print("PRAGMA defer_foreign_keys = true;")

    total = 0
    for table in TABLES:
        path = source_dir / f"{table}.json"
        if not path.exists():
            print(f"-- {table}: no export file, skipped", file=sys.stderr)
            continue

        rows = json.loads(path.read_text() or "[]")
        if not rows:
            print(f"-- {table}: empty", file=sys.stderr)
            continue

        columns = list(rows[0].keys())
        column_list = ", ".join(f'"{c}"' for c in columns)

        print(f"\n-- {table} ({len(rows)} rows)")
        for row in rows:
            values = ", ".join(
                sql_literal(convert(c, row.get(c), url_rewrites)) for c in columns
            )
            print(f'INSERT INTO "{table}" ({column_list}) VALUES ({values});')

        print(f"-- {table}: {len(rows)} rows", file=sys.stderr)
        total += len(rows)

    print(f"-- total rows: {total}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("source_dir", type=Path, help="directory of <table>.json exports")
    parser.add_argument(
        "--rewrite-url",
        action="append",
        default=[],
        metavar="OLD=NEW",
        help="repoint stored file URLs, e.g. https://pub-old.r2.dev=https://files.badgeid.ca",
    )
    args = parser.parse_args()

    rewrites = []
    for pair in args.rewrite_url:
        if "=" not in pair:
            parser.error(f"--rewrite-url expects OLD=NEW, got {pair!r}")
        old, new = pair.split("=", 1)
        rewrites.append((old.rstrip("/"), new.rstrip("/")))

    sys.exit(main(args.source_dir, rewrites))
