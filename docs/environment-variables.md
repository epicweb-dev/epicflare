# Environment variables

Use this guide when you add a new environment variable to the starter. It keeps
types, runtime validation, and documentation in sync.

## Steps

1. **Add the type**
   - Update `types/env.d.ts` so `Env` includes the new variable.

2. **Validate at runtime**
   - Add the variable to the Zod schema in `types/env-schema.ts`.
   - `server/env.ts` uses the schema to fail fast at runtime.
   - The schema is the single source of truth for validation + types.

   Example:

   ```ts
   const EnvSchema = z.object({
   	COOKIE_SECRET: z
   		.string()
   		.min(
   			32,
   			'COOKIE_SECRET must be at least 32 characters for session signing.',
   		),
   	THIRD_PARTY_API_KEY: z
   		.string()
   		.min(
   			1,
   			'Missing THIRD_PARTY_API_KEY. Go to https://example.com/ to get one.',
   		),
   })
   ```

3. **Add local defaults**
   - Update `.env.example` (source for new local `.env` files).

4. **Declare required Worker secrets**
   - If the variable is a Worker secret that must exist for a given Wrangler
     environment, add it to `wrangler.jsonc` under
     `env.<environment>.secrets.required`.
   - Wrangler now uses that list as the source of truth for local secret loading,
     deploy validation, and `bun run generate-types`.
   - Only declare secrets that are truly required for that environment. Leave
     runtime-conditional values out of `secrets.required` unless you want Wrangler
     to validate them on every `dev`/`deploy` for that environment.

5. **Update required resources docs**
   - Add the variable to `docs/setup-manifest.md`.

6. **Sync deploy secrets**
   - Add the variable to the relevant GitHub Actions workflows so it is pushed
     via `tools/ci/sync-worker-secrets.ts`:
     - `.github/workflows/deploy.yml` (production deploys)
     - `.github/workflows/preview.yml` (preview deploys)

## Why Zod?

Zod gives type inference for `Env`-driven values and a single runtime gate that
fails fast with clear errors. It keeps the “what’s required” definition in one
place for application code, while `wrangler.jsonc` is the source of truth for
required Worker secrets.
