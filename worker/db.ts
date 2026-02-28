import { array, parse, type Schema } from 'remix/data-schema'

type D1Value = string | number | boolean | null | ArrayBuffer | Uint8Array

export type DbQuery<Params extends ReadonlyArray<D1Value>> = {
	sql: string
	params: Params
}

type DataSchema<T> = Schema<unknown, T>

export function sql<Params extends ReadonlyArray<D1Value>>(
	strings: TemplateStringsArray,
	...params: Params
): DbQuery<Params> {
	const sqlText = strings.reduce(
		(accumulator, chunk, index) =>
			`${accumulator}${chunk}${index < params.length ? '?' : ''}`,
		'',
	)
	return { sql: sqlText, params }
}

export function createDb(db: D1Database) {
	function prepare<Params extends ReadonlyArray<D1Value>>(
		query: DbQuery<Params>,
	) {
		return db.prepare(query.sql).bind(...query.params)
	}

	return {
		async queryFirst<T, Params extends ReadonlyArray<D1Value>>(
			query: DbQuery<Params>,
			schema: DataSchema<T>,
		): Promise<T | null> {
			const row = await prepare(query).first()
			if (!row) return null
			return parse(schema, row)
		},
		async queryAll<T, Params extends ReadonlyArray<D1Value>>(
			query: DbQuery<Params>,
			schema: DataSchema<T>,
		): Promise<Array<T>> {
			const result = await prepare(query).all()
			const rows = Array.isArray(result?.results) ? result.results : []
			return parse(array(schema), rows)
		},
		async exec<Params extends ReadonlyArray<D1Value>>(query: DbQuery<Params>) {
			return prepare(query).run()
		},
	}
}
