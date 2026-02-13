# Data storage

This project uses three Cloudflare storage systems for different purposes.

## D1 (`APP_DB`)

Relational app data lives in D1.

Current schema is defined by migrations in `migrations/`:

- `users`: login identity and password hash
- `password_resets`: hashed reset tokens with expiry and foreign key to users

App access pattern:

- SQL helpers in `worker/db.ts` provide typed wrappers (`queryFirst`,
  `queryAll`, `exec`)
- app handlers (for example `server/handlers/auth.ts`) use these helpers for
  database calls

## KV (`OAUTH_KV`)

OAuth provider state is stored in KV through the
`@cloudflare/workers-oauth-provider` integration.

- Binding is configured in `wrangler.jsonc`
- This supports OAuth client and token flows without custom storage code in the
  app handlers

## Durable Objects (`MCP_OBJECT`)

MCP server runtime state is hosted via a Durable Object class (`MCP`) in
`mcp/index.ts`, exposed through the `/mcp` route.

- The Worker forwards authorized MCP requests to `MCP.serve(...).fetch`
- Durable Objects provide a stateful execution model for MCP operations

## Configuration reference

Bindings are configured per environment in `wrangler.jsonc`:

- `APP_DB` (D1)
- `OAUTH_KV` (KV)
- `MCP_OBJECT` (Durable Objects)
- `ASSETS` (static assets bucket)
