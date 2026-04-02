# Setup

Quick notes for getting a local epicflare environment running.

## Prerequisites

- Bun (used for installs and scripts).
- A recent Node runtime for tooling that Bun delegates to.

## Install

- `bun install`
- `bun install` also runs the `prepare` script, which installs Git hooks via
  Husky.

## Git hooks

- `pre-commit` runs `lint-staged` to format staged files with Prettier, then
  runs `bun run build`, `bun run typecheck`, and `bun run lint`.
- `pre-push` runs `bun run migrate:local`, `bun run test`, `bun run test:e2e`,
  and `bun run test:mcp`.
- Use `HUSKY=0` to skip hooks for one command when you intentionally need to
  bypass them.

## Local development

- Copy `.env.example` to `.env` before starting any work, then update secrets as
  needed.
- `bun ./docs/post-download.ts` sanitizes copied Cloudflare D1/KV IDs in
  `wrangler.jsonc`, so new projects do not inherit another project's remote
  resources.
- `bun run dev` (starts mock API servers automatically and sets
  `RESEND_API_BASE_URL`, `AI_MODE=mock`, and `AI_MOCK_BASE_URL` to local mock
  Workers).
- Add new mock API servers by following `docs/agents/mock-api-servers.md`.
- To opt into live remote inference locally, set `AI_MODE=remote` before
  starting `bun run dev`.
- When `AI_MODE=remote`, set `AI_GATEWAY_ID`, `CLOUDFLARE_ACCOUNT_ID`, and
  `CLOUDFLARE_API_TOKEN` in `.env`; remote AI mode now requires requests to flow
  through a configured Cloudflare AI Gateway using your Cloudflare account
  credentials. If any are missing, `bun run dev` fails fast with an explanatory
  startup error.
- Local remote inference does not require `wrangler dev --remote`; the normal
  dev server keeps local Durable Objects/D1 while routing Workers AI calls
  through Cloudflare using the configured account credentials.
- If you only need the client bundle or worker, use:
  - `bun run dev:client`
  - `bun run dev:worker`
- Set `CLOUDFLARE_ENV` to switch Wrangler environments (defaults to
  `production`). Playwright sets this to `test`.

## Checks

- `bun run validate` runs format check, lint fix, build, typecheck, Playwright
  tests, and MCP E2E tests.
- `bun run hooks:pre-commit` runs the same checks as the commit hook.
- `bun run hooks:pre-push` runs the same checks as the push hook.
- `bun run format` applies formatting updates.
- `bun run test` runs the Bun test suites for server, worker, client, shared,
  mock-server, MCP, and tools code.
- `bun run test:e2e:install` to install Playwright browsers.
- `bun run test:e2e` to run Playwright specs.
- `bun run test:mcp` to run MCP server E2E tests.

## Documentation maintenance

- Update `docs/agents` when behavior, workflows, architecture notes, or
  verification guidance change.
- Treat docs updates as part of done work.
- Keep `AGENTS.md` concise and index-like; put details in focused docs.
- When failures repeat, promote lessons from docs into tests, lint rules, or
  scripts.

## Seed test account

Use this script to ensure a known test login exists in any deployed environment:

- Local D1 (default):
  - `bun run migrate:local`
  - `bun tools/seed-test-data.ts --local`
- Local D1 with custom persisted state:
  - `bun tools/seed-test-data.ts --local --persist-to .wrangler/state/e2e`
- Remote D1:
  - `bun tools/seed-test-data.ts --remote --config <wrangler-config-path>`
  - Add `--env <name>` when the config uses environment-scoped bindings and the
    environment is not already set via `CLOUDFLARE_ENV`.
- Default credentials:
  - email: `kody@kcd.dev`
  - password: `kodylovesyou`
- Override credentials when needed:
  - `bun tools/seed-test-data.ts --email <email> --password <password>`
- When changing DB schema/model definitions or migrations, review
  `tools/seed-test-data.ts` and update it so seeded data still matches the new
  model and remains useful for local and preview verification.

### Reset, re-migrate, then seed

For a full local reset before seeding:

1. Drop app tables:
   - `bun ./wrangler-env.ts d1 execute APP_DB --local --command "PRAGMA foreign_keys=OFF; DROP TABLE IF EXISTS chat_threads; DROP TABLE IF EXISTS password_resets; DROP TABLE IF EXISTS users; PRAGMA foreign_keys=ON;"`
2. Re-apply migrations:
   - `bun run migrate:local`
3. Seed test account:
   - `bun tools/seed-test-data.ts`

For preview environments, we do a full resource reset:

1. Delete preview resources:
   - `bun tools/ci/preview-resources.ts cleanup --worker-name <preview-worker-name>`
2. Recreate preview resources and config:
   - `bun tools/ci/preview-resources.ts ensure --worker-name <preview-worker-name> --out-config wrangler-preview.generated.json`
3. Re-apply remote migrations:
   - `CLOUDFLARE_ENV=preview bun ./wrangler-env.ts d1 migrations apply APP_DB --remote --config wrangler-preview.generated.json`
4. Seed test account:
   - `CLOUDFLARE_ENV=preview bun tools/seed-test-data.ts --remote --config wrangler-preview.generated.json`

Mock Workers use separate D1 databases (not the app `APP_DB`). In production,
create the databases named in each mock `wrangler.jsonc` (for example
`epicflare-mock-resend` and `epicflare-mock-ai`) with
`wrangler d1 create <name>` before deploying those Workers. After changing mock
SQL under `mock-servers/<service>/migrations/`, apply it locally with
`bun ./wrangler-env.ts d1 migrations apply APP_DB --local --config mock-servers/<service>/wrangler.jsonc`
(the `dev:mock-*` scripts run this before `wrangler dev`).

## PR preview deployments

The GitHub Actions preview workflow creates per-preview Cloudflare resources so
each PR preview is isolated:

- D1 database: `<preview-worker-name>-db`
- KV namespace (OAuth state): `<preview-worker-name>-oauth-kv`
- Mock D1 databases: `<preview-worker-name>-mock-<service>-db` (one per
  directory under `mock-servers/` that has a `wrangler.jsonc`)

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

For projects started from this template, the checked-in `wrangler.jsonc` does
not keep real remote D1/KV IDs. The post-download setup strips any copied IDs,
and the production/preview deploy workflows create or resolve the correct
resources and inject those IDs into generated Wrangler config files at deploy
time. The production output file `wrangler-production.generated.json` is
gitignored; CI writes it during deploy. For a local copy (for example
`wrangler deploy --config wrangler-production.generated.json`), run
`bun tools/ci/production-resources.ts ensure --out-config wrangler-production.generated.json`.

Both the preview and production deploy workflows run a post-deploy healthcheck
against `<deploy-url>/health` and fail the job if it does not return
`{ ok: true, commitSha }` with `commitSha` matching the commit SHA deployed by
that workflow.

Preview deploys also run `bun tools/seed-test-data.ts` after deploy to create or
verify the shared test account credentials listed above.

If you ever need to do the same operations manually, use:

- `bun tools/ci/preview-resources.ts ensure --worker-name <name> --out-config <path>`
- `bun tools/ci/preview-resources.ts cleanup --worker-name <name>`
- `bun tools/ci/production-resources.ts ensure --out-config <path>`

## Remix package docs

Use the Remix package index for quick navigation:

- `docs/agents/remix/index.md`
