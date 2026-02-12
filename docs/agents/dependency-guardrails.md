# Dependency guardrails

This project uses MCP packages that can fail TypeScript checks when multiple
physical installs of `@modelcontextprotocol/sdk` are present in `node_modules`.

To prevent regressions, we enforce a guardrail in both local workflows and CI.

## What is enforced

`bun run check:mcp-sdk` verifies:

1. The expected SDK version in `package.json` is pinned to an exact version.
2. The dependency tree reports exactly one installed SDK version.
3. Sensitive dependencies (`agents`, `@mcp-ui/server`) do not contain nested SDK
   installs.
4. The top-level installed SDK package version matches the expected pinned
   version.

## Where it runs

- Local: `bun run typecheck` runs `check:mcp-sdk` before `tsc`.
- CI: the `dependency-guardrails` job in `.github/workflows/deploy.yml`.

## Commands

Run the guardrail directly:

```bash
bun run check:mcp-sdk
```

Run unit tests for guardrail helpers:

```bash
bun run test:guardrails
```

Run the full local gate:

```bash
bun run validate
```

## If the guardrail fails

1. Ensure `package.json` contains an exact pinned SDK override:

   ```json
   {
   	"overrides": {
   		"@modelcontextprotocol/sdk": "1.26.0"
   	}
   }
   ```

2. Reinstall with the lockfile:

   ```bash
   bun install --frozen-lockfile
   ```

3. Re-run:

   ```bash
   bun run check:mcp-sdk
   ```
