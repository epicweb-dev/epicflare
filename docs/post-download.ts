import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rl = createInterface({ input, output })

function toKebabCase(value: string) {
	return value
		.trim()
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase()
}

async function prompt(question: string, defaultValue?: string) {
	const suffix = defaultValue ? ` (${defaultValue})` : ''
	const answer = (await rl.question(`${question}${suffix}: `)).trim()
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
	const answer = (await rl.question(`${question}${suffix}: `)).trim()
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
	console.log(`[dry-run] ${message}`)
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
	next = replaceStringPropertySequence(next, 'database_id', [
		databaseId,
		previewDatabaseId,
		previewDatabaseId,
	])
	next = replaceAllStringProperty(next, 'id', kvNamespaceId)
	next = replaceAllStringProperty(next, 'preview_id', kvNamespacePreviewId)

	if (dryRun) {
		logDryRun(
			next === original
				? 'wrangler.jsonc already matches provided values.'
				: 'Would update wrangler.jsonc with provided values.',
		)
		return
	}

	if (next !== original) {
		writeFileSync(wranglerPath, next)
	}
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

	if (dryRun) {
		logDryRun(
			next === original
				? 'package.json already matches provided values.'
				: 'Would update package.json name and scripts.',
		)
		return
	}

	writeFileSync(packageJsonPath, next)
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

	if (dryRun) {
		if (!hasEnv) {
			logDryRun('Would create .env from .env.example.')
		}
		logDryRun(
			next === envContent
				? '.env already has the provided COOKIE_SECRET.'
				: 'Would update COOKIE_SECRET in .env.',
		)
		return
	}

	if (!hasEnv && exampleContent) {
		writeFileSync(envPath, exampleContent)
	}

	writeFileSync(envPath, next.endsWith('\n') ? next : `${next}\n`)
}

function removeSelf() {
	const scriptPath = fileURLToPath(import.meta.url)
	try {
		rmSync(scriptPath)
	} catch (error) {
		console.log(`Could not remove ${scriptPath}.`)
		console.log(error)
	}
}

function showNextSteps() {
	console.log('\nNext steps:')
	console.log('- Run `bunx wrangler login` if you have not yet.')
	console.log(
		'- Confirm your Cloudflare D1 and KV resources match `wrangler.jsonc`.',
	)
	console.log('- Add repository secrets for deploys:')
	console.log('  - CLOUDFLARE_API_TOKEN')
	console.log('  - COOKIE_SECRET')
	console.log('- Review `docs/getting-started.md` for the rest of the setup.')
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

function ensureValidWorkingDirectory() {
	const required = ['wrangler.jsonc', 'package.json']
	const missing = required.filter(
		(file) => !existsSync(join(process.cwd(), file)),
	)
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
	const result = spawnSync('bunx', ['wrangler', 'whoami'], {
		encoding: 'utf8',
		stdio: 'pipe',
	})
	return result.status === 0
}

function printWranglerLoginInstructions() {
	console.log('\nWrangler login required.')
	console.log('Run: bunx wrangler login')
	console.log('Then re-run: bun ./docs/post-download.ts')
}

async function ensureWranglerLogin(canPrompt: boolean) {
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
	const loginResult = spawnSync('bunx', ['wrangler', 'login'], {
		stdio: 'inherit',
	})
	if (loginResult.status !== 0 || !isWranglerLoggedIn()) {
		printWranglerLoginInstructions()
		process.exit(1)
	}
}

async function run() {
	console.log('Epicflare post-download setup')
	console.log('Press Enter to accept defaults.\n')

	ensureValidWorkingDirectory()
	const args = parseArgs(process.argv.slice(2))
	const useDefaults = args.defaults === true
	const dryRun = args['dry-run'] === true
	const canPrompt = Boolean(process.stdin.isTTY && process.stdout.isTTY)
	const missingFlags: Array<string> = []

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
	const databaseId = await resolveValue({
		label: 'D1 database id (prod)',
		flag: 'database-id',
	})
	const previewDatabaseName = await resolveValue({
		label: 'D1 database name (preview/test)',
		flag: 'preview-database-name',
		defaultValue: `${appName}-preview`,
	})
	const previewDatabaseId = await resolveValue({
		label: 'D1 database id (preview/test)',
		flag: 'preview-database-id',
	})
	const kvNamespaceId = await resolveValue({
		label: 'KV namespace id (OAuth/session)',
		flag: 'kv-namespace-id',
	})
	const kvNamespacePreviewId = await resolveValue({
		label: 'KV namespace preview id',
		flag: 'kv-namespace-preview-id',
		defaultValue: kvNamespaceId,
	})
	const cookieSecret = await resolveValue({
		label: 'COOKIE_SECRET for .env',
		flag: 'cookie-secret',
		defaultValue: cookieSecretDefault,
	})

	if (!canPrompt && missingFlags.length > 0) {
		reportNonInteractiveFailure(missingFlags)
	}

	updateWrangler({
		workerName,
		databaseName,
		databaseId,
		previewDatabaseName,
		previewDatabaseId,
		kvNamespaceId,
		kvNamespacePreviewId,
		dryRun,
	})
	updatePackageJson({ packageName, dryRun })
	updateEnv({ cookieSecret, dryRun })

	rl.close()
	if (dryRun) {
		logDryRun('Skipping self-delete.')
	} else {
		removeSelf()
	}
	showNextSteps()
}

run().catch((error) => {
	console.error('Post-download setup failed.')
	console.error(error)
	rl.close()
	process.exit(1)
})
