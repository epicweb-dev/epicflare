# Epicflare

A starter and reference for building full stack web applications.

## GitHub Actions secrets

Set these repository secrets for the deploy workflow:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers deploy access.
- `COOKIE_SECRET`: Random secret used to sign the `epicflare_session` cookie and
  synced to Cloudflare as the `COOKIE_SECRET` worker secret.
