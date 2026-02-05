# Epicflare

A starter and reference for building full stack web applications.

## GitHub Actions secrets

Set these repository secrets for the deploy workflow:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers deploy access.
- `COOKIE_SECRET`: Random secret used to sign the `epicflare_session` cookie and
  synced to Cloudflare as the `COOKIE_SECRET` worker secret.

## Local development

Copy `.env.example` to `.env` for Wrangler to load local env vars:

```
COOKIE_SECRET=dev-cookie-secret
```

Keep `.env` local (do not commit it). Wrangler reads it automatically when
running `wrangler dev` (including `bun run dev:worker`).
