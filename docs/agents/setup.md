# Setup

Quick notes for getting a local epicflare environment running.

## Prerequisites

- Bun (used for installs and scripts).
- A recent Node runtime for tooling that Bun delegates to.

## Install

- `bun install`

## Local development

- Copy `.env.example` to `.env` before starting any work, then update secrets as
  needed.
- Run `bun run mock:resend` to emulate Resend locally (stores requests in
  `mock-data/resend`). Set `RESEND_API_BASE_URL` to the mock server URL in
  `.env` and provide a placeholder `RESEND_API_KEY`.
- `bun run dev`
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

## Remix package docs

Use the Remix package index for quick navigation:

- `docs/agents/remix/index.md`
