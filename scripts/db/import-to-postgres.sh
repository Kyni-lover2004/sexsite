#!/usr/bin/env bash
# =============================================================================
# Import a dump created by export-from-supabase.sh into a target Postgres.
#
# Usage:
#   export TARGET_DB_URL='postgresql://user:pass@your-vps:5432/desireprive'
#   ./scripts/db/import-to-postgres.sh backups/db/supabase_public_full_XXXX.dump
#   ./scripts/db/import-to-postgres.sh backups/db/supabase_public_full_XXXX.sql
#
# Flags:
#   --yes     skip confirmation
#
# Requires: pg_restore and/or psql
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ASSUME_YES=0
DUMP_PATH=""

if [[ -f "${ROOT}/.env.local" ]]; then
  # shellcheck disable=SC1091
  set -a
  # Only pull TARGET_* / SUPABASE_DB_URL if set in file (safe-ish)
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      TARGET_DB_URL=*|DATABASE_URL=*|SUPABASE_DB_URL=*)
        export "$line"
        ;;
    esac
  done < <(grep -E '^(TARGET_DB_URL|DATABASE_URL|SUPABASE_DB_URL)=' "${ROOT}/.env.local" 2>/dev/null || true)
  set +a
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      DUMP_PATH="$1"
      shift
      ;;
  esac
done

if [[ -z "${DUMP_PATH}" ]]; then
  echo "Usage: $0 [--yes] path/to/backup.dump|backup.sql" >&2
  exit 1
fi

if [[ ! -f "${DUMP_PATH}" ]]; then
  echo "File not found: ${DUMP_PATH}" >&2
  exit 1
fi

TARGET_URL="${TARGET_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "${TARGET_URL}" ]]; then
  cat >&2 <<'EOF'
Missing TARGET_DB_URL.

  export TARGET_DB_URL='postgresql://user:pass@host:5432/desireprive'
EOF
  exit 1
fi

# Safety: refuse to restore into what looks like Supabase cloud unless forced
if [[ "${TARGET_URL}" == *".supabase.co"* ]] && [[ "${ASSUME_YES}" -ne 1 ]]; then
  cat >&2 <<'EOF'
TARGET_DB_URL points at supabase.co — refusing to import (would overwrite cloud).

If you really mean it: pass --yes
EOF
  exit 1
fi

if [[ "${ASSUME_YES}" -ne 1 ]]; then
  echo "About to restore:"
  echo "  file:   ${DUMP_PATH}"
  echo "  target: $(echo "${TARGET_URL}" | sed -E 's|://([^:]+):[^@]+@|://\1:***@|')"
  read -r -p "Continue? [y/N] " ans
  case "${ans}" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

case "${DUMP_PATH}" in
  *.dump|*.fc)
    if ! command -v pg_restore >/dev/null 2>&1; then
      echo "pg_restore not found (install postgresql-client / libpq)" >&2
      exit 1
    fi
    echo "==> pg_restore → target"
    # --clean drops objects before recreate; --if-exists avoids errors on empty DB
    pg_restore \
      --no-owner \
      --no-privileges \
      --clean \
      --if-exists \
      --dbname="${TARGET_URL}" \
      "${DUMP_PATH}" || {
        # pg_restore returns non-zero on some non-fatal notices (roles, etc.)
        echo "pg_restore finished with warnings (exit $?). Check tables below." >&2
      }
    ;;
  *.sql)
    if ! command -v psql >/dev/null 2>&1; then
      echo "psql not found (install postgresql-client / libpq)" >&2
      exit 1
    fi
    echo "==> psql -f → target"
    psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -f "${DUMP_PATH}"
    ;;
  *)
    echo "Unknown dump type (use .dump or .sql): ${DUMP_PATH}" >&2
    exit 1
    ;;
esac

if command -v psql >/dev/null 2>&1; then
  echo ""
  echo "==> Spot-check public tables"
  psql "${TARGET_URL}" -c \
    "select schemaname, count(*) as tables
     from pg_tables
     where schemaname in ('public','auth','storage')
     group by 1 order by 1;"
  psql "${TARGET_URL}" -c \
    "select count(*) as profiles from public.profiles;" 2>/dev/null || true
fi

echo ""
echo "Import finished."
echo "If you imported only public schema: wire app DATABASE_URL / Supabase client"
echo "to this Postgres and migrate auth/storage as planned (see scripts/db/README.md)."
