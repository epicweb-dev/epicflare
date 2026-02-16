import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
	throw new Error('Missing DATABASE_URL (required to run migrations).')
}

if (
	!databaseUrl.startsWith('postgres://') &&
	!databaseUrl.startsWith('postgresql://')
) {
	throw new Error(
		`DATABASE_URL must be a Postgres connection string to run migrations. Got: ${databaseUrl}`,
	)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.join(__dirname, '..', 'src', 'db', 'migrations')

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client)

try {
	await migrate(db, { migrationsFolder })
} finally {
	await client.end({ timeout: 5 })
}
