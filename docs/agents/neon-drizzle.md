# Neon + Drizzle database

This project uses Drizzle ORM with Postgres in production (Neon) and supports
fully-offline development/testing using local databases.

## Environment variables

- `DATABASE_URL` (required)
  - Production/preview: Neon Postgres connection string (`postgres://` or
    `postgresql://`).
  - Offline (recommended): `pglite:` (in-memory) or `pglite:./.tmp/pglite-dev`
    (persistent directory).
  - Unit tests under Bun: `sqlite::memory:` or `sqlite:./.tmp/test.sqlite`.
- `DATABASE_WS_PROXY` (optional)
  - When set, Workers connect to a non-Neon Postgres instance via a WebSocket
    proxy using `@neondatabase/serverless` (`neon-serverless` adapter).
  - Typical local value: `localhost:6543/v1`.

## Schema + migrations (Postgres)

- Schema lives in `src/db/schema.ts`.
- SQL migrations live in `src/db/migrations/` and are committed.

Commands:

- `bun run db:generate` generates a new SQL migration from the schema.
- `bun run db:migrate` applies migrations to the Postgres database pointed to by
  `DATABASE_URL`.

## Offline development options

### Option A: PGlite (recommended, no Docker)

Set `DATABASE_URL=pglite:` (already the default in `.env.test`) and run:

- `bun run dev`

Tables are bootstrapped automatically for PGlite.

### Option B: Local Postgres via Docker

Start a local Postgres 16 instance:

- `bun run db:local:up`

Then set `DATABASE_URL` to point at it:

- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/epicflare?sslmode=disable`

Apply migrations:

- `bun run db:migrate`

Then start the app:

- `bun run dev`

Note: Cloudflare Workers cannot open raw TCP connections. To use the local
Postgres instance from the Worker runtime, run a WebSocket proxy (see
`@neondatabase/serverless` docs for `wsProxy`) and set `DATABASE_WS_PROXY` to
your proxy address (for example `localhost:6543/v1`).

## Offline test DB scripts

When using a persistent local test DB (for example `pglite:./.tmp/pglite-test`
or a file-backed `sqlite:` DB), helpers are available:

- `bun run db:test:reset` removes the local DB directory/file (when supported).
- `bun run db:test:migrate` bootstraps tables for `pglite:`/`sqlite:` by running
  the app’s schema bootstrap.
