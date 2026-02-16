import { type z } from 'zod'
import { sql } from 'drizzle-orm'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle as drizzleNeonHttp } from 'drizzle-orm/neon-http'

export { sql }

export type DatabaseEnv = {
	DATABASE_URL: string
	/**
	 * Optional WebSocket proxy for connecting to non-Neon Postgres from Workers.
	 * When set, the DB client uses `drizzle-orm/neon-serverless` instead of
	 * `drizzle-orm/neon-http`.
	 *
	 * Example value: `localhost:6543/v1`
	 * (protocol intentionally omitted; this code uses insecure `ws://` for local dev)
	 */
	DATABASE_WS_PROXY?: string
}

type ZodSchema<T> = z.ZodType<T>
type QueryResultRow = Record<string, unknown>

type InternalClient = {
	dialect: 'postgres' | 'sqlite' | 'pglite'
	all: (query: unknown) => Promise<Array<QueryResultRow>>
	run: (query: unknown) => Promise<void>
	ensureSchema?: () => Promise<void>
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object'
}

function extractRows(result: unknown): Array<QueryResultRow> {
	if (!result) return []
	if (Array.isArray(result)) {
		return result.filter(isObject) as Array<QueryResultRow>
	}
	if (isObject(result) && Array.isArray(result.rows)) {
		return result.rows.filter(isObject) as Array<QueryResultRow>
	}
	return []
}

function createCacheKey(env: DatabaseEnv) {
	return [
		env.DATABASE_URL,
		env.DATABASE_WS_PROXY ? `wsproxy=${env.DATABASE_WS_PROXY}` : 'wsproxy=',
	].join('|')
}

const internalClientCache = new Map<string, Promise<InternalClient>>()

async function createInternalClient(env: DatabaseEnv): Promise<InternalClient> {
	const databaseUrl = env.DATABASE_URL

	if (databaseUrl.startsWith('sqlite:')) {
		const filename = databaseUrl.slice('sqlite:'.length) || ':memory:'

		if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
			// Bun-only unit test / local script path.
			// Keep module specifiers non-literal so Wrangler/esbuild does not try to
			// resolve/bundle Bun built-ins for Workers builds.
			const bunSqliteModule = 'bun:' + 'sqlite'
			const drizzleBunModule = 'drizzle-orm/' + 'bun-sqlite'
			const bunSqlite = (await import(bunSqliteModule)) as any
			const drizzleBun = (await import(drizzleBunModule)) as any
			const Database = bunSqlite.Database as new (filename: string) => unknown
			const drizzle = drizzleBun.drizzle as (client: unknown) => any

			const sqlite = new Database(filename)
			const db = drizzle(sqlite)
			const all = async (query: unknown) =>
				db.all(query as never) as Array<QueryResultRow>
			const run = async (query: unknown) => {
				db.run(query as never)
			}
			let schemaPromise: Promise<void> | null = null

			async function ensureSchema() {
				if (!schemaPromise) {
					schemaPromise = (async () => {
						await run(sql`
							CREATE TABLE IF NOT EXISTS users (
								id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
								username TEXT NOT NULL UNIQUE,
								email TEXT NOT NULL UNIQUE,
								password_hash TEXT NOT NULL,
								created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
								updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
							);
						`)
						await run(
							sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
						)
						await run(
							sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
						)

						await run(sql`
							CREATE TABLE IF NOT EXISTS password_resets (
								id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
								user_id INTEGER NOT NULL,
								token_hash TEXT NOT NULL UNIQUE,
								expires_at INTEGER NOT NULL,
								created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
								FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
							);
						`)
						await run(
							sql`CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);`,
						)
						await run(
							sql`CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);`,
						)
					})()
				}
				return schemaPromise
			}

			return {
				dialect: 'sqlite',
				all,
				run,
				ensureSchema,
			}
		}

		// Workers/Node fallback: use SQL.js (SQLite in JS) so E2E tests can run
		// fully offline under `wrangler dev --local`.
		if (filename.trim() && filename.trim() !== ':memory:') {
			throw new Error(
				'File-backed sqlite: URLs are only supported under Bun. Use `sqlite:` (in-memory) for Workers.',
			)
		}

		const { drizzle } = await import('drizzle-orm/sql-js')
		const initSqlJs = (await import('sql.js/dist/sql-asm.js'))
			.default as unknown as (config?: unknown) => Promise<any>

		const SQL = await initSqlJs({})
		const sqlite = new SQL.Database()
		const db = drizzle(sqlite)
		const all = async (query: unknown) =>
			db.all(query as never) as Array<QueryResultRow>
		const run = async (query: unknown) => {
			db.run(query as never)
		}
		let schemaPromise: Promise<void> | null = null

		async function ensureSchema() {
			if (!schemaPromise) {
				schemaPromise = (async () => {
					await run(sql`
						CREATE TABLE IF NOT EXISTS users (
							id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
							username TEXT NOT NULL UNIQUE,
							email TEXT NOT NULL UNIQUE,
							password_hash TEXT NOT NULL,
							created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
							updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
						);
					`)
					await run(
						sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
					)
					await run(
						sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
					)

					await run(sql`
						CREATE TABLE IF NOT EXISTS password_resets (
							id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
							user_id INTEGER NOT NULL,
							token_hash TEXT NOT NULL UNIQUE,
							expires_at INTEGER NOT NULL,
							created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
							FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
						);
					`)
					await run(
						sql`CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);`,
					)
					await run(
						sql`CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);`,
					)
				})()
			}
			return schemaPromise
		}

		return {
			dialect: 'sqlite',
			all,
			run,
			ensureSchema,
		}
	}

	if (databaseUrl.startsWith('pglite:')) {
		const { drizzle } = await import('drizzle-orm/pglite')
		const { PGlite } = await import('@electric-sql/pglite')

		const dataDir = databaseUrl.slice('pglite:'.length).trim()
		const client = dataDir ? new PGlite({ dataDir }) : new PGlite()
		const db = drizzle(client)
		const execute = (query: unknown) => db.execute(query as never)
		const all = async (query: unknown) => extractRows(await execute(query))
		const run = async (query: unknown) => {
			await execute(query)
		}
		let schemaPromise: Promise<void> | null = null

		async function ensureSchema() {
			if (!schemaPromise) {
				schemaPromise = (async () => {
					// Postgres-compatible bootstrap for local/offline runs.
					await run(sql`
						CREATE TABLE IF NOT EXISTS users (
							id serial PRIMARY KEY NOT NULL,
							username text NOT NULL UNIQUE,
							email text NOT NULL UNIQUE,
							password_hash text NOT NULL,
							created_at timestamp with time zone DEFAULT now() NOT NULL,
							updated_at timestamp with time zone DEFAULT now() NOT NULL
						);
					`)
					await run(
						sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users USING btree (username);`,
					)
					await run(
						sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users USING btree (email);`,
					)

					await run(sql`
						CREATE TABLE IF NOT EXISTS password_resets (
							id serial PRIMARY KEY NOT NULL,
							user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
							token_hash text NOT NULL UNIQUE,
							expires_at bigint NOT NULL,
							created_at timestamp with time zone DEFAULT now() NOT NULL
						);
					`)
					await run(
						sql`CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets USING btree (user_id);`,
					)
					await run(
						sql`CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets USING btree (token_hash);`,
					)
				})()
			}
			return schemaPromise
		}

		return {
			dialect: 'pglite',
			all,
			run,
			ensureSchema,
		}
	}

	// Default: Postgres via Neon.
	// - In production/preview: `neon-http` over fetch is the simplest/fastest.
	// - For local/offline Postgres: set DATABASE_WS_PROXY and use `neon-serverless`.
	if (env.DATABASE_WS_PROXY) {
		const { drizzle } = await import('drizzle-orm/neon-serverless')
		const { Pool } = await import('@neondatabase/serverless')

		neonConfig.wsProxy = env.DATABASE_WS_PROXY
		// Local wsproxy runs without TLS by default.
		neonConfig.useSecureWebSocket = false
		// `neon-serverless` needs a WebSocket implementation (Workers provide this).
		// Avoid relying on DOM lib types for tooling TS configs.
		neonConfig.webSocketConstructor = (
			globalThis as unknown as { WebSocket?: unknown }
		).WebSocket as any

		async function executeOnce(query: unknown) {
			// Cloudflare Workers cannot keep outbound WebSockets alive across
			// requests. Create/close a pool per operation when using wsproxy.
			const pool = new Pool({ connectionString: databaseUrl })
			const db = drizzle(pool)
			try {
				return await db.execute(query as never)
			} finally {
				await pool.end()
			}
		}

		const all = async (query: unknown) => extractRows(await executeOnce(query))
		const run = async (query: unknown) => {
			await executeOnce(query)
		}

		return {
			dialect: 'postgres',
			all,
			run,
		}
	}

	const query = neon(databaseUrl)
	const db = drizzleNeonHttp(query)
	const execute = (queryToRun: unknown) => db.execute(queryToRun as never)
	return {
		dialect: 'postgres',
		all: async (queryToRun: unknown) => extractRows(await execute(queryToRun)),
		run: async (queryToRun: unknown) => {
			await execute(queryToRun)
		},
	}
}

export function createDb(env: DatabaseEnv) {
	const cacheKey = createCacheKey(env)

	async function getClient() {
		const cached = internalClientCache.get(cacheKey)
		if (cached) return cached

		const created = createInternalClient(env).catch((error) => {
			internalClientCache.delete(cacheKey)
			throw error
		})
		internalClientCache.set(cacheKey, created)
		return created
	}

	return {
		async queryFirst<T>(
			query: unknown,
			schema: ZodSchema<T>,
		): Promise<T | null> {
			const client = await getClient()
			await client.ensureSchema?.()
			const rows = await client.all(query)
			if (rows.length === 0) return null
			return schema.parse(rows[0])
		},
		async queryAll<T>(query: unknown, schema: ZodSchema<T>): Promise<Array<T>> {
			const client = await getClient()
			await client.ensureSchema?.()
			const rows = await client.all(query)
			return schema.array().parse(rows)
		},
		async exec(query: unknown) {
			const client = await getClient()
			await client.ensureSchema?.()
			await client.run(query)
		},
	}
}
