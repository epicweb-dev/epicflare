# Epicflare Template Setup

Use these steps to generate a new project from this template and run it on
Cloudflare Workers.

## Create the project with degit

```
npx degit epicweb-dev/epicflare my-epicflare-app
cd my-epicflare-app
```

## Install dependencies

We use bun for scripts and installs.

```
bun install
```

## Cloudflare prerequisites

1. Install Wrangler if you do not have it already:

```
bunx wrangler --version
```

2. Authenticate with Cloudflare:

```
bunx wrangler login
```

## Environment variables

Local development uses `.env` which Wrangler loads automatically.

1. Create a local env file:

```
cp .env.example .env
```

2. Update the value in `.env`:

```
COOKIE_SECRET=your-local-secret
```

For production, set the same secret in Cloudflare:

```
bunx wrangler secret put COOKIE_SECRET
```

If you deploy with GitHub Actions, configure these repository secrets:

- `CLOUDFLARE_API_TOKEN` (Cloudflare API token with Workers deploy access)
- `COOKIE_SECRET` (same value used for the worker secret)

## Local development

See `docs/agents/setup.md` for local dev commands and verification steps.

## Build and deploy

Build the project:

```
bun run build
```

Deploy to Cloudflare:

```
bun run deploy
```
