#!/usr/bin/env bash
# Take a custom-format pg_dump of the production Supabase database. Used as
# a safety snapshot before destructive operations (Clerk migration, schema
# rewrites, large data migrations, etc.). Restore with `pg_restore`.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://postgres.<ref>:<pw>@aws-...:5432/postgres" \
#     ./scripts/db-snapshot.sh [label]
#
# `label` is appended to the filename so you can mark a snapshot's purpose
# (e.g. "pre-clerk-migrate"). Optional.
#
# Output: ./snapshots/sfmc-<UTC timestamp>[-<label>].dump
#
# Restore example (DESTRUCTIVE — wipes target):
#   pg_restore --no-owner --no-acl --clean --if-exists \
#     -d "<target-db-url>" snapshots/sfmc-20260427-220000Z-pre-clerk-migrate.dump

set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL env var is required." >&2
  echo "Get the connection string from Supabase Dashboard → Project Settings → Database → Connection string (URI)." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found in PATH. Install postgresql-client." >&2
  exit 1
fi

LABEL="${1:-}"
TS="$(date -u +%Y%m%d-%H%M%SZ)"
SUFFIX=""
[[ -n "$LABEL" ]] && SUFFIX="-${LABEL}"

mkdir -p snapshots
OUT="snapshots/sfmc-${TS}${SUFFIX}.dump"

echo "[snapshot] Dumping to ${OUT}…"
PGSSLMODE=require pg_dump \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="${OUT}" \
  "${SUPABASE_DB_URL}"

SIZE="$(du -h "${OUT}" | cut -f1)"
echo "[snapshot] OK — ${SIZE}: ${OUT}"
echo "[snapshot] Restore: pg_restore --no-owner --no-acl --clean --if-exists -d <target> ${OUT}"
