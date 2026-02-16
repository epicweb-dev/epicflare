import { type AppEnv } from './env-schema.ts'

declare global {
	interface Env extends AppEnv {}

	interface CustomExportedHandler<Props = {}> {
		fetch: (
			request: Request,
			env: Env,
			ctx: ExecutionContext<Props>,
		) => Response | Promise<Response>
	}
}

// Worker builds include `src/db/client.ts`, which contains Bun-only code paths
// guarded behind `DATABASE_URL` schemes. Provide minimal module declarations so
// worker typechecking does not require Bun's ambient types.
declare module 'bun:sqlite' {
	// Minimal surface used by `src/db/client.ts` and `drizzle-orm/bun-sqlite`.
	export class Database {
		constructor(filename?: string)
	}
}

export {}
