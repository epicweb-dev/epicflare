import {
	getTableName,
	getTablePrimaryKey,
	type ColumnDefinition,
	type DataManipulationOperation,
	type DataMigrationOperation,
	type Predicate,
	type SqlStatement,
	type TableRef,
} from 'remix/data-table'
import {
	quoteLiteral as quoteLiteralHelper,
	quoteTableRef as quoteTableRefHelper,
	collectColumns as collectColumnsHelper,
	normalizeJoinType as normalizeJoinTypeHelper,
	quotePath as quotePathHelper,
} from 'remix/data-table/sql-helpers'

type JoinClause = Extract<DataManipulationOperation, { kind: 'select' }>['joins'][number]
type UpsertOperation = Extract<DataManipulationOperation, { kind: 'upsert' }>
type OperationTable = Extract<DataManipulationOperation, { kind: 'select' }>['table']

type CompileContext = {
	values: Array<unknown>
}

export function compileSqliteOperation(
	operation: DataManipulationOperation,
): SqlStatement {
	if (operation.kind === 'raw') {
		return {
			text: operation.sql.text,
			values: [...operation.sql.values],
		}
	}

	const context: CompileContext = { values: [] }

	if (operation.kind === 'select') {
		let selection = '*'

		if (operation.select !== '*') {
			selection = operation.select
				.map((field) => quotePath(field.column) + ' as ' + quoteIdentifier(field.alias))
				.join(', ')
		}

		return {
			text:
				'select ' +
				(operation.distinct ? 'distinct ' : '') +
				selection +
				compileFromClause(operation.table, operation.joins, context) +
				compileWhereClause(operation.where, context) +
				compileGroupByClause(operation.groupBy) +
				compileHavingClause(operation.having, context) +
				compileOrderByClause(operation.orderBy) +
				compileLimitClause(operation.limit) +
				compileOffsetClause(operation.offset),
			values: context.values,
		}
	}

	if (operation.kind === 'count' || operation.kind === 'exists') {
		const inner =
			'select 1' +
			compileFromClause(operation.table, operation.joins, context) +
			compileWhereClause(operation.where, context) +
			compileGroupByClause(operation.groupBy) +
			compileHavingClause(operation.having, context)

		return {
			text:
				'select count(*) as ' +
				quoteIdentifier('count') +
				' from (' +
				inner +
				') as ' +
				quoteIdentifier('__dt_count'),
			values: context.values,
		}
	}

	if (operation.kind === 'insert') {
		return compileInsertOperation(
			operation.table,
			operation.values,
			operation.returning,
			context,
		)
	}

	if (operation.kind === 'insertMany') {
		return compileInsertManyOperation(
			operation.table,
			operation.values,
			operation.returning,
			context,
		)
	}

	if (operation.kind === 'update') {
		const columns = Object.keys(operation.changes)

		return {
			text:
				'update ' +
				quotePath(getTableName(operation.table)) +
				' set ' +
				columns
					.map(
						(column) =>
							quotePath(column) +
							' = ' +
							pushValue(context, operation.changes[column]),
					)
					.join(', ') +
				compileWhereClause(operation.where, context) +
				compileReturningClause(operation.returning),
			values: context.values,
		}
	}

	if (operation.kind === 'delete') {
		return {
			text:
				'delete from ' +
				quotePath(getTableName(operation.table)) +
				compileWhereClause(operation.where, context) +
				compileReturningClause(operation.returning),
			values: context.values,
		}
	}

	if (operation.kind === 'upsert') {
		return compileUpsertOperation(operation, context)
	}

	throw new Error('Unsupported operation kind')
}

export function compileSqliteMigrationOperations(
	operation: DataMigrationOperation,
): Array<SqlStatement> {
	if (operation.kind === 'raw') {
		return [{ text: operation.sql.text, values: [...operation.sql.values] }]
	}

	if (operation.kind === 'createTable') {
		const columns = Object.keys(operation.columns).map(
			(columnName) => {
				const definition = operation.columns[columnName]
				if (!definition) {
					throw new Error('Missing sqlite column definition for ' + columnName)
				}
				return quoteIdentifier(columnName) + ' ' + compileSqliteColumn(definition)
			},
		)
		const constraints: Array<string> = []

		if (operation.primaryKey) {
			constraints.push(
				'constraint ' +
					quoteIdentifier(operation.primaryKey.name) +
					' primary key (' +
					operation.primaryKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
					')',
			)
		}

		for (const unique of operation.uniques ?? []) {
			constraints.push(
				'constraint ' +
					quoteIdentifier(unique.name) +
					' unique (' +
					unique.columns.map((column) => quoteIdentifier(column)).join(', ') +
					')',
			)
		}

		for (const check of operation.checks ?? []) {
			constraints.push(
				'constraint ' + quoteIdentifier(check.name) + ' check (' + check.expression + ')',
			)
		}

		for (const foreignKey of operation.foreignKeys ?? []) {
			let clause =
				'constraint ' +
				quoteIdentifier(foreignKey.name) +
				' foreign key (' +
				foreignKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
				') references ' +
				quoteTableRef(foreignKey.references.table) +
				' (' +
				foreignKey.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
				')'

			if (foreignKey.onDelete) {
				clause += ' on delete ' + foreignKey.onDelete
			}

			if (foreignKey.onUpdate) {
				clause += ' on update ' + foreignKey.onUpdate
			}

			constraints.push(clause)
		}

		return [
			{
				text:
					'create table ' +
					(operation.ifNotExists ? 'if not exists ' : '') +
					quoteTableRef(operation.table) +
					' (' +
					[...columns, ...constraints].join(', ') +
					')',
				values: [],
			},
		]
	}

	if (operation.kind === 'alterTable') {
		const statements: Array<SqlStatement> = []

		for (const change of operation.changes) {
			let sql = 'alter table ' + quoteTableRef(operation.table) + ' '

			if (change.kind === 'addColumn') {
				sql +=
					'add column ' +
					quoteIdentifier(change.column) +
					' ' +
					compileSqliteColumn(change.definition)
			} else if (change.kind === 'changeColumn') {
				sql +=
					'alter column ' +
					quoteIdentifier(change.column) +
					' type ' +
					compileSqliteColumnType(change.definition)
			} else if (change.kind === 'renameColumn') {
				sql += 'rename column ' + quoteIdentifier(change.from) + ' to ' + quoteIdentifier(change.to)
			} else if (change.kind === 'dropColumn') {
				sql += 'drop column ' + quoteIdentifier(change.column)
			} else if (change.kind === 'addPrimaryKey') {
				sql +=
					'add primary key (' +
					change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
					')'
			} else if (change.kind === 'dropPrimaryKey') {
				sql += 'drop primary key'
			} else if (change.kind === 'addUnique') {
				sql +=
					'add constraint ' +
					quoteIdentifier(change.constraint.name) +
					' unique (' +
					change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
					')'
			} else if (change.kind === 'dropUnique') {
				sql += 'drop constraint ' + quoteIdentifier(change.name)
			} else if (change.kind === 'addForeignKey') {
				sql +=
					'add constraint ' +
					quoteIdentifier(change.constraint.name) +
					' foreign key (' +
					change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
					') references ' +
					quoteTableRef(change.constraint.references.table) +
					' (' +
					change.constraint.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
					')'
			} else if (change.kind === 'dropForeignKey') {
				sql += 'drop constraint ' + quoteIdentifier(change.name)
			} else if (change.kind === 'addCheck') {
				sql +=
					'add constraint ' +
					quoteIdentifier(change.constraint.name) +
					' check (' +
					change.constraint.expression +
					')'
			} else if (change.kind === 'dropCheck') {
				sql += 'drop constraint ' + quoteIdentifier(change.name)
			} else if (change.kind === 'setTableComment') {
				continue
			} else {
				continue
			}

			statements.push({ text: sql, values: [] })
		}

		return statements
	}

	if (operation.kind === 'renameTable') {
		return [
			{
				text:
					'alter table ' +
					quoteTableRef(operation.from) +
					' rename to ' +
					quoteIdentifier(operation.to.name),
				values: [],
			},
		]
	}

	if (operation.kind === 'dropTable') {
		return [
			{
				text:
					'drop table ' +
					(operation.ifExists ? 'if exists ' : '') +
					quoteTableRef(operation.table),
				values: [],
			},
		]
	}

	if (operation.kind === 'createIndex') {
		return [
			{
				text:
					'create ' +
					(operation.index.unique ? 'unique ' : '') +
					'index ' +
					(operation.ifNotExists ? 'if not exists ' : '') +
					quoteIdentifier(operation.index.name) +
					' on ' +
					quoteTableRef(operation.index.table) +
					' (' +
					operation.index.columns.map((column) => quoteIdentifier(column)).join(', ') +
					')' +
					(operation.index.where ? ' where ' + operation.index.where : ''),
				values: [],
			},
		]
	}

	if (operation.kind === 'dropIndex') {
		return [
			{
				text:
					'drop index ' +
					(operation.ifExists ? 'if exists ' : '') +
					quoteIdentifier(operation.name),
				values: [],
			},
		]
	}

	if (operation.kind === 'renameIndex') {
		return [
			{
				text:
					'alter table ' +
					quoteTableRef(operation.table) +
					' rename index ' +
					quoteIdentifier(operation.from) +
					' to ' +
					quoteIdentifier(operation.to),
				values: [],
			},
		]
	}

	if (operation.kind === 'addForeignKey') {
		return [
			{
				text:
					'alter table ' +
					quoteTableRef(operation.table) +
					' add constraint ' +
					quoteIdentifier(operation.constraint.name) +
					' foreign key (' +
					operation.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
					') references ' +
					quoteTableRef(operation.constraint.references.table) +
					' (' +
					operation.constraint.references.columns
						.map((column) => quoteIdentifier(column))
						.join(', ') +
					')' +
					(operation.constraint.onDelete ? ' on delete ' + operation.constraint.onDelete : '') +
					(operation.constraint.onUpdate ? ' on update ' + operation.constraint.onUpdate : ''),
				values: [],
			},
		]
	}

	if (operation.kind === 'dropForeignKey') {
		return [
			{
				text:
					'alter table ' +
					quoteTableRef(operation.table) +
					' drop constraint ' +
					quoteIdentifier(operation.name),
				values: [],
			},
		]
	}

	if (operation.kind === 'addCheck') {
		return [
			{
				text:
					'alter table ' +
					quoteTableRef(operation.table) +
					' add constraint ' +
					quoteIdentifier(operation.constraint.name) +
					' check (' +
					operation.constraint.expression +
					')',
				values: [],
			},
		]
	}

	if (operation.kind === 'dropCheck') {
		return [
			{
				text:
					'alter table ' +
					quoteTableRef(operation.table) +
					' drop constraint ' +
					quoteIdentifier(operation.name),
				values: [],
			},
		]
	}

	throw new Error('Unsupported data migration operation kind')
}

function compileInsertOperation(
	table: OperationTable,
	values: Record<string, unknown>,
	returning: '*' | Array<string> | undefined,
	context: CompileContext,
): SqlStatement {
	const columns = Object.keys(values)

	if (columns.length === 0) {
		return {
			text:
				'insert into ' +
				quotePath(getTableName(table)) +
				' default values' +
				compileReturningClause(returning),
			values: context.values,
		}
	}

	return {
		text:
			'insert into ' +
			quotePath(getTableName(table)) +
			' (' +
			columns.map((column) => quotePath(column)).join(', ') +
			') values (' +
			columns.map((column) => pushValue(context, values[column])).join(', ') +
			')' +
			compileReturningClause(returning),
		values: context.values,
	}
}

function compileInsertManyOperation(
	table: OperationTable,
	rows: Array<Record<string, unknown>>,
	returning: '*' | Array<string> | undefined,
	context: CompileContext,
): SqlStatement {
	if (rows.length === 0) {
		return {
			text: 'select 0 where 1 = 0',
			values: context.values,
		}
	}

	const columns = collectColumns(rows)

	if (columns.length === 0) {
		return {
			text:
				'insert into ' +
				quotePath(getTableName(table)) +
				' default values' +
				compileReturningClause(returning),
			values: context.values,
		}
	}

	return {
		text:
			'insert into ' +
			quotePath(getTableName(table)) +
			' (' +
			columns.map((column) => quotePath(column)).join(', ') +
			') values ' +
			rows
				.map(
					(row) =>
						'(' +
						columns
							.map((column) => {
								const value = Object.prototype.hasOwnProperty.call(row, column)
									? row[column]
									: null
								return pushValue(context, value)
							})
							.join(', ') +
						')',
				)
				.join(', ') +
			compileReturningClause(returning),
		values: context.values,
	}
}

function compileUpsertOperation(
	operation: UpsertOperation,
	context: CompileContext,
): SqlStatement {
	const insertColumns = Object.keys(operation.values)
	const conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)]

	if (insertColumns.length === 0) {
		throw new Error('upsert requires at least one value')
	}

	const updateValues = operation.update ?? operation.values
	const updateColumns = Object.keys(updateValues)

	let conflictClause = ''

	if (updateColumns.length === 0) {
		conflictClause =
			' on conflict (' +
			conflictTarget.map((column: string) => quotePath(column)).join(', ') +
			') do nothing'
	} else {
		conflictClause =
			' on conflict (' +
			conflictTarget.map((column: string) => quotePath(column)).join(', ') +
			') do update set ' +
			updateColumns
				.map(
					(column) =>
						quotePath(column) + ' = ' + pushValue(context, updateValues[column]),
				)
				.join(', ')
	}

	return {
		text:
			'insert into ' +
			quotePath(getTableName(operation.table)) +
			' (' +
			insertColumns.map((column) => quotePath(column)).join(', ') +
			') values (' +
			insertColumns
				.map((column) => pushValue(context, operation.values[column]))
				.join(', ') +
			')' +
			conflictClause +
			compileReturningClause(operation.returning),
		values: context.values,
	}
}

function compileFromClause(
	table: OperationTable,
	joins: Array<JoinClause>,
	context: CompileContext,
) {
	let output = ' from ' + quotePath(getTableName(table))

	for (const join of joins) {
		output +=
			' ' +
			normalizeJoinType(join.type) +
			' join ' +
			quotePath(getTableName(join.table)) +
			' on ' +
			compilePredicate(join.on, context)
	}

	return output
}

function compileWhereClause(
	predicates: Array<Predicate>,
	context: CompileContext,
) {
	if (predicates.length === 0) {
		return ''
	}

	return (
		' where ' +
		predicates
			.map((predicate) => '(' + compilePredicate(predicate, context) + ')')
			.join(' and ')
	)
}

function compileGroupByClause(columns: Array<string>) {
	if (columns.length === 0) {
		return ''
	}

	return ' group by ' + columns.map((column) => quotePath(column)).join(', ')
}

function compileHavingClause(
	predicates: Array<Predicate>,
	context: CompileContext,
) {
	if (predicates.length === 0) {
		return ''
	}

	return (
		' having ' +
		predicates
			.map((predicate) => '(' + compilePredicate(predicate, context) + ')')
			.join(' and ')
	)
}

function compileOrderByClause(orderBy: Array<{ column: string; direction: 'asc' | 'desc' }>) {
	if (orderBy.length === 0) {
		return ''
	}

	return (
		' order by ' +
		orderBy
			.map((clause) => quotePath(clause.column) + ' ' + clause.direction.toUpperCase())
			.join(', ')
	)
}

function compileLimitClause(limit?: number) {
	if (limit === undefined) {
		return ''
	}

	return ' limit ' + String(limit)
}

function compileOffsetClause(offset?: number) {
	if (offset === undefined) {
		return ''
	}

	return ' offset ' + String(offset)
}

function compileReturningClause(returning?: '*' | Array<string>) {
	if (!returning) {
		return ''
	}

	if (returning === '*') {
		return ' returning *'
	}

	return ' returning ' + returning.map((column) => quotePath(column)).join(', ')
}

function compilePredicate(
	predicate: unknown,
	context: CompileContext,
): string {
	const typedPredicate = predicate as {
		type: string
		[column: string]: unknown
	}

	if (typedPredicate.type === 'comparison') {
		const column = quotePath(String(typedPredicate.column))

		if (typedPredicate.operator === 'eq') {
			if (
				typedPredicate.valueType === 'value' &&
				(typedPredicate.value === null || typedPredicate.value === undefined)
			) {
				return column + ' is null'
			}

			return column + ' = ' + compileComparisonValue(typedPredicate, context)
		}

		if (typedPredicate.operator === 'ne') {
			if (
				typedPredicate.valueType === 'value' &&
				(typedPredicate.value === null || typedPredicate.value === undefined)
			) {
				return column + ' is not null'
			}

			return column + ' <> ' + compileComparisonValue(typedPredicate, context)
		}

		if (typedPredicate.operator === 'gt') {
			return column + ' > ' + compileComparisonValue(typedPredicate, context)
		}

		if (typedPredicate.operator === 'gte') {
			return column + ' >= ' + compileComparisonValue(typedPredicate, context)
		}

		if (typedPredicate.operator === 'lt') {
			return column + ' < ' + compileComparisonValue(typedPredicate, context)
		}

		if (typedPredicate.operator === 'lte') {
			return column + ' <= ' + compileComparisonValue(typedPredicate, context)
		}

		if (
			typedPredicate.operator === 'in' ||
			typedPredicate.operator === 'notIn'
		) {
			const values = Array.isArray(typedPredicate.value)
				? typedPredicate.value
				: []

			if (values.length === 0) {
				return typedPredicate.operator === 'in' ? '1 = 0' : '1 = 1'
			}

			const keyword = typedPredicate.operator === 'in' ? 'in' : 'not in'

			return (
				column +
				' ' +
				keyword +
				' (' +
				values.map((value) => pushValue(context, value)).join(', ') +
				')'
			)
		}

		if (typedPredicate.operator === 'like') {
			return column + ' like ' + compileComparisonValue(typedPredicate, context)
		}

		if (typedPredicate.operator === 'ilike') {
			return (
				'lower(' +
				column +
				') like lower(' +
				compileComparisonValue(typedPredicate, context) +
				')'
			)
		}
	}

	if (typedPredicate.type === 'between') {
		return (
			quotePath(String(typedPredicate.column)) +
			' between ' +
			pushValue(context, typedPredicate.lower) +
			' and ' +
			pushValue(context, typedPredicate.upper)
		)
	}

	if (typedPredicate.type === 'null') {
		return (
			quotePath(String(typedPredicate.column)) +
			(typedPredicate.operator === 'isNull' ? ' is null' : ' is not null')
		)
	}

	if (typedPredicate.type === 'logical') {
		const predicates = Array.isArray(typedPredicate.predicates)
			? typedPredicate.predicates
			: []

		if (predicates.length === 0) {
			return typedPredicate.operator === 'and' ? '1 = 1' : '1 = 0'
		}

		const joiner = typedPredicate.operator === 'and' ? ' and ' : ' or '

		return predicates
			.map((child) => '(' + compilePredicate(child, context) + ')')
			.join(joiner)
	}

	throw new Error('Unsupported predicate')
}

function compileComparisonValue(
	predicate: {
		type?: string
		valueType?: unknown
		value?: unknown
		[key: string]: unknown
	},
	context: CompileContext,
) {
	if (predicate.valueType === 'column') {
		return quotePath(String(predicate.value))
	}

	return pushValue(context, predicate.value)
}

function quoteLiteral(value: unknown) {
	return quoteLiteralHelper(value, { booleansAsIntegers: true })
}

function quoteTableRef(table: TableRef) {
	return quoteTableRefHelper(table, quoteIdentifier)
}

function compileSqliteColumn(definition: ColumnDefinition): string {
	const parts = [compileSqliteColumnType(definition)]

	if (definition.nullable === false) {
		parts.push('not null')
	}

	if (definition.default) {
		if (definition.default.kind === 'now') {
			parts.push('default current_timestamp')
		} else if (definition.default.kind === 'sql') {
			parts.push('default ' + definition.default.expression)
		} else {
			parts.push('default ' + quoteLiteral(definition.default.value))
		}
	}

	if (definition.primaryKey) {
		parts.push('primary key')
	}

	if (definition.unique) {
		parts.push('unique')
	}

	if (definition.computed) {
		parts.push('generated always as (' + definition.computed.expression + ')')
		parts.push(definition.computed.stored ? 'stored' : 'virtual')
	}

	if (definition.references) {
		let clause =
			'references ' +
			quoteTableRef(definition.references.table) +
			' (' +
			definition.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
			')'

		if (definition.references.onDelete) {
			clause += ' on delete ' + definition.references.onDelete
		}

		if (definition.references.onUpdate) {
			clause += ' on update ' + definition.references.onUpdate
		}

		parts.push(clause)
	}

	if (definition.checks && definition.checks.length > 0) {
		for (const check of definition.checks) {
			parts.push('check (' + check.expression + ')')
		}
	}

	return parts.join(' ')
}

function compileSqliteColumnType(definition: ColumnDefinition): string {
	if (definition.type === 'varchar' || definition.type === 'text') {
		return 'text'
	}
	if (definition.type === 'integer' || definition.type === 'bigint') {
		return 'integer'
	}
	if (definition.type === 'decimal') {
		return 'numeric'
	}
	if (definition.type === 'boolean') {
		return 'integer'
	}
	if (
		definition.type === 'uuid' ||
		definition.type === 'date' ||
		definition.type === 'time' ||
		definition.type === 'timestamp' ||
		definition.type === 'json' ||
		definition.type === 'enum'
	) {
		return 'text'
	}
	if (definition.type === 'binary') {
		return 'blob'
	}
	return 'text'
}

function quoteIdentifier(value: string) {
	return '"' + value.replace(/"/g, '""') + '"'
}

function quotePath(path: string) {
	return quotePathHelper(path, quoteIdentifier)
}

function normalizeJoinType(type: string) {
	return normalizeJoinTypeHelper(type)
}

function pushValue(context: CompileContext, value: unknown) {
	context.values.push(normalizeBoundValue(value))
	return '?'
}

function normalizeBoundValue(value: unknown) {
	if (typeof value === 'boolean') {
		return value ? 1 : 0
	}

	return value
}

function collectColumns(rows: Array<Record<string, unknown>>) {
	return collectColumnsHelper(rows)
}
