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
  `RESEND_API_BASE_URL` to the local mock host).
- Add new mock API servers by following `docs/agents/mock-api-servers.md`.
- If you only need the client bundle or worker, use:
  - `bun run dev:client`
  - `bun run dev:worker`
- Set `CLOUDFLARE_ENV` to switch Wrangler environments (defaults to
  `production`). Playwright sets this to `test`.

## Checks

- `bun run validate` runs format check, lint fix, build, typecheck, Playwright
  tests, and MCP E2E tests.
- `bun run check:mcp-sdk` verifies the dependency tree includes exactly one
  install of `@modelcontextprotocol/sdk` and that it matches the pinned version
  in `package.json`.
- `bun run typecheck` includes the MCP SDK single-install check before `tsc`.
- See `docs/agents/dependency-guardrails.md` for troubleshooting and policy
  details.
- `bun run test:e2e:install` to install Playwright browsers.
- `bun run test:e2e` to run Playwright specs.
- `bun run test:mcp` to run MCP server E2E tests.

## Remix package docs

Use the Remix package index for quick navigation:

- `docs/agents/remix/index.md`
