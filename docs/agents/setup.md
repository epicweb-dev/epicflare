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

If you ever need to do the same operations manually, use:

- `bun tools/ci/preview-resources.ts ensure --worker-name <name> --out-config <path>`
- `bun tools/ci/preview-resources.ts cleanup --worker-name <name>`

## Remix package docs

Use the Remix package index for quick navigation:

- `docs/agents/remix/index.md`
