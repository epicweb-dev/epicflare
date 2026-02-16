# Postgres via Docker Compose

This repo uses Cloudflare D1 (SQLite) by default, but it can still be useful to
spin up a local Postgres instance for experiments or integration work.

## Start Postgres

- `docker compose up -d postgres`

The compose file lives at `docker-compose.yml` in the repo root.

## Run a query

Option A: run `psql` inside the container (no local `psql` needed):

- `docker compose exec -T postgres psql -U epicflare -d epicflare -c "select 1 as ok;"`

Option B: use the helper script (starts Postgres if needed, waits for readiness,
then runs your SQL):

- `tools/postgres/run-query.sh 'select 1 as ok;'`

## Configuration

`docker-compose.yml` supports:

- `POSTGRES_USER` (default `epicflare`)
- `POSTGRES_PASSWORD` (default `epicflare`)
- `POSTGRES_DB` (default `epicflare`)
- `POSTGRES_PORT` (default `5432`)

Compose automatically reads a root `.env` file, so exporting variables in your
shell is usually enough for quick overrides.

## Tear down / reset

- Stop containers: `docker compose down`
- Stop containers + delete data volume: `docker compose down --volumes`
