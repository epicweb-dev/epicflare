# End-to-end testing principles

These notes summarize how we approach Playwright tests in this codebase, based
on the Epic Web E2E workshop and our existing setup.

## Goals

- Validate user-visible journeys end-to-end through the worker and client.
- Prefer a few high-signal tests over many brittle ones.
- Keep tests readable and close to how a user describes behavior.

## What to test

- Primary routes and flows (navigation, auth, critical forms).
- Integration across the worker, client router, and API endpoints.
- Regressions that are expensive to catch in unit tests.

Avoid testing implementation details, styling, or pure utility functions.

## Structure and style

- Keep tests flat: top-level `test(...)` with no `describe` nesting.
- Inline setup per test; avoid shared `beforeEach` unless required.
- Prefer one clear assertion per step and a small number of final assertions.
- Use Playwright’s `expect` and locator APIs (role/label/placeholder).

## Locators

Prefer stable, user-facing selectors:

- `getByRole` for buttons, links, headings, and inputs.
- `getByLabel` for form fields.
- `getByText` only for brief, stable copy.

Avoid `page.locator('css')` unless no accessible alternative exists.

## Server and routing

- The test server is started via Playwright `webServer` using Wrangler.
- The base URL defaults to `http://localhost:8788` for Playwright to avoid
  colliding with the dev server. Override with `PLAYWRIGHT_BASE_URL` or
  `PLAYWRIGHT_PORT`.
- Playwright sets `CLOUDFLARE_ENV=preview` so Wrangler uses the preview env.
- Ensure `env.preview` includes assets, KV, and durable objects since these are
  not inherited from top-level Wrangler config.
- Client routes live in `client/app.tsx` and `client/client-routes.tsx`.
- API endpoints are defined in `server/routes.ts` and mapped in
  `server/router.ts`.

When adding endpoints that accept bodies, ensure POST/PUT requests are not
handled by the static asset fetcher in `worker/index.ts`.

## Test data

- Use real input values and a happy-path payload.
- Keep credentials and emails obviously fake and local-only.
- Avoid hidden fixtures or global state in the Playwright tests.

## Assertions

- Assert user-facing results (success message, redirect, visible element).
- For async actions, wait on the UI result, not arbitrary timeouts.

## Running tests

Common commands:

- `bunx playwright test`
- `bunx playwright test e2e/login.spec.ts`

These tests are executed by the `validate` gate.
