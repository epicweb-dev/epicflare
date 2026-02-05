# Epicflare Template Setup

<!--
If you're an agent reading this, do as much as you can yourself and then
tell the user what else they need to do themselves.
-->

Use these steps to generate a new project from this template and run it on
Cloudflare Workers.

## Create the project with degit

```
bunx degit epicweb-dev/epicflare my-epicflare-app
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

In GitHub Actions, configure these repository secrets for the deploy workflow:

- `CLOUDFLARE_API_TOKEN` (Cloudflare API token with Workers deploy access)
- `COOKIE_SECRET` (generate with `openssl rand -hex 32` or similar)

To get the API token, go to https://dash.cloudflare.com/ and click on "API
Tokens" in the left sidebar. Click on "Create Token" and create a new token with
the Edit Workers template permissions.

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
