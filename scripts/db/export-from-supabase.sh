#!/usr/bin/env bash
# =============================================================================
# Export live Supabase Postgres → local backup files for a future server.
#
# What this copies (SQL):
#   - public schema (app tables, RLS policies, functions, indexes, data)
#   - optional: auth + storage *metadata* schemas (for self-hosted Supabase)
#
# What this does NOT copy:
#   - Storage FILES (images/videos in buckets) → use storage export separately
#   - Edge functions, dashboard secrets, Vercel env
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://postgres:...@db.xxx.supabase.co:5432/postgres'
#   ./scripts/db/export-from-supabase.sh
#   ./scripts/db/export-from-supabase.sh --full-supabase   # + auth, storage schemas
#   ./scripts/db/export-from-supabase.sh --schema-only
#
# Requires: pg_dump (Postgres client tools 15+)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${ROOT}/backups/db"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MODE="app"          # app | full-supabase
SCHEMA_ONLY=0

# Load URLs from .env.local if present (does not override already-exported vars)
if [[ -f "${ROOT}/.env.local" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      SUPABASE_DB_URL=*)
        [[ -z "${SUPABASE_DB_URL:-}" ]] && export "$line"
        ;;
      DATABASE_URL=*)
        [[ -z "${DATABASE_URL:-}" ]] && export "$line"
        ;;
    esac
  done < <(grep -E '^(SUPABASE_DB_URL|DATABASE_URL)=' "${ROOT}/.env.local" 2>/dev/null || true)
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full-supabase) MODE="full-supabase"; shift ;;
    --schema-only)   SCHEMA_ONLY=1; shift ;;
    --out)           OUT_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

SRC_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "${SRC_URL}" ]]; then
  cat >&2 <<'EOF'
Missing connection string.

Set one of:
  export SUPABASE_DB_URL='postgresql://postgres.[ref]:PASSWORD@db.[ref].supabase.co:5432/postgres'
  # or put SUPABASE_DB_URL=... in .env.local

Get it from: Supabase → Project Settings → Database → Connection string
Use Direct / Session (port 5432), not Transaction pooler (6543).
EOF
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  cat >&2 <<'EOF'
pg_dump not found. Install Postgres client tools:

  macOS:  brew install libpq && brew link --force libpq
  Ubuntu: sudo apt-get install -y postgresql-client
EOF
  exit 1
fi

mkdir -p "${OUT_DIR}"

SCHEMA_FLAGS=(-n public)
LABEL="public"
if [[ "${MODE}" == "full-supabase" ]]; then
  # auth = users/sessions; storage = bucket metadata (not binary files)
  SCHEMA_FLAGS=(-n public -n auth -n storage -n extensions)
  LABEL="public+auth+storage+extensions"
fi

DUMP_ARGS=(
  --no-owner
  --no-privileges
  --clean
  --if-exists
  "${SCHEMA_FLAGS[@]}"
)

if [[ "${SCHEMA_ONLY}" -eq 1 ]]; then
  DUMP_ARGS+=(--schema-only)
  KIND="schema"
else
  KIND="full"
fi

BASE="${OUT_DIR}/supabase_${LABEL//+/_}_${KIND}_${STAMP}"
SQL_FILE="${BASE}.sql"
META_FILE="${BASE}.meta.txt"

echo "==> Exporting from Supabase (${LABEL}, ${KIND})"
echo "    → ${SQL_FILE}"

# Prefer plain SQL for readability + easy partial restore.
# Large DBs: switch to custom format with -Fc if needed.
pg_dump "${SRC_URL}" "${DUMP_ARGS[@]}" -f "${SQL_FILE}"

# Also emit a custom-format dump (faster restore with pg_restore)
CUSTOM_FILE="${BASE}.dump"
pg_dump "${SRC_URL}" "${DUMP_ARGS[@]}" -Fc -f "${CUSTOM_FILE}"

{
  echo "exported_at_utc=${STAMP}"
  echo "mode=${MODE}"
  echo "kind=${KIND}"
  echo "schemas=${LABEL}"
  echo "pg_dump_version=$(pg_dump --version)"
  echo "source_host=$(echo "${SRC_URL}" | sed -E 's|.*@([^/:]+).*|\1|')"
  echo "sql_file=$(basename "${SQL_FILE}")"
  echo "dump_file=$(basename "${CUSTOM_FILE}")"
  echo "sql_bytes=$(wc -c < "${SQL_FILE}" | tr -d ' ')"
  echo "dump_bytes=$(wc -c < "${CUSTOM_FILE}" | tr -d ' ')"
} > "${META_FILE}"

# Lightweight inventory (tables in public)
if command -v psql >/dev/null 2>&1; then
  {
    echo ""
    echo "--- public tables ---"
    psql "${SRC_URL}" -v ON_ERROR_STOP=1 -Atc \
      "select tablename from pg_tables where schemaname='public' order by 1;"
  } >> "${META_FILE}" 2>/dev/null || true
fi

echo ""
echo "Done."
echo "  SQL (readable):  ${SQL_FILE}"
echo "  Dump (pg_restore): ${CUSTOM_FILE}"
echo "  Meta:            ${META_FILE}"
echo ""
echo "Next (on the new server):"
echo "  export TARGET_DB_URL='postgresql://user:pass@host:5432/dbname'"
echo "  ./scripts/db/import-to-postgres.sh ${CUSTOM_FILE}"
echo ""
echo "Remember: storage FILES (avatars, photos) are NOT in this dump."
echo "See scripts/db/README.md"
