import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
	existsSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rl = createInterface({ input, output })
const templateAppToken = 'epicflare'
const skippedBrandingDirectories = new Set([
	'.git',
	'node_modules',
	'.wrangler',
	'.turbo',
	'.next',
	'dist',
	'build',
])
const skippedBrandingFiles = new Set(['docs/post-download.ts'])
const protectedBrandingTokens = ['epicweb-dev/epicflare', 'create-epicflare']

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

function replaceBrandingTokens(content: string, replacement: string) {
	const placeholders = new Map<string, string>()
	let next = content
	for (const [index, token] of protectedBrandingTokens.entries()) {
		if (!next.includes(token)) {
			continue
		}
		const placeholder = `__EPICFLARE_TEMPLATE_${index}__`
		placeholders.set(placeholder, token)
		next = next.replaceAll(token, placeholder)
	}
	next = next.replaceAll(templateAppToken, replacement)
	for (const [placeholder, token] of placeholders) {
		next = next.replaceAll(placeholder, token)
	}
	return next
}

function logDryRun(message: string) {
	console.log(`${paint('🧪 [dry-run]', 'dim')} ${message}`)
}

function collectFilesForBranding(
	rootDirectory: string,
	relativeDirectory = '',
): Array<string> {
	const directoryPath = join(rootDirectory, relativeDirectory)
	const entries = readdirSync(directoryPath, { withFileTypes: true })
	const files: Array<string> = []

	for (const entry of entries) {
		if (entry.name === '.' || entry.name === '..') {
			continue
		}

		const relativePath = relativeDirectory
			? join(relativeDirectory, entry.name)
			: entry.name

		if (entry.isDirectory()) {
			if (skippedBrandingDirectories.has(entry.name)) {
				continue
			}
			files.push(...collectFilesForBranding(rootDirectory, relativePath))
			continue
		}

		if (entry.isFile()) {
			files.push(relativePath)
		}
	}

	return files
}

function updateBrandingTokens({
	appName,
	dryRun,
}: {
	appName: string
	dryRun: boolean
}) {
	const replacement = toKebabCase(appName)
	if (replacement.length === 0) {
		return false
	}

	const rootDirectory = process.cwd()
	const candidateFiles = collectFilesForBranding(rootDirectory)
	const updatedFiles: Array<string> = []

	for (const relativePath of candidateFiles) {
		const normalizedPath = relativePath.replace(/\\/g, '/')
		if (skippedBrandingFiles.has(normalizedPath)) {
			continue
		}
		const filePath = join(rootDirectory, relativePath)
		const fileBuffer = readFileSync(filePath)
		if (fileBuffer.includes(0)) {
			continue
		}
		const original = fileBuffer.toString('utf8')
		if (!original.includes(templateAppToken)) {
			continue
		}
		const next = replaceBrandingTokens(original, replacement)
		if (next === original) {
			continue
		}
		if (!dryRun) {
			writeFileSync(filePath, next)
		}
		updatedFiles.push(relativePath)
	}

	const changed = updatedFiles.length > 0
	if (dryRun) {
		logDryRun(
			changed
				? `Would replace "${templateAppToken}" with "${replacement}" in ${updatedFiles.length} file(s).`
				: `No "${templateAppToken}" tokens found for replacement.`,
		)
	}
	return changed
}

function runWrangler(
	args: Array<string>,
	options?: { stdio?: 'inherit' | 'pipe'; input?: string; quiet?: boolean },
) {
	if (!options?.quiet) {
		console.log(
			paint(`    Running:\n      bunx wrangler ${args.join(' ')}`, 'dim'),
		)
	}
	const result = spawnSync('bunx', ['wrangler', ...args], {
		encoding: 'utf8',
		stdio: options?.stdio ?? 'pipe',
		input: options?.input,
	})
	const status = result.status ?? 1
	if (status !== 0 && options?.stdio !== 'inherit' && !options?.quiet) {
		console.error(
			paint(`  Command failed: wrangler ${args.join(' ')}`, 'yellow'),
		)
		const output = (result.stdout ?? '') + (result.stderr ?? '')
		if (output.trim()) {
			console.error(output)
		}
	}
	return {
		status,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
	}
}

function runGit(
	args: Array<string>,
	options?: { stdio?: 'inherit' | 'pipe'; input?: string; quiet?: boolean },
) {
	if (!options?.quiet) {
		console.log(paint(`    Running:\n      git ${args.join(' ')}`, 'dim'))
	}
	const result = spawnSync('git', args, {
		encoding: 'utf8',
		stdio: options?.stdio ?? 'pipe',
		input: options?.input,
	})
	const status = result.status ?? 1
	if (status !== 0 && options?.stdio !== 'inherit' && !options?.quiet) {
		console.error(paint(`  Command failed: git ${args.join(' ')}`, 'yellow'))
		const output = (result.stdout ?? '') + (result.stderr ?? '')
		if (output.trim()) {
			console.error(output)
		}
	}
	return {
		status,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
	}
}

function isGitAvailable() {
	return runGit(['--version'], { quiet: true }).status === 0
}

function isInsideGitWorkTree() {
	return (
		runGit(['rev-parse', '--is-inside-work-tree'], { quiet: true }).status === 0
	)
}

function hasGitHeadCommit() {
	return runGit(['rev-parse', '--verify', 'HEAD'], { quiet: true }).status === 0
}

async function maybeInitializeGitAndCommit({
	guided,
	canPrompt,
	dryRun,
}: {
	guided: boolean
	canPrompt: boolean
	dryRun: boolean
}) {
	if (!guided || !canPrompt) {
		return
	}

	const shouldInitializeGit = await promptConfirm(
		'Initialize git and create an initial commit (`init`)?',
		false,
	)
	if (!shouldInitializeGit) {
		return
	}

	if (!isGitAvailable()) {
		console.log(
			`\n${paint('⚠️  Git is not available; skipping git init.', 'yellow')}`,
		)
		return
	}

	const alreadyInGitRepo = isInsideGitWorkTree()
	if (dryRun) {
		logDryRun(
			alreadyInGitRepo
				? 'Would create an initial git commit with message "init".'
				: 'Would run `git init`, `git add .`, and `git commit -m "init"`.',
		)
		return
	}

	if (!alreadyInGitRepo) {
		console.log(paint('\n  Initializing git repository...', 'dim'))
		const gitInit = runGit(['init'], { stdio: 'inherit' })
		if (gitInit.status !== 0) {
			console.log(
				`\n${paint('⚠️  Failed to initialize git repository. Continue manually with:', 'yellow')}`,
			)
			console.log('  git init')
			return
		}
	}

	if (hasGitHeadCommit()) {
		console.log(
			paint(
				'\n  Git repository already has commits; skipping initial commit.',
				'dim',
			),
		)
		return
	}

	const gitStatus = runGit(['status', '--porcelain'], { quiet: true })
	if (gitStatus.status !== 0) {
		console.log(
			`\n${paint('⚠️  Could not read git status. Continue manually with:', 'yellow')}`,
		)
		console.log('  git add .')
		console.log('  git commit -m "init"')
		return
	}
	if (!gitStatus.stdout.trim()) {
		console.log(
			paint('\n  No changes to commit for initial git commit.', 'dim'),
		)
		return
	}

	console.log(paint('\n  Creating initial git commit...', 'dim'))
	const gitAdd = runGit(['add', '.'], { stdio: 'inherit' })
	if (gitAdd.status !== 0) {
		console.log(
			`\n${paint('⚠️  Failed to stage files. Continue manually with:', 'yellow')}`,
		)
		console.log('  git add .')
		console.log('  git commit -m "init"')
		return
	}
	const gitCommit = runGit(['commit', '-m', 'init'], { stdio: 'inherit' })
	if (gitCommit.status !== 0) {
		console.log(
			`\n${paint('⚠️  Failed to create initial commit. Continue manually with:', 'yellow')}`,
		)
		console.log('  git commit -m "init"')
		return
	}

	console.log(paint('  ✓ Created initial git commit "init"', 'green'))
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
	const testPath = join(process.cwd(), '.env.test')

	const hasEnv = existsSync(envPath)
	const testContent = existsSync(testPath) ? readFileSync(testPath, 'utf8') : ''

	const envContent = hasEnv
		? readFileSync(envPath, 'utf8')
		: testContent || 'COOKIE_SECRET=\n'

	const next = envContent.replace(
		/^COOKIE_SECRET=.*$/m,
		`COOKIE_SECRET=${cookieSecret}`,
	)
	const changed = next !== envContent || (!hasEnv && Boolean(testContent))

	if (dryRun) {
		if (!hasEnv) {
			logDryRun('Would create .env from .env.test.')
		}
		logDryRun(
			changed
				? 'Would update COOKIE_SECRET in .env.'
				: '.env already has the provided COOKIE_SECRET.',
		)
		return changed
	}

	if (!hasEnv && testContent) {
		writeFileSync(envPath, testContent)
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
	console.log(
		'• For CI deploys, missing production D1/KV resources are auto-created.',
	)
	console.log(
		'• This setup script does not create Cloudflare resources or rewrite Wrangler resource IDs.',
	)
	console.log('• Add repository secrets for deploys:')
	console.log('  - CLOUDFLARE_API_TOKEN')
	console.log('  - COOKIE_SECRET')
	console.log(
		'• See `docs/setup-manifest.md` for required/optional GitHub secrets and how to get them.',
	)
	console.log('• Review `docs/getting-started.md` for the rest of the setup.')
}

function parseArgs(args: Array<string>) {
	const parsed: Record<string, string | boolean> = {}
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index]
		if (!arg) continue
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
	console.error('Non-interactive mode detected; cannot prompt for input.')
	console.error(`Missing required values: ${missing.join(', ')}`)
	console.error('Provide flags to continue. Example:')
	console.error('bun ./docs/post-download.ts --defaults')
	process.exit(1)
}

function isWranglerLoggedIn() {
	return runWrangler(['whoami'], { quiet: true }).status === 0
}

function isWranglerAvailable() {
	return runWrangler(['--version'], { quiet: true }).status === 0
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

	if (missingRootFiles.length === 0) {
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

async function run() {
	console.log(paint('✨ post-download setup', 'bold'))
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

	async function resolveValue({
		label,
		flag,
		defaultValue,
		showDefault = true,
	}: {
		label: string
		flag: string
		defaultValue?: string
		showDefault?: boolean
	}) {
		const valueFromArgs = getArgValue(args, flag)
		if (valueFromArgs.length > 0) {
			return valueFromArgs
		}
		if (useDefaults && defaultValue) {
			return defaultValue
		}
		if (canPrompt) {
			if (defaultValue && !showDefault) {
				const value = await prompt(
					`${label} (press Enter to use generated value)`,
				)
				return value.length > 0 ? value : defaultValue
			}
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
	const packageName = await resolveValue({
		label: 'Package name',
		flag: 'package-name',
		defaultValue: appName,
	})
	const cookieSecret = await resolveValue({
		label: 'COOKIE_SECRET for .env',
		flag: 'cookie-secret',
		defaultValue: cookieSecretDefault,
		showDefault: false,
	})

	if (!canPrompt && missingFlags.length > 0) {
		reportNonInteractiveFailure(missingFlags)
	}

	const changedBranding = updateBrandingTokens({ appName, dryRun })
	const changedPackageJson = updatePackageJson({ packageName, dryRun })
	const changedEnv = updateEnv({ cookieSecret, dryRun })

	buildSummaryOutput({
		dryRun,
		inputs: {
			appName,
			packageName,
			cloudflareResources: 'managed during deploy',
			cookieSecret: '(hidden)',
		},
		changes: {
			brandingTokens: changedBranding,
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
	await maybeInitializeGitAndCommit({ guided, canPrompt, dryRun })
	showNextSteps()

	if (jsonOutput) {
		console.log(`\n${paint('📦 JSON summary', 'bold')}`)
		console.log(
			JSON.stringify(
				{
					dryRun,
					inputs: {
						appName,
						packageName,
						cloudflareResources: 'managed during deploy',
					},
					changes: {
						brandingTokens: changedBranding,
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
