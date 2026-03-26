import {
	getTablePrimaryKey,
	type AdapterCapabilityOverrides,
	type DataManipulationOperation,
	type DataManipulationRequest,
	type DataManipulationResult,
	type DataMigrationOperation,
	type DataMigrationRequest,
	type DataMigrationResult,
	type DatabaseAdapter,
	type SqlStatement,
	type TableRef,
	type TransactionOptions,
	type TransactionToken,
} from 'remix/data-table'
import { isDataManipulationOperation } from 'remix/data-table/sql-helpers'
import {
	compileSqliteMigrationOperations,
	compileSqliteOperation,
} from '#worker/d1-sqlite-compiler.ts'

type D1Meta = {
	changes?: number
	last_row_id?: number
}

type D1StatementResult = {
	results?: Array<Record<string, unknown>>
	meta?: D1Meta
}

type D1PreparedQuery = {
	all<T = Record<string, unknown>>(): Promise<{
		results?: Array<T>
		meta?: D1Meta
	}>
	run<T = Record<string, unknown>>(): Promise<{
		results?: Array<T>
		meta?: D1Meta
	}>
}

/**
 * `DatabaseAdapter` implementation for Cloudflare D1.
 *
 * This adapter intentionally mirrors SQLite SQL generation because D1 uses
 * SQLite semantics.
 */
export class D1DataTableAdapter implements DatabaseAdapter {
	dialect = 'sqlite'
	capabilities: {
		returning: boolean
		savepoints: boolean
		upsert: boolean
		transactionalDdl: boolean
		migrationLock: boolean
	}

	#database: D1Database
	#transactions = new Set<string>()
	#transactionCounter = 0

	constructor(
		database: D1Database,
		options?: {
			capabilities?: AdapterCapabilityOverrides
		},
	) {
		this.#database = database
		this.capabilities = {
			returning: options?.capabilities?.returning ?? true,
			savepoints: options?.capabilities?.savepoints ?? false,
			upsert: options?.capabilities?.upsert ?? true,
			transactionalDdl: options?.capabilities?.transactionalDdl ?? true,
			migrationLock: options?.capabilities?.migrationLock ?? false,
		}
	}

	compileSql(
		operation: DataManipulationOperation | DataMigrationOperation,
	): Array<SqlStatement> {
		if (isDataManipulationOperation(operation)) {
			const compiled = compileSqliteOperation(operation)
			return [{ text: compiled.text, values: compiled.values }]
		}
		return compileSqliteMigrationOperations(operation)
	}

	async execute(
		request: DataManipulationRequest,
	): Promise<DataManipulationResult> {
		if (
			request.operation.kind === 'insertMany' &&
			request.operation.values.length === 0
		) {
			return {
				affectedRows: 0,
				insertId: undefined,
				rows: request.operation.returning ? [] : undefined,
			}
		}

		const statement = this.compileSql(request.operation)[0]
		if (!statement) {
			throw new Error('Expected SQL statement for D1 execution')
		}
		const prepared = this.#database
			.prepare(statement.text)
			.bind(...statement.values) as unknown as D1PreparedQuery

		const shouldReadRows =
			request.operation.kind === 'select' ||
			request.operation.kind === 'count' ||
			request.operation.kind === 'exists' ||
			hasReturningClause(request.operation)

		if (shouldReadRows) {
			const result = (await prepared.all()) as D1StatementResult
			let rows = normalizeRows(result.results ?? [])
			if (
				request.operation.kind === 'count' ||
				request.operation.kind === 'exists'
			) {
				rows = normalizeCountRows(rows)
			}
			return {
				rows,
				affectedRows: normalizeAffectedRowsForReader(
					request.operation.kind,
					rows,
				),
				insertId: normalizeInsertIdForReader(
					request.operation.kind,
					request.operation,
					rows,
				),
			}
		}

		const result = (await prepared.run()) as D1StatementResult
		return {
			affectedRows: normalizeAffectedRowsForRun(request.operation.kind, result),
			insertId: normalizeInsertIdForRun(
				request.operation.kind,
				request.operation,
				result,
			),
		}
	}

	async migrate(request: DataMigrationRequest): Promise<DataMigrationResult> {
		const statements = this.compileSql(request.operation)
		for (const statement of statements) {
			await this.#database.prepare(statement.text).bind(...statement.values).run()
		}
		return {
			affectedOperations: statements.length,
		}
	}

	async hasTable(
		table: TableRef,
		transaction?: TransactionToken,
	): Promise<boolean> {
		if (transaction) {
			this.#assertTransaction(transaction)
		}
		const masterTable = table.schema
			? quoteIdentifier(table.schema) + '.sqlite_master'
			: 'sqlite_master'
		const result = (await this.#database
			.prepare(
				'select 1 from ' + masterTable + ' where type = ? and name = ? limit 1',
			)
			.bind('table', table.name)
			.all()) as D1StatementResult
		return (result.results?.length ?? 0) > 0
	}

	async hasColumn(
		table: TableRef,
		column: string,
		transaction?: TransactionToken,
	): Promise<boolean> {
		if (transaction) {
			this.#assertTransaction(transaction)
		}
		const schemaPrefix = table.schema ? quoteIdentifier(table.schema) + '.' : ''
		const result = (await this.#database
			.prepare(
				'pragma ' + schemaPrefix + 'table_info(' + quoteIdentifier(table.name) + ')',
			)
			.all()) as D1StatementResult
		return (result.results ?? []).some((row) => row.name === column)
	}

	async beginTransaction(
		options?: TransactionOptions,
	): Promise<TransactionToken> {
		if (options?.isolationLevel === 'read uncommitted') {
			await this.#database.exec('PRAGMA read_uncommitted = true')
		}

		await this.#database.exec('BEGIN')
		this.#transactionCounter += 1
		const token = { id: 'tx_' + String(this.#transactionCounter) }
		this.#transactions.add(token.id)
		return token
	}

	async commitTransaction(token: TransactionToken): Promise<void> {
		this.#assertTransaction(token)
		await this.#database.exec('COMMIT')
		this.#transactions.delete(token.id)
	}

	async rollbackTransaction(token: TransactionToken): Promise<void> {
		this.#assertTransaction(token)
		await this.#database.exec('ROLLBACK')
		this.#transactions.delete(token.id)
	}

	async createSavepoint(
		_token: TransactionToken,
		_name: string,
	): Promise<void> {
		throw new Error('D1DataTableAdapter savepoints are not supported')
	}

	async rollbackToSavepoint(
		_token: TransactionToken,
		_name: string,
	): Promise<void> {
		throw new Error('D1DataTableAdapter savepoints are not supported')
	}

	async releaseSavepoint(
		_token: TransactionToken,
		_name: string,
	): Promise<void> {
		throw new Error('D1DataTableAdapter savepoints are not supported')
	}

	#assertTransaction(token: TransactionToken) {
		if (!this.#transactions.has(token.id)) {
			throw new Error('Unknown transaction token: ' + token.id)
		}
	}
}

export function createD1DataTableAdapter(
	database: D1Database,
	options?: {
		capabilities?: AdapterCapabilityOverrides
	},
) {
	return new D1DataTableAdapter(database, options)
}

function hasReturningClause(statement: DataManipulationRequest['operation']) {
	return (
		(statement.kind === 'insert' ||
			statement.kind === 'insertMany' ||
			statement.kind === 'update' ||
			statement.kind === 'delete' ||
			statement.kind === 'upsert') &&
		Boolean(statement.returning)
	)
}

function normalizeRows(rows: Array<Record<string, unknown>>) {
	return rows.map((row) => {
		if (typeof row !== 'object' || row === null) {
			return {}
		}
		return { ...row }
	})
}

function normalizeCountRows(rows: Array<Record<string, unknown>>) {
	return rows.map((row) => {
		const count = row.count
		if (typeof count === 'string') {
			const numeric = Number(count)
			if (!Number.isNaN(numeric)) {
				return {
					...row,
					count: numeric,
				}
			}
		}
		if (typeof count === 'bigint') {
			return {
				...row,
				count: Number(count),
			}
		}
		return row
	})
}

function normalizeAffectedRowsForReader(
	kind: DataManipulationRequest['operation']['kind'],
	rows: Array<Record<string, unknown>>,
) {
	if (isWriteStatementKind(kind)) {
		return rows.length
	}
	return undefined
}

function normalizeInsertIdForReader(
	kind: DataManipulationRequest['operation']['kind'],
	statement: DataManipulationRequest['operation'],
	rows: Array<Record<string, unknown>>,
) {
	if (!isInsertStatementKind(kind) || !isInsertStatement(statement)) {
		return undefined
	}
	const primaryKey = getTablePrimaryKey(statement.table)
	if (primaryKey.length !== 1) {
		return undefined
	}
	const key = primaryKey[0]
	if (!key) {
		return undefined
	}
	const row = rows[rows.length - 1]
	return row?.[key]
}

function normalizeAffectedRowsForRun(
	kind: DataManipulationRequest['operation']['kind'],
	result: D1StatementResult,
) {
	if (kind === 'select' || kind === 'count' || kind === 'exists') {
		return undefined
	}
	return result.meta?.changes
}

function normalizeInsertIdForRun(
	kind: DataManipulationRequest['operation']['kind'],
	statement: DataManipulationRequest['operation'],
	result: D1StatementResult,
) {
	if (!isInsertStatementKind(kind) || !isInsertStatement(statement)) {
		return undefined
	}
	if (getTablePrimaryKey(statement.table).length !== 1) {
		return undefined
	}
	return result.meta?.last_row_id
}

function isWriteStatementKind(kind: DataManipulationRequest['operation']['kind']) {
	return (
		kind === 'insert' ||
		kind === 'insertMany' ||
		kind === 'update' ||
		kind === 'delete' ||
		kind === 'upsert'
	)
}

function isInsertStatementKind(kind: DataManipulationRequest['operation']['kind']) {
	return kind === 'insert' || kind === 'insertMany' || kind === 'upsert'
}

function isInsertStatement(
	statement: DataManipulationRequest['operation'],
): statement is Extract<
	DataManipulationRequest['operation'],
	{ kind: 'insert' | 'insertMany' | 'upsert' }
> {
	return (
		statement.kind === 'insert' ||
		statement.kind === 'insertMany' ||
		statement.kind === 'upsert'
	)
}

function quoteIdentifier(value: string) {
	return '"' + value.replace(/"/g, '""') + '"'
}
