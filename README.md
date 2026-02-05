# Epicflare

Epicflare is a starter and reference project for building full stack web
applications on Cloudflare Workers. It ships a Remix-powered UI, server routing,
and OAuth-protected MCP endpoints so you can build both a user-facing app and
tooling APIs on the same Worker.

## Quick start

```
bunx degit epicweb-dev/epicflare my-epicflare-app
cd my-epicflare-app
bun install
bun ./docs/post-download.ts --guided
bun run dev
```

See `docs/getting-started.md` for the full setup paths and expectations.

## Tech stack and infrastructure

- Cloudflare Workers with Wrangler for local dev, builds, and deploys.
- Remix 3 components for the client UI and server rendering.
- Bun for installs and scripts; esbuild for client bundling.
- D1 for application data, KV for OAuth/session storage, and Durable Objects for
  MCP state.
- MCP server endpoints with OAuth and CORS support.
- Playwright for end-to-end testing.

## How it works

- `worker/index.ts` is the entrypoint for Cloudflare Workers.
- OAuth requests are handled first, then MCP requests, then static assets.
- Non-asset requests fall through to the server handler and router.
- Client assets are bundled into `public/` and served via the `ASSETS` binding.

## Docs

- `docs/getting-started.md` for degit setup, environment variables, and
  deployment.
- `docs/agents/setup.md` for local development and verification commands.
