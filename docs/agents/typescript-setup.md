# TypeScript setup

This repo uses **TypeScript project references** (build mode) so the editor and
CLI typechecking agree without forcing every file into a single TS
"environment".

## The three environments

We have **three** distinct TypeScript environments, each with its own
`tsconfig`.

### Client

- **Config**: `types/tsconfig-client.json`
- **Files**: `client/**/*.ts`, `client/**/*.tsx`
- **Environment**: browser (`DOM`, `DOM.Iterable`) + JSX (`remix/component`)

### Tools

- **Config**: `types/tsconfig-tools.json`
- **Files**:
  - `vite.config.ts`
  - `playwright.config.ts`
  - `wrangler-env.ts`
  - `cli.ts`
  - `docs/post-download.ts`
  - `mcp/mcp-server-e2e.test.ts`
- **Environment**: Node/Bun (scripts, configs, tests)

### Worker

- **Config**: `types/tsconfig-worker.json`
- **Files**:
  - `worker/**/*.ts`
  - `server/**/*.ts`
  - `mcp/**/*.ts`
  - `types/env.d.ts`, `types/env-schema.ts`
  - generated `types/worker-configuration.d.ts` (via `wrangler types`)
- **Environment**: Cloudflare Workers (`WebWorker`, `WebWorker.Iterable`)

## Solution config (project references)

The root `tsconfig.json` is the **solution** file:

- It has no `include`.
- It references the three environment configs above.

The CLI `typecheck` runs:

- `bun run generate-types` (writes `types/worker-configuration.d.ts`)
- `tsc -b --noEmit` (build mode, using the root `tsconfig.json`)

## Common gotchas

- **Missing editor types** usually means the file isn't included by any of the
  three environment configs. Add it to the appropriate `tsconfig.*.json`.
- **Worker types** depend on the generated `types/worker-configuration.d.ts`;
  run `bun run generate-types` if bindings/types drift.
