# Setup manifest

This document describes the infrastructure and secrets that epicflare expects.

## Cloudflare resources

Create or provide the following resources (prod + preview):

- D1 database
  - `database_name`: `<app-name>`
  - `database_name` (preview): `<app-name>-preview`
- KV namespace for OAuth/session storage
  - `binding`: `OAUTH_KV`
  - title (prod): `<app-name>-oauth`
  - title (preview): `<app-name>-oauth-preview`

The post-download script will write the resulting IDs into `wrangler.jsonc`.

## Environment variables

Local development uses `.env`, which Wrangler loads automatically:

- `COOKIE_SECRET` (generate with `openssl rand -hex 32`)

Tests use `.env.test` when `CLOUDFLARE_ENV=test` (set by Playwright).

## GitHub Actions secrets

Configure these secrets for deploy workflows:

- `CLOUDFLARE_API_TOKEN` (Workers deploy access)
- `COOKIE_SECRET` (same format as local)
