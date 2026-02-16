#!/usr/bin/env bash
set -euo pipefail

service_name="${POSTGRES_SERVICE_NAME:-postgres}"
query="${*:-SELECT now() AS now, current_user AS current_user, current_database() AS current_database;}"

compose=(docker compose)
if ! "${compose[@]}" version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    compose=(docker-compose)
  else
    echo "error: docker compose is not installed" >&2
    exit 1
  fi
fi

"${compose[@]}" up -d "${service_name}" >/dev/null

pg_user="$("${compose[@]}" exec -T "${service_name}" printenv POSTGRES_USER | tr -d '\r')"
pg_db="$("${compose[@]}" exec -T "${service_name}" printenv POSTGRES_DB | tr -d '\r')"

max_attempts=30
for attempt in $(seq 1 "${max_attempts}"); do
  if "${compose[@]}" exec -T "${service_name}" pg_isready -U "${pg_user}" -d "${pg_db}" >/dev/null 2>&1; then
    break
  fi
  if [[ "${attempt}" == "${max_attempts}" ]]; then
    echo "error: postgres did not become ready in time" >&2
    "${compose[@]}" logs "${service_name}" >&2 || true
    exit 1
  fi
  sleep 1
done

"${compose[@]}" exec -T "${service_name}" psql -X -v ON_ERROR_STOP=1 -U "${pg_user}" -d "${pg_db}" -c "${query}"
