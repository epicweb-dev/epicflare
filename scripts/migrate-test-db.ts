import { z } from 'zod'
import { createDb, sql } from '../src/db/client'

const databaseUrl =
	process.env.DATABASE_URL ?? 'pglite:./.tmp/pglite-test'

const db = createDb({
	DATABASE_URL: databaseUrl,
	DATABASE_WS_PROXY: process.env.DATABASE_WS_PROXY,
})

await db.queryFirst(
	sql`select 1 as ok`,
	z.object({
		ok: z.coerce.number(),
	}),
)

console.log(`Ensured schema for DATABASE_URL=${databaseUrl}`)
