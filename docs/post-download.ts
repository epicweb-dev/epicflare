import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rl = createInterface({ input, output })

const color = {
	reset: '\u001b[0m',
	bold: '\u001b[1m',
	dim: '\u001b[2m',
	green: '\u001b[32m',
	yellow: '\u001b[33m',
	blue: '\u001b[34m',
}

function paint(value: string, tone: keyof typeof color) {
	return `${color[tone]}${value}${color.reset}`
}

function toKebabCase(value: string) {
	return value
		.trim()
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase()
}

async function prompt(question: string, defaultValue?: string) {
	const suffix = defaultValue ? ` (${defaultValue})` : ''
	const answer = (
		await rl.question(`\n${paint('🧩', 'blue')} ${question}${suffix}: `)
	).trim()
	return answer.length > 0 ? answer : (defaultValue ?? '')
}

async function promptRequired(question: string, defaultValue?: string) {
	let answer = ''
	while (answer.length === 0) {
		answer = await prompt(question, defaultValue)
		if (answer.length === 0) {
			console.log('Please provide a value.')
		}
	}
	return answer
}

async function promptConfirm(question: string, defaultYes: boolean) {
	const suffix = defaultYes ? ' (Y/n)' : ' (y/N)'
	const answer = (
		await rl.question(`\n${paint('🧩', 'blue')} ${question}${suffix}: `)
	).trim()
	if (answer.length === 0) {
		return defaultYes
	}
	return answer.toLowerCase().startsWith('y')
}

function replaceFirstStringProperty(
	content: string,
	key: string,
	value: string,
) {
	const regex = new RegExp(`"${key}"\\s*:\\s*"[^"]*"`)
	return content.replace(regex, `"${key}": "${value}"`)
}

function replaceAllStringProperty(content: string, key: string, value: string) {
	const regex = new RegExp(`"${key}"\\s*:\\s*"[^"]*"`, 'g')
	return content.replace(regex, `"${key}": "${value}"`)
}

function replaceStringPropertySequence(
	content: string,
	key: string,
	values: Array<string>,
) {
	const regex = new RegExp(`"${key}"\\s*:\\s*"[^"]*"`, 'g')
	let index = 0
	return content.replace(regex, () => {
		const value = values[Math.min(index, values.length - 1)]
		index += 1
		return `"${key}": "${value}"`
	})
}

function logDryRun(message: string) {
	console.log(`${paint('🧪 [dry-run]', 'dim')} ${message}`)
}

function runWrangler(
	args: Array<string>,
	options?: { stdio?: 'inherit' | 'pipe'; input?: string },
) {
	const result = spawnSync('bunx', ['wrangler', ...args], {
		encoding: 'utf8',
		stdio: options?.stdio ?? 'pipe',
		input: options?.input,
	})
	return {
		status: result.status ?? 1,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
	}
}

function extractIdFromOutput(output: string) {
	const jsonMatch = /"id"\s*:\s*"([^"]+)"/.exec(output)
	if (jsonMatch?.[1]) {
		return jsonMatch[1]
	}
	const textMatch = /\bid:\s*([a-f0-9-]+)/i.exec(output)
	if (textMatch?.[1]) {
		return textMatch[1]
	}
	return ''
}

function buildSummaryOutput(summary: {
	inputs: Record<string, string>
	changes: Record<string, boolean>
	dryRun: boolean
}) {
	console.log(`\n${paint('🧾 Summary', 'bold')}`)
	console.log(`- dry-run: ${summary.dryRun ? 'yes' : 'no'}`)
	console.log(`- inputs:`)
	for (const [key, value] of Object.entries(summary.inputs)) {
		console.log(`  - ${key}: ${value}`)
	}
	console.log(`- changes:`)
	for (const [key, value] of Object.entries(summary.changes)) {
		console.log(`  - ${key}: ${value ? 'yes' : 'no'}`)
	}
}

function updateWrangler({
	workerName,
	databaseName,
	databaseId,
	previewDatabaseName,
	previewDatabaseId,
	kvNamespaceId,
	kvNamespacePreviewId,
	dryRun,
}: {
	workerName: string
	databaseName: string
	databaseId: string
	previewDatabaseName: string
	previewDatabaseId: string
	kvNamespaceId: string
	kvNamespacePreviewId: string
	dryRun: boolean
}) {
	const wranglerPath = join(process.cwd(), 'wrangler.jsonc')
	const original = readFileSync(wranglerPath, 'utf8')
	let next = original

	next = replaceFirstStringProperty(next, 'name', workerName)
	next = replaceStringPropertySequence(next, 'database_name', [
		databaseName,
		previewDatabaseName,
		previewDatabaseName,
	])
	if (databaseId && previewDatabaseId) {
		next = replaceStringPropertySequence(next, 'database_id', [
			databaseId,
			previewDatabaseId,
			previewDatabaseId,
		])
	}
	if (kvNamespaceId) {
		next = replaceAllStringProperty(next, 'id', kvNamespaceId)
	}
	if (kvNamespacePreviewId) {
		next = replaceAllStringProperty(next, 'preview_id', kvNamespacePreviewId)
	}

	const changed = next !== original

	if (dryRun) {
		logDryRun(
			changed
				? 'Would update wrangler.jsonc with provided values.'
				: 'wrangler.jsonc already matches provided values.',
		)
		return changed
	}

	if (changed) {
		writeFileSync(wranglerPath, next)
	}
	return changed
}

function updatePackageJson({
	packageName,
	dryRun,
}: {
	packageName: string
	dryRun: boolean
}) {
	const packageJsonPath = join(process.cwd(), 'package.json')
	const original = readFileSync(packageJsonPath, 'utf8')
	const packageJson = JSON.parse(original)
	packageJson.name = packageName
	if (packageJson.scripts?.['post-download']) {
		delete packageJson.scripts['post-download']
	}
	const next = `${JSON.stringify(packageJson, null, 2)}\n`
	const changed = next !== original

	if (dryRun) {
		logDryRun(
			changed
				? 'Would update package.json name and scripts.'
				: 'package.json already matches provided values.',
		)
		return changed
	}

	writeFileSync(packageJsonPath, next)
	return changed
}

function updateEnv({
	cookieSecret,
	dryRun,
}: {
	cookieSecret: string
	dryRun: boolean
}) {
	const envPath = join(process.cwd(), '.env')
	const examplePath = join(process.cwd(), '.env.example')

	const hasEnv = existsSync(envPath)
	const exampleContent = existsSync(examplePath)
		? readFileSync(examplePath, 'utf8')
		: ''

	const envContent = hasEnv
		? readFileSync(envPath, 'utf8')
		: exampleContent || 'COOKIE_SECRET=\n'

	const next = envContent.replace(
		/^COOKIE_SECRET=.*$/m,
		`COOKIE_SECRET=${cookieSecret}`,
	)
	const changed = next !== envContent || (!hasEnv && Boolean(exampleContent))

	if (dryRun) {
		if (!hasEnv) {
			logDryRun('Would create .env from .env.example.')
		}
		logDryRun(
			changed
				? 'Would update COOKIE_SECRET in .env.'
				: '.env already has the provided COOKIE_SECRET.',
		)
		return changed
	}

	if (!hasEnv && exampleContent) {
		writeFileSync(envPath, exampleContent)
	}

	writeFileSync(envPath, next.endsWith('\n') ? next : `${next}\n`)
	return changed
}

function removeSelf() {
	const scriptPath = fileURLToPath(import.meta.url)
	try {
		rmSync(scriptPath)
	} catch (error) {
		console.log(`${paint('⚠️  Could not remove', 'yellow')} ${scriptPath}.`)
		console.log(error)
	}
}

function showNextSteps() {
	console.log(`\n${paint('✅ Next steps', 'bold')}`)
	console.log('• Run `bunx wrangler login` if you have not yet.')
	console.log(
		'• Confirm your Cloudflare D1 and KV resources match `wrangler.jsonc`.',
	)
	console.log('• Add repository secrets for deploys:')
	console.log('  - CLOUDFLARE_API_TOKEN')
	console.log('  - COOKIE_SECRET')
	console.log('• Review `docs/getting-started.md` for the rest of the setup.')
}

function parseArgs(args: Array<string>) {
	const parsed: Record<string, string | boolean> = {}
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index]
		if (!arg.startsWith('--')) {
			continue
		}
		const key = arg.slice(2)
		const next = args[index + 1]
		if (!next || next.startsWith('--')) {
			parsed[key] = true
			continue
		}
		parsed[key] = next
		index += 1
	}
	return parsed
}

function getArgValue(args: Record<string, string | boolean>, key: string) {
	const value = args[key]
	return typeof value === 'string' ? value : ''
}

function getMissingRootFiles() {
	const required = ['wrangler.jsonc', 'package.json']
	return required.filter((file) => !existsSync(join(process.cwd(), file)))
}

function ensureValidWorkingDirectory() {
	const missing = getMissingRootFiles()
	if (missing.length === 0) {
		return
	}
	console.error('This script must be run from the repo root.')
	console.error(`Missing: ${missing.join(', ')}`)
	console.error('Try: bun ./docs/post-download.ts')
	process.exit(1)
}

function reportNonInteractiveFailure(missing: Array<string>) {
	const suggestedWorkerName = toKebabCase(basename(process.cwd()))
	const suggestedPreviewName = `${suggestedWorkerName}-preview`
	console.error('Non-interactive mode detected; cannot prompt for input.')
	console.error(`Missing required values: ${missing.join(', ')}`)
	console.error('Provide flags to continue. Example:')
	console.error(
		`bun ./docs/post-download.ts --worker-name ${suggestedWorkerName} --database-name ${suggestedWorkerName} --preview-database-name ${suggestedPreviewName} --database-id <id> --preview-database-id <id> --kv-namespace-id <id>`,
	)
	process.exit(1)
}

function isWranglerLoggedIn() {
	return runWrangler(['whoami']).status === 0
}

function isWranglerAvailable() {
	return runWrangler(['--version']).status === 0
}

function runPreflightChecks() {
	const missingRootFiles = getMissingRootFiles()
	const wranglerAvailable = isWranglerAvailable()
	const wranglerLoggedIn = wranglerAvailable ? isWranglerLoggedIn() : false

	console.log(`\n${paint('🔎 Preflight checks', 'bold')}`)
	console.log(
		`- repo root: ${missingRootFiles.length === 0 ? 'ok' : 'missing files'}`,
	)
	if (missingRootFiles.length > 0) {
		console.log(`  - missing: ${missingRootFiles.join(', ')}`)
	}
	console.log(`- wrangler available: ${wranglerAvailable ? 'ok' : 'missing'}`)
	console.log(`- wrangler login: ${wranglerLoggedIn ? 'ok' : 'not logged in'}`)

	if (missingRootFiles.length === 0 && wranglerAvailable && wranglerLoggedIn) {
		return true
	}

	console.log(`\n${paint('🛠️  Fixes', 'bold')}`)
	if (missingRootFiles.length > 0) {
		console.log('- Run this script from the repo root.')
	}
	if (!wranglerAvailable) {
		console.log('- Install Wrangler: bunx wrangler --version')
	}
	if (wranglerAvailable && !wranglerLoggedIn) {
		console.log('- Log in: bunx wrangler login')
	}
	return false
}

function printWranglerLoginInstructions() {
	console.log(`\n${paint('🔐 Wrangler login required', 'bold')}`)
	console.log('Run: bunx wrangler login')
	console.log('Then re-run: bun ./docs/post-download.ts')
}

async function ensureWranglerLogin(canPrompt: boolean) {
	if (!isWranglerAvailable()) {
		console.log(`\n${paint('⚠️  Wrangler is not available', 'yellow')}`)
		console.log('Install or verify with: bunx wrangler --version')
		process.exit(1)
	}
	if (isWranglerLoggedIn()) {
		return
	}
	if (!canPrompt) {
		printWranglerLoginInstructions()
		process.exit(1)
	}
	const shouldLogin = await promptConfirm(
		'Wrangler is not logged in. Run `bunx wrangler login` now?',
		true,
	)
	if (!shouldLogin) {
		printWranglerLoginInstructions()
		process.exit(1)
	}
	const loginResult = runWrangler(['login'], { stdio: 'inherit' })
	if (loginResult.status !== 0 || !isWranglerLoggedIn()) {
		printWranglerLoginInstructions()
		process.exit(1)
	}
}

function createD1Database({
	databaseName,
	dryRun,
}: {
	databaseName: string
	dryRun: boolean
}) {
	if (dryRun) {
		logDryRun(`Would create D1 database "${databaseName}".`)
		return `dry-run-${databaseName}`
	}
	const result = runWrangler(['d1', 'create', databaseName])
	if (result.status !== 0) {
		console.error('\nFailed to create D1 database.')
		console.error(result.stdout || result.stderr)
		process.exit(1)
	}
	const id = extractIdFromOutput(result.stdout + result.stderr)
	if (!id) {
		console.error('\nCould not parse D1 database id from output.')
		console.error(result.stdout || result.stderr)
		process.exit(1)
	}
	return id
}

function createKvNamespace({
	title,
	preview,
	dryRun,
}: {
	title: string
	preview: boolean
	dryRun: boolean
}) {
	if (dryRun) {
		logDryRun(
			`Would create ${preview ? 'preview ' : ''}KV namespace "${title}".`,
		)
		return `dry-run-${title}`
	}
	const args = ['kv', 'namespace', 'create', 'OAUTH_KV', '--title', title]
	if (preview) {
		args.push('--preview')
	}
	// Pipe "n" to suppress wrangler's prompt asking if we want to add it to config
	// We handle config updates ourselves via updateWrangler()
	const result = runWrangler(args, { input: 'n\n' })
	if (result.status !== 0) {
		console.error('\nFailed to create KV namespace.')
		console.error(result.stdout || result.stderr)
		process.exit(1)
	}
	const id = extractIdFromOutput(result.stdout + result.stderr)
	if (!id) {
		console.error('\nCould not parse KV namespace id from output.')
		console.error(result.stdout || result.stderr)
		process.exit(1)
	}
	return id
}

async function run() {
	console.log(paint('✨ epicflare post-download setup', 'bold'))
	console.log(`${paint('Tip:', 'dim')} Press Enter to accept defaults.\n`)

	const args = parseArgs(process.argv.slice(2))
	const useDefaults = args.defaults === true
	const dryRun = args['dry-run'] === true
	const guided = args.guided === true
	const checkOnly = args.check === true
	const jsonOutput = args.json === true
	const canPrompt = Boolean(process.stdin.isTTY && process.stdout.isTTY)
	const missingFlags: Array<string> = []

	if (checkOnly) {
		const ok = runPreflightChecks()
		rl.close()
		process.exit(ok ? 0 : 1)
	}

	ensureValidWorkingDirectory()

	const defaultAppName = toKebabCase(basename(process.cwd()))
	const cookieSecretDefault = randomBytes(32).toString('hex')

	if (dryRun) {
		logDryRun('No files will be modified.')
	}

	await ensureWranglerLogin(canPrompt)

	async function resolveValue({
		label,
		flag,
		defaultValue,
	}: {
		label: string
		flag: string
		defaultValue?: string
	}) {
		const valueFromArgs = getArgValue(args, flag)
		if (valueFromArgs.length > 0) {
			return valueFromArgs
		}
		if (useDefaults && defaultValue) {
			return defaultValue
		}
		if (canPrompt) {
			return await promptRequired(label, defaultValue)
		}
		missingFlags.push(`--${flag}`)
		return ''
	}

	const appName = await resolveValue({
		label: 'App name (base for defaults)',
		flag: 'app-name',
		defaultValue: defaultAppName,
	})
	const workerName = await resolveValue({
		label: 'Cloudflare Worker name',
		flag: 'worker-name',
		defaultValue: appName,
	})
	const packageName = await resolveValue({
		label: 'Package name',
		flag: 'package-name',
		defaultValue: appName,
	})
	const databaseName = await resolveValue({
		label: 'D1 database name (prod)',
		flag: 'database-name',
		defaultValue: appName,
	})
	const previewDatabaseName = await resolveValue({
		label: 'D1 database name (preview/test)',
		flag: 'preview-database-name',
		defaultValue: `${appName}-preview`,
	})
	const cookieSecret = await resolveValue({
		label: 'COOKIE_SECRET for .env',
		flag: 'cookie-secret',
		defaultValue: cookieSecretDefault,
	})

	const providedDatabaseId = getArgValue(args, 'database-id')
	const providedPreviewDatabaseId = getArgValue(args, 'preview-database-id')
	const providedKvNamespaceId = getArgValue(args, 'kv-namespace-id')
	const providedKvNamespacePreviewId = getArgValue(
		args,
		'kv-namespace-preview-id',
	)

	const needsResourceIds =
		!providedDatabaseId ||
		!providedPreviewDatabaseId ||
		!providedKvNamespaceId ||
		!providedKvNamespacePreviewId

	let shouldCreateResources = false
	if (guided && canPrompt && needsResourceIds) {
		shouldCreateResources = await promptConfirm(
			'Create D1 and KV resources with Wrangler?',
			true,
		)
	}

	let skipResourceIds = false
	if (guided && canPrompt && needsResourceIds && !shouldCreateResources) {
		skipResourceIds = await promptConfirm(
			'Skip resource IDs for now and set them later?',
			false,
		)
	}

	let databaseId = providedDatabaseId
	let previewDatabaseId = providedPreviewDatabaseId
	let kvNamespaceId = providedKvNamespaceId
	let kvNamespacePreviewId = providedKvNamespacePreviewId

	if (shouldCreateResources) {
		const kvNamespaceTitle = await resolveValue({
			label: 'KV namespace title (prod)',
			flag: 'kv-namespace-title',
			defaultValue: `${appName}-oauth`,
		})
		const kvNamespacePreviewTitle = await resolveValue({
			label: 'KV namespace title (preview)',
			flag: 'kv-namespace-preview-title',
			defaultValue: `${appName}-oauth-preview`,
		})

		databaseId = createD1Database({ databaseName, dryRun })
		previewDatabaseId = createD1Database({
			databaseName: previewDatabaseName,
			dryRun,
		})
		kvNamespaceId = createKvNamespace({
			title: kvNamespaceTitle,
			preview: false,
			dryRun,
		})
		kvNamespacePreviewId = createKvNamespace({
			title: kvNamespacePreviewTitle,
			preview: true,
			dryRun,
		})
	} else if (!skipResourceIds) {
		databaseId = await resolveValue({
			label: 'D1 database id (prod)',
			flag: 'database-id',
		})
		previewDatabaseId = await resolveValue({
			label: 'D1 database id (preview/test)',
			flag: 'preview-database-id',
		})
		kvNamespaceId = await resolveValue({
			label: 'KV namespace id (OAuth/session)',
			flag: 'kv-namespace-id',
		})
		kvNamespacePreviewId = await resolveValue({
			label: 'KV namespace preview id',
			flag: 'kv-namespace-preview-id',
			defaultValue: kvNamespaceId,
		})
	}

	if (!canPrompt && missingFlags.length > 0) {
		reportNonInteractiveFailure(missingFlags)
	}

	const changedWrangler = updateWrangler({
		workerName,
		databaseName,
		databaseId,
		previewDatabaseName,
		previewDatabaseId,
		kvNamespaceId,
		kvNamespacePreviewId,
		dryRun,
	})
	const changedPackageJson = updatePackageJson({ packageName, dryRun })
	const changedEnv = updateEnv({ cookieSecret, dryRun })

	buildSummaryOutput({
		dryRun,
		inputs: {
			appName,
			workerName,
			packageName,
			databaseName,
			databaseId: databaseId || '(skipped)',
			previewDatabaseName,
			previewDatabaseId: previewDatabaseId || '(skipped)',
			kvNamespaceId: kvNamespaceId || '(skipped)',
			kvNamespacePreviewId: kvNamespacePreviewId || '(skipped)',
			cookieSecret: '(hidden)',
		},
		changes: {
			wranglerJsonc: changedWrangler,
			packageJson: changedPackageJson,
			env: changedEnv,
		},
	})

	rl.close()
	if (dryRun) {
		logDryRun('Skipping self-delete.')
	} else {
		removeSelf()
	}
	showNextSteps()

	if (jsonOutput) {
		console.log(`\n${paint('📦 JSON summary', 'bold')}`)
		console.log(
			JSON.stringify(
				{
					dryRun,
					inputs: {
						appName,
						workerName,
						packageName,
						databaseName,
						databaseId,
						previewDatabaseName,
						previewDatabaseId,
						kvNamespaceId,
						kvNamespacePreviewId,
					},
					changes: {
						wranglerJsonc: changedWrangler,
						packageJson: changedPackageJson,
						env: changedEnv,
					},
				},
				null,
				2,
			),
		)
	}
}

run().catch((error) => {
	console.error('Post-download setup failed.')
	console.error(error)
	rl.close()
	process.exit(1)
})
