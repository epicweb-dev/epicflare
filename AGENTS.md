# epicflare

We use bun for installing dependencies and running scripts. Do not use npm.

## Code style

- Read and follow `docs/agents/code-style.md` before writing code.
- Match the surrounding file style (quotes, semicolons, formatting).

## Agent setup

- Install dependencies with `bun install`.
- Apply local D1 migrations with `bun run migrate:local` before DB-backed tests.
- Copy `.env.test` to `.env` before running dev or tests.

## Verification before commit

- Run the Full Gate: `bun run validate`.
- Run dependency guardrail check: `bun run check:mcp-sdk`.
- Run dependency guardrail unit tests: `bun run test:guardrails`.
- Run full dependency guardrail suite: `bun run verify:guardrails`.
- Run formatting: `bun run format`.

## References

- [Setup](./docs/agents/setup.md)
- [Dependency Guardrails](./docs/agents/dependency-guardrails.md)
- [Code Style](./docs/agents/code-style.md)
- [Remix Packages](./docs/agents/remix/index.md)
- [Testing Principles](./docs/agents/testing-principles.md)
- [End-to-End Testing](./docs/agents/end-to-end-testing.md)
