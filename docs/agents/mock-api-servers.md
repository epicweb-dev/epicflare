## Mock API servers

Mock servers emulate third-party APIs during local development. They are started
by `bun run dev` in `cli.ts`, and each third party gets its own mock server
file.

### Add a new third-party mock

1. Create a new mock server file under `tools/`, for example
   `tools/mock-acme-server.ts`.
2. Use `createMockApiServer` and define routes that mirror the third-party API
   (for example, `/resource`).
3. Export a `createMockAcmeServer` function that returns the mock server and a
   `baseUrl` pointing at the server host.
4. In `cli.ts`, start the mock server during `bun run dev` and set
   `ACME_API_BASE_URL` to the `baseUrl`.

### Tips

- Use `readMockRequests()` in tests to validate stored requests with Zod.
- Store mock requests in `mock-data/<service>` so they are easy to find.
