import { createDatabase, createTable, sql } from 'remix/data-table'
import { number, string, type InferOutput } from 'remix/data-schema'
import { type BuildAction } from 'remix/fetch-router'
import { type AppEnv } from '#types/env-schema.ts'
import type routes from '#server/routes.ts'
import { createD1DataTableAdapter } from '#worker/d1-data-table-adapter.ts'

const dataTableProbeTable = createTable({
	name: 'data_table_probe',
	columns: {
		id: string(),
		value: string(),
		updated_at: number(),
	},
	primaryKey: 'id',
})

type DataTableProbeRow = InferOutput<typeof dataTableProbeTable>

async function runDataTableProbe(db: ReturnType<typeof createDatabase>) {
	await db.exec(sql`
		CREATE TABLE IF NOT EXISTS data_table_probe (
			id TEXT PRIMARY KEY NOT NULL,
			value TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`)

	const updatedAt = Date.now()
	await db.query(dataTableProbeTable).upsert(
		{
			id: 'health-check',
			value: 'ok',
			updated_at: updatedAt,
		},
		{
			conflictTarget: ['id'],
		},
	)

	const row = await db.find(dataTableProbeTable, 'health-check')
	const count = await db.count(dataTableProbeTable)
	const canUse =
		Boolean(row) &&
		row?.id === 'health-check' &&
		row?.value === 'ok' &&
		typeof row?.updated_at === 'number'

	return {
		canUse,
		count,
		row: row as DataTableProbeRow | null,
	}
}

export function createHealthHandler(appEnv: AppEnv) {
	const dataTableDb = createDatabase(createD1DataTableAdapter(appEnv.APP_DB))

	return {
		middleware: [],
		async action({ url }) {
			const probe = url.searchParams.get('probe')
			if (probe === 'data-table') {
				try {
					const probeResult = await runDataTableProbe(dataTableDb)
					return Response.json({ ok: true, dataTableProbe: probeResult })
				} catch (error) {
					console.error('data-table D1 probe failed', error)
					return Response.json(
						{
							ok: false,
							error: 'data-table D1 probe failed',
						},
						{ status: 500 },
					)
				}
			}

			return Response.json({ ok: true })
		},
	} satisfies BuildAction<
		typeof routes.health.method,
		typeof routes.health.pattern
	>
}
