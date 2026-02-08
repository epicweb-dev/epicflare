## Mock API servers

Mock servers emulate third-party APIs during local development. They are started
by `bun run dev` in `cli.ts`, and each third party gets its own mock server
file.

### Add a new third-party mock

1. Create a new mock server file under `tools/`, for example
   `tools/mock-acme-server.ts`.
2. Use `createMockApiServer` and define a base path for the service:
   - Example base path: `/mock/acme`
   - Example route: `${basePath}/resource`
3. Export a `createMockAcmeServer` function that returns the mock server and a
   `baseUrl` computed from the base path.
4. In `cli.ts`, start the mock server during `bun run dev` and set
   `ACME_API_BASE_URL` to the `baseUrl`. This keeps API base URLs scoped to a
   path on the mock server.

### Tips

- Use `readMockRequests()` in tests to validate stored requests with Zod.
- Store mock requests in `mock-data/<service>` so they are easy to find.
