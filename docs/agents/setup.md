# Setup

Quick notes for getting a local Epicflare environment running.

## Prerequisites

- Bun (used for installs and scripts).
- A recent Node runtime for tooling that Bun delegates to.

## Install

- `bun install`

## Local development

- Copy `.env.example` to `.env` and update secrets as needed.
- `bun run dev`
- If you only need the client bundle or worker, use:
  - `bun run dev:client`
  - `bun run dev:worker`

## Checks

- `bun run validate` runs format, lint, build, and typecheck.
- `bun run test:e2e:install` to install Playwright browsers.
- `bun run test:e2e` to run Playwright specs.
