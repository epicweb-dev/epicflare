# Setup

Quick notes for getting a local epicflare environment running.

## Prerequisites

- Bun (used for installs and scripts).
- A recent Node runtime for tooling that Bun delegates to.

## Install

- `bun install`

## Local development

- Copy `.env.test` to `.env` before starting any work, then update secrets as
  needed.
- `bun run dev` (starts mock API servers automatically and sets
  `RESEND_API_BASE_URL` to the local mock Worker).
- Add new mock API servers by following `docs/agents/mock-api-servers.md`.
- If you only need the client bundle or worker, use:
  - `bun run dev:client`
  - `bun run dev:worker`
- Set `CLOUDFLARE_ENV` to switch Wrangler environments (defaults to
  `production`). Playwright sets this to `test`.

## Checks

- `bun run validate` runs format check, lint fix, build, typecheck, Playwright
  tests, and MCP E2E tests.
- `bun run test:e2e:install` to install Playwright browsers.
- `bun run test:e2e` to run Playwright specs.
- `bun run test:mcp` to run MCP server E2E tests.

## PR preview deployments

The GitHub Actions preview workflow creates per-preview Cloudflare resources so
each PR preview is isolated:

- D1 database: `<preview-worker-name>-db`
- KV namespace (OAuth state): `<preview-worker-name>-oauth-kv`

When a PR is closed, the cleanup job deletes the preview Worker(s) and these
resources as well.

Cloudflare Workers supports version `preview_urls`, but those preview URLs are
not currently available for Workers that use Durable Objects. The main app
Worker binds `MCP_OBJECT`, so app previews continue to use per-PR Worker names.
Mock Workers do not use Durable Objects, so their Wrangler configs opt into
`preview_urls = true` and the workflow includes mock version preview links when
Cloudflare returns them.

Production deploys also ensure required Cloudflare resources exist before
migrations/deploy:

- D1 database: from `env.production.d1_databases` binding `APP_DB`
- KV namespace: `OAUTH_KV` (defaults to `<worker-name>-oauth` when creating)

Both the preview and production deploy workflows run a post-deploy healthcheck
against `<deploy-url>/health` and fail the job if it does not return
`{ ok: true, commitSha }` with `commitSha` matching the commit SHA deployed by
that workflow.

If you ever need to do the same operations manually, use:

- `bun tools/ci/preview-resources.ts ensure --worker-name <name> --out-config <path>`
- `bun tools/ci/preview-resources.ts cleanup --worker-name <name>`
- `bun tools/ci/production-resources.ts ensure --out-config <path>`

## Remix package docs

Use the Remix package index for quick navigation:

- `docs/agents/remix/index.md`
