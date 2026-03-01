import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Command = 'ensure'

type CliOptions = {
	wranglerConfigPath: string
	outConfigPath: string
	dryRun: boolean
	d1Location?: string
	kvTitleOverride?: string
}

type D1DatabaseListEntry = {
	uuid: string
	name: string
}

type KvNamespaceListEntry = {
	id: string
	title: string
}

type ResolvedProductionBindings = {
	workerName: string
	d1DatabaseName: string
	d1ConfiguredId: string
	kvTitle: string
	kvConfiguredId: string
}

function fail(message: string): never {
	console.error(message)
	process.exit(1)
}

function parseArgs(argv: Array<string>): {
	command: Command
	options: CliOptions
} {
	const command = argv[0]
	if (command !== 'ensure') {
		fail(
			'Missing or invalid command. Usage: bun tools/ci/production-resources.ts ensure [--out-config <path>]',
		)
	}

	const options: CliOptions = {
		wranglerConfigPath: 'wrangler.jsonc',
		outConfigPath: 'wrangler-production.generated.json',
		dryRun: false,
		d1Location: undefined,
		kvTitleOverride: undefined,
	}

	for (let index = 1; index < argv.length; index += 1) {
		const arg = argv[index]
		if (!arg) continue

		switch (arg) {
			case '--wrangler-config': {
				options.wranglerConfigPath = argv[index + 1] ?? ''
				index += 1
				break
			}
			case '--out-config': {
				options.outConfigPath = argv[index + 1] ?? ''
				index += 1
				break
			}
			case '--d1-location': {
				options.d1Location = argv[index + 1] ?? ''
				index += 1
				break
			}
			case '--kv-title': {
				options.kvTitleOverride = argv[index + 1] ?? ''
				index += 1
				break
			}
			case '--dry-run': {
				options.dryRun = true
				break
			}
			default: {
				if (arg.startsWith('-')) {
					fail(`Unknown flag: ${arg}`)
				}
			}
		}
	}

	if (!options.wranglerConfigPath) {
		fail('Missing required flag: --wrangler-config <path>')
	}
	if (!options.outConfigPath) {
		fail('Missing required flag: --out-config <path>')
	}

	return { command, options }
}

function renderArg(value: string) {
	if (!value) return '""'
	if (/^[a-zA-Z0-9_./:-]+$/.test(value)) return value
	return JSON.stringify(value)
}

function runWrangler(
	args: Array<string>,
	options?: { input?: string; quiet?: boolean },
) {
	const bunBin = process.execPath
	const result = spawnSync(bunBin, ['x', 'wrangler', ...args], {
		encoding: 'utf8',
		stdio: 'pipe',
		input: options?.input,
		env: process.env,
	})

	const status = result.status ?? 1
	const stdout = result.stdout ?? ''
	const stderr = result.stderr ?? ''

	if (!options?.quiet) {
		const rendered = args.map(renderArg).join(' ')
		console.error(`wrangler: bun x wrangler ${rendered}`)
	}

	if (status !== 0) {
		if (options?.quiet) {
			const rendered = args.map(renderArg).join(' ')
			console.error(`wrangler (failed): bun x wrangler ${rendered}`)
		}
		const output = `${stdout}${stderr}`.trim()
		if (output) {
			console.error(output)
		}
	}

	return { status, stdout, stderr }
}

function truncateWithSuffix(base: string, suffix: string, maxLen: number) {
	if (base.length + suffix.length <= maxLen) {
		return `${base}${suffix}`
	}
	const cut = Math.max(1, maxLen - suffix.length)
	const trimmed = base.slice(0, cut).replace(/-+$/g, '')
	return `${trimmed}${suffix}`
}

function defaultOauthKvTitle(workerName: string) {
	return truncateWithSuffix(workerName, '-oauth', 63)
}

function listD1Databases(): Array<D1DatabaseListEntry> {
	const result = runWrangler(['d1', 'list', '--json'], { quiet: true })
	if (result.status !== 0) {
		fail('Failed to list D1 databases (wrangler d1 list --json).')
	}
	try {
		return JSON.parse(result.stdout) as Array<D1DatabaseListEntry>
	} catch {
		fail('Could not parse JSON output from wrangler d1 list --json.')
	}
}

function ensureD1Database({
	name,
	configuredId,
	location,
	dryRun,
}: {
	name: string
	configuredId: string
	location?: string
	dryRun: boolean
}) {
	if (dryRun) {
		console.error(`[dry-run] ensure D1 database: ${name}`)
		return { name, id: `dry-run-${name}` }
	}

	const databases = listD1Databases()

	if (configuredId) {
		const byId = databases.find((entry) => entry.uuid === configuredId)
		if (byId) {
			console.error(`D1 database exists by id: ${byId.name} (${byId.uuid})`)
			return { name: byId.name, id: byId.uuid }
		}
	}

	const byName = databases.find((entry) => entry.name === name)
	if (byName) {
		console.error(`D1 database exists by name: ${name} (${byName.uuid})`)
		return { name: byName.name, id: byName.uuid }
	}

	const args = ['d1', 'create', name]
	if (location && location.length > 0) {
		args.push('--location', location)
	}
	// If Wrangler prompts to update config, always answer "no".
	const createResult = runWrangler(args, { input: 'n\n', quiet: true })
	if (createResult.status !== 0) {
		fail(`Failed to create D1 database: ${name}`)
	}

	const created = listD1Databases().find((entry) => entry.name === name)
	if (!created) {
		fail(`Created D1 database "${name}" but could not find it via list.`)
	}

	console.error(`Created D1 database: ${name} (${created.uuid})`)
	return { name: created.name, id: created.uuid }
}

function listKvNamespaces(): Array<KvNamespaceListEntry> {
	const result = runWrangler(['kv', 'namespace', 'list'], { quiet: true })
	if (result.status !== 0) {
		fail('Failed to list KV namespaces (wrangler kv namespace list).')
	}
	try {
		return JSON.parse(result.stdout) as Array<KvNamespaceListEntry>
	} catch {
		fail('Could not parse JSON output from wrangler kv namespace list.')
	}
}

function ensureKvNamespace({
	title,
	configuredId,
	dryRun,
}: {
	title: string
	configuredId: string
	dryRun: boolean
}) {
	if (dryRun) {
		console.error(`[dry-run] ensure KV namespace: ${title}`)
		return { title, id: `dry-run-${title}` }
	}

	const namespaces = listKvNamespaces()

	if (configuredId) {
		const byId = namespaces.find((entry) => entry.id === configuredId)
		if (byId) {
			console.error(`KV namespace exists by id: ${byId.title} (${byId.id})`)
			return { title: byId.title, id: byId.id }
		}
	}

	const byTitle = namespaces.find((entry) => entry.title === title)
	if (byTitle) {
		console.error(`KV namespace exists by title: ${title} (${byTitle.id})`)
		return { title: byTitle.title, id: byTitle.id }
	}

	// If Wrangler prompts to update config, always answer "no".
	const createResult = runWrangler(['kv', 'namespace', 'create', title], {
		input: 'n\n',
		quiet: true,
	})
	if (createResult.status !== 0) {
		fail(`Failed to create KV namespace: ${title}`)
	}

	const created = listKvNamespaces().find((entry) => entry.title === title)
	if (!created) {
		fail(`Created KV namespace "${title}" but could not find it via list.`)
	}

	console.error(`Created KV namespace: ${title} (${created.id})`)
	return { title: created.title, id: created.id }
}

function stripJsonc(source: string) {
	let output = ''
	let inString = false
	let stringQuote = ''
	let isEscaped = false
	let inLineComment = false
	let inBlockComment = false

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index] ?? ''
		const next = source[index + 1] ?? ''

		if (inLineComment) {
			if (char === '\n') {
				inLineComment = false
				output += char
			}
			continue
		}

		if (inBlockComment) {
			if (char === '*' && next === '/') {
				inBlockComment = false
				index += 1
			}
			continue
		}

		if (inString) {
			output += char
			if (isEscaped) {
				isEscaped = false
				continue
			}
			if (char === '\\') {
				isEscaped = true
				continue
			}
			if (char === stringQuote) {
				inString = false
				stringQuote = ''
			}
			continue
		}

		if (char === '"' || char === "'") {
			inString = true
			stringQuote = char
			output += char
			continue
		}

		if (char === '/' && next === '/') {
			inLineComment = true
			index += 1
			continue
		}

		if (char === '/' && next === '*') {
			inBlockComment = true
			index += 1
			continue
		}

		output += char
	}

	return output
}

function stripTrailingCommas(source: string) {
	let output = ''
	let inString = false
	let stringQuote = ''
	let isEscaped = false

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index] ?? ''

		if (inString) {
			output += char
			if (isEscaped) {
				isEscaped = false
				continue
			}
			if (char === '\\') {
				isEscaped = true
				continue
			}
			if (char === stringQuote) {
				inString = false
				stringQuote = ''
			}
			continue
		}

		if (char === '"' || char === "'") {
			inString = true
			stringQuote = char
			output += char
			continue
		}

		if (char === ',') {
			let lookahead = index + 1
			while (lookahead < source.length) {
				const next = source[lookahead] ?? ''
				if (next === ' ' || next === '\t' || next === '\n' || next === '\r') {
					lookahead += 1
					continue
				}
				break
			}
			const nextNonWhitespace = source[lookahead] ?? ''
			if (nextNonWhitespace === '}' || nextNonWhitespace === ']') {
				continue
			}
		}

		output += char
	}

	return output
}

function parseJsonc<T>(source: string): T {
	const withoutBom = source.replace(/^\uFEFF/, '')
	const noComments = stripJsonc(withoutBom)
	const json = stripTrailingCommas(noComments)
	return JSON.parse(json) as T
}

async function resolveProductionBindings({
	wranglerConfigPath,
	kvTitleOverride,
}: {
	wranglerConfigPath: string
	kvTitleOverride?: string
}) {
	const baseText = await readFile(wranglerConfigPath, 'utf8')
	const config = parseJsonc<Record<string, unknown>>(baseText)

	const workerName = config.name
	if (typeof workerName !== 'string' || workerName.length === 0) {
		fail(
			`wrangler config "${wranglerConfigPath}" is missing top-level "name" (worker name).`,
		)
	}

	const env = config.env
	if (!env || typeof env !== 'object') {
		fail(`wrangler config "${wranglerConfigPath}" is missing "env".`)
	}

	const productionEnv = (env as Record<string, unknown>).production
	if (!productionEnv || typeof productionEnv !== 'object') {
		fail(`wrangler config "${wranglerConfigPath}" is missing "env.production".`)
	}

	const d1Databases = (productionEnv as Record<string, unknown>).d1_databases
	if (!Array.isArray(d1Databases)) {
		fail(
			`wrangler config "${wranglerConfigPath}" is missing "env.production.d1_databases".`,
		)
	}

	const d1Entry = d1Databases.find((entry) => {
		if (!entry || typeof entry !== 'object') return false
		return (entry as Record<string, unknown>).binding === 'APP_DB'
	}) as Record<string, unknown> | undefined
	if (!d1Entry) {
		fail(
			`wrangler config "${wranglerConfigPath}" has no production D1 binding for "APP_DB".`,
		)
	}

	const d1DatabaseName = d1Entry.database_name
	if (typeof d1DatabaseName !== 'string' || d1DatabaseName.length === 0) {
		fail(
			`wrangler config "${wranglerConfigPath}" is missing "database_name" for production "APP_DB".`,
		)
	}
	const d1ConfiguredId =
		typeof d1Entry.database_id === 'string' ? d1Entry.database_id : ''

	const kvNamespaces = (productionEnv as Record<string, unknown>).kv_namespaces
	if (!Array.isArray(kvNamespaces)) {
		fail(
			`wrangler config "${wranglerConfigPath}" is missing "env.production.kv_namespaces".`,
		)
	}

	const kvEntry = kvNamespaces.find((entry) => {
		if (!entry || typeof entry !== 'object') return false
		return (entry as Record<string, unknown>).binding === 'OAUTH_KV'
	}) as Record<string, unknown> | undefined
	if (!kvEntry) {
		fail(
			`wrangler config "${wranglerConfigPath}" has no production KV binding for "OAUTH_KV".`,
		)
	}

	const kvConfiguredId = typeof kvEntry.id === 'string' ? kvEntry.id : ''
	const kvTitleFromConfig =
		typeof kvEntry.title === 'string' && kvEntry.title.length > 0
			? kvEntry.title
			: ''
	const kvTitle =
		(kvTitleOverride && kvTitleOverride.length > 0 && kvTitleOverride) ||
		kvTitleFromConfig ||
		defaultOauthKvTitle(workerName)

	const resolved: ResolvedProductionBindings = {
		workerName,
		d1DatabaseName,
		d1ConfiguredId,
		kvTitle,
		kvConfiguredId,
	}

	return resolved
}

async function writeGeneratedWranglerConfig({
	baseConfigPath,
	outConfigPath,
	d1DatabaseName,
	d1DatabaseId,
	oauthKvId,
}: {
	baseConfigPath: string
	outConfigPath: string
	d1DatabaseName: string
	d1DatabaseId: string
	oauthKvId: string
}) {
	const baseText = await readFile(baseConfigPath, 'utf8')
	const config = parseJsonc<Record<string, unknown>>(baseText)

	const env = config.env
	if (!env || typeof env !== 'object') {
		fail(`wrangler config "${baseConfigPath}" is missing "env".`)
	}

	const productionEnv = (env as Record<string, unknown>).production
	if (!productionEnv || typeof productionEnv !== 'object') {
		fail(`wrangler config "${baseConfigPath}" is missing "env.production".`)
	}

	const d1Databases = (productionEnv as Record<string, unknown>).d1_databases
	if (!Array.isArray(d1Databases)) {
		fail(
			`wrangler config "${baseConfigPath}" is missing "env.production.d1_databases".`,
		)
	}

	const d1EntryIndex = d1Databases.findIndex((entry) => {
		if (!entry || typeof entry !== 'object') return false
		return (entry as Record<string, unknown>).binding === 'APP_DB'
	})
	if (d1EntryIndex < 0) {
		fail(
			`wrangler config "${baseConfigPath}" has no production D1 binding for "APP_DB".`,
		)
	}

	const d1Entry = d1Databases[d1EntryIndex] as Record<string, unknown>
	d1Databases[d1EntryIndex] = {
		...d1Entry,
		database_name: d1DatabaseName,
		database_id: d1DatabaseId,
	}

	const kvNamespaces = (productionEnv as Record<string, unknown>).kv_namespaces
	if (!Array.isArray(kvNamespaces)) {
		fail(
			`wrangler config "${baseConfigPath}" is missing "env.production.kv_namespaces".`,
		)
	}

	const kvEntryIndex = kvNamespaces.findIndex((entry) => {
		if (!entry || typeof entry !== 'object') return false
		return (entry as Record<string, unknown>).binding === 'OAUTH_KV'
	})
	if (kvEntryIndex < 0) {
		fail(
			`wrangler config "${baseConfigPath}" has no production KV binding for "OAUTH_KV".`,
		)
	}

	const kvEntry = kvNamespaces[kvEntryIndex] as Record<string, unknown>
	kvNamespaces[kvEntryIndex] = {
		...kvEntry,
		id: oauthKvId,
		preview_id: oauthKvId,
	}

	const resolvedOut = path.resolve(outConfigPath)
	await writeFile(
		resolvedOut,
		`${JSON.stringify(config, null, '\t')}\n`,
		'utf8',
	)
	console.error(`Wrote generated Wrangler config: ${resolvedOut}`)
	return resolvedOut
}

async function ensureProductionResources(options: CliOptions) {
	const bindings = await resolveProductionBindings({
		wranglerConfigPath: options.wranglerConfigPath,
		kvTitleOverride: options.kvTitleOverride,
	})
	console.error(
		`Ensuring production resources for worker: ${bindings.workerName} (D1: ${bindings.d1DatabaseName}, KV: ${bindings.kvTitle})`,
	)

	const d1 = ensureD1Database({
		name: bindings.d1DatabaseName,
		configuredId: bindings.d1ConfiguredId,
		location: options.d1Location,
		dryRun: options.dryRun,
	})
	const kv = ensureKvNamespace({
		title: bindings.kvTitle,
		configuredId: bindings.kvConfiguredId,
		dryRun: options.dryRun,
	})

	const generatedConfigPath = await writeGeneratedWranglerConfig({
		baseConfigPath: options.wranglerConfigPath,
		outConfigPath: options.outConfigPath,
		d1DatabaseName: d1.name,
		d1DatabaseId: d1.id,
		oauthKvId: kv.id,
	})

	// Emit GitHub Actions-friendly outputs (stdout only).
	console.log(`wrangler_config=${generatedConfigPath}`)
	console.log(`d1_database_name=${d1.name}`)
	console.log(`d1_database_id=${d1.id}`)
	console.log(`oauth_kv_title=${kv.title}`)
	console.log(`oauth_kv_id=${kv.id}`)
}

async function main() {
	const { command, options } = parseArgs(process.argv.slice(2))

	if (!process.env.CLOUDFLARE_API_TOKEN && !options.dryRun) {
		fail(
			'Missing CLOUDFLARE_API_TOKEN (required for Wrangler resource operations).',
		)
	}

	if (command === 'ensure') {
		await ensureProductionResources(options)
		return
	}
}

await main()
