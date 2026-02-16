# Setup manifest

This document describes the infrastructure and secrets that epicflare expects.

## Cloudflare resources

Create or provide the following resources (prod + preview):

- KV namespace for OAuth/session storage
  - `binding`: `OAUTH_KV`
  - title (prod): `<app-name>-oauth`
  - title (preview): `<app-name>-oauth-preview`

The post-download script can write the KV IDs into `wrangler.jsonc` and replace
template `epicflare` branding tokens with your app name across text files.

## Neon resources

Create Neon Postgres databases/branches for:

- production
- preview (PR deploys)

You will use the resulting connection strings as `DATABASE_URL` (Worker secret).

## Optional Cloudflare offerings

The starter intentionally keeps the default footprint small. If you want to add
additional Cloudflare offerings (R2, Workers AI, AI Gateway, or a separate KV
namespace for app data), see:

- `docs/cloudflare-offerings.md`

## Rate limiting (Cloudflare dashboard)

Use Cloudflare's built-in rate limiting rules instead of custom Worker logic.

1. Open the Cloudflare dashboard for the zone that routes to your Worker.
2. Go to `Security` → `WAF` → `Rate limiting rules` (or `Rules` →
   `Rate limiting rules`).
3. Create a rule that targets auth endpoints, for example:
   - Expression:
     `(http.request.method eq "POST" and http.request.uri.path in {"/auth" "/oauth/authorize" "/oauth/token" "/oauth/register"})`
   - Threshold: `10` requests per `1 minute` per IP (tune as needed).
   - Action: `Block` or `Managed Challenge`.

## Environment variables

Local development uses `.env`, which Wrangler loads automatically:

- `COOKIE_SECRET` (generate with `openssl rand -hex 32`)
- `DATABASE_URL` (required; Postgres connection string or local `sqlite:` for
  offline tests)
- `APP_BASE_URL` (optional; defaults to request origin, example
  `https://app.example.com`)
- `RESEND_API_BASE_URL` (optional, defaults to `https://api.resend.com`)
- `RESEND_API_KEY` (optional, required to send via Resend)
- `RESEND_FROM_EMAIL` (optional, required to send via Resend)

Tests use `.env.test` when `CLOUDFLARE_ENV=test` (set by Playwright).

## GitHub Actions secrets

Configure these secrets for deploy workflows:

- `CLOUDFLARE_API_TOKEN` (Workers deploy access on the correct account)
- `COOKIE_SECRET` (same format as local)
- `DATABASE_URL` (Neon Postgres connection string for production)
- `DATABASE_URL_PREVIEW` (optional; Neon Postgres connection string for preview)
- `RESEND_API_KEY` (optional, required to send via Resend)
- `RESEND_FROM_EMAIL` (optional, required to send via Resend)

Preview deploys for pull requests create a separate Worker per PR named
`<app-name>-pr-<number>` (for epicflare: `epicflare-pr-123`). The same
`CLOUDFLARE_API_TOKEN` must be able to create/update and delete those Workers.
