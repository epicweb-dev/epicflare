# epicflare Template Setup

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

## Expectations and assumptions

The setup flow assumes:

- Bun is installed (uses `bun`/`bunx`).
- You run commands from the repo root (needs `wrangler.jsonc` and
  `package.json`).
- You can write to files in the repository (the script updates config files and
  replaces template `epicflare` tokens across text files).
- Wrangler is optional for post-download setup. It is only needed when you
  choose to create Cloudflare resources directly from the script.

See `docs/setup-manifest.md` for required resources and secrets.

For optional Cloudflare offerings (R2, Workers AI, AI Gateway, extra KV), see
`docs/cloudflare-offerings.md`.

## Preflight checks

Run a quick validation of your environment and Wrangler login status:

```
bun ./docs/post-download.ts --check
```

## Quick Start (local only)

1. Run the guided setup script:

```
bun ./docs/post-download.ts --guided
```

2. Start local development:

```
bun run dev
```

## Full Cloudflare setup (deploy)

1. Run the guided setup script:

```
bun ./docs/post-download.ts --guided
```

This setup step does not create Cloudflare resources or rewrite `wrangler.jsonc`
resource IDs. The production deploy workflow creates missing D1/KV resources
automatically on first CI deploy. Cloudflare deploys do not auto-create those
resources from bindings alone, so the workflow runs an explicit ensure step
before migrations/deploy.

2. Configure GitHub Actions secrets for deploy:

- `CLOUDFLARE_API_TOKEN` (Workers deploy + D1 edit access on the correct
  account)
- `COOKIE_SECRET` (generate with `openssl rand -hex 32` or similar)
- See `docs/setup-manifest.md` (`GitHub Actions secrets`) for full optional
  secrets and where to get each value.

3. Deploy:

```
bun run deploy
```

## Agent/CI setup

Use non-interactive flags or `--defaults`. The `--defaults` flag skips prompts
and uses defaults based on the current directory name (app/package naming), plus
a generated cookie secret.

```
bun ./docs/post-download.ts --defaults
```

To preview changes without writing, add `--dry-run`. To emit a JSON summary, add
`--json`. To run preflight checks only, add `--check`.

### Script flags

- `--guided`: interactive, state-aware flow (optional git init/first commit
  prompt).
- `--check`: run preflight checks only.
- `--defaults`: accept defaults without prompts.
- `--dry-run`: show changes without writing or deleting the script.
- `--json`: print a JSON summary.
- `--app-name`, `--package-name`, `--cookie-secret`

Cloudflare resources are managed during deploy. The setup script does not create
Cloudflare resources or rewrite `wrangler.jsonc` resource IDs.

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
