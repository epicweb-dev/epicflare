import fs from 'node:fs/promises'
import path from 'node:path'

const databaseUrl = process.env.DATABASE_URL ?? 'sqlite:./.tmp/test.sqlite'

if (databaseUrl.startsWith('sqlite:')) {
	const filename = databaseUrl.slice('sqlite:'.length).trim()
	if (!filename || filename === ':memory:' || filename.startsWith('file:')) {
		throw new Error(
			'Cannot reset an in-memory SQLite database URL. Set DATABASE_URL to a file path like `sqlite:./.tmp/test.sqlite`.',
		)
	}
	if (filename.includes('?')) {
		throw new Error(
			'Cannot reset a query-string SQLite URL. Use a plain file path like `sqlite:./.tmp/test.sqlite`.',
		)
	}

	const resolvedFile = path.resolve(process.cwd(), filename)
	await fs.rm(resolvedFile, { force: true })
	console.log(`Reset SQLite database file: ${resolvedFile}`)
	process.exit(0)
}

throw new Error(
	`Reset is only supported for offline sqlite: test DBs. Got: ${databaseUrl}`,
)
