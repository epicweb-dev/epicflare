import { spawn, type ChildProcess } from 'node:child_process'
import { platform } from 'node:os'
import readline from 'node:readline'

type Command = 'dev' | 'client' | 'worker' | 'build' | 'deploy' | 'typecheck'

const defaultWorkerOrigin = 'http://localhost:8787'

const ansiReset = '\x1b[0m'
const ansiBright = '\x1b[1m'
const ansiDim = '\x1b[2m'

function colorize(text: string, color: string) {
	const bunColor = typeof Bun === 'undefined' ? null : Bun.color
	const colorCode = bunColor ? bunColor(color, 'ansi-16m') || '' : ''
	return colorCode ? `${colorCode}${text}${ansiReset}` : text
}

function bright(text: string) {
	return `${ansiBright}${text}${ansiReset}`
}

function dim(text: string) {
	return `${ansiDim}${text}${ansiReset}`
}

const commands: Record<Command, string> = {
	dev: 'Start client + worker dev servers',
	client: 'Start esbuild watcher only',
	worker: 'Start Wrangler dev server only',
	build: 'Build client + worker',
	deploy: 'Build and deploy',
	typecheck: 'Run TypeScript typecheck',
}

type OutputFilterKey = 'client' | 'worker' | 'default'

const outputFilters: Record<OutputFilterKey, Array<RegExp>> = {
	client: [],
	worker: [],
	default: [],
}

const command = (process.argv[2] as Command | undefined) ?? 'dev'
const extraArgs = process.argv.slice(3)
let shutdown: (() => void) | null = null

if (!(command in commands)) {
	showHelp(`Unknown command: ${command}`)
	process.exit(1)
}

if (command === 'dev') {
	startDev()
} else if (command === 'client') {
	runBunScript('dev:client', extraArgs, {}, { outputFilter: 'client' })
} else if (command === 'worker') {
	runBunScript('dev:worker', extraArgs, {}, { outputFilter: 'worker' })
} else if (command === 'build') {
	runBunScript('build')
} else if (command === 'deploy') {
	runBunScript('deploy')
} else if (command === 'typecheck') {
	runBunScript('typecheck')
}

function startDev() {
	const workerOrigin = resolveWorkerOrigin()

	const client = runBunScript(
		'dev:client',
		[],
		{},
		{
			outputFilter: 'client',
		},
	)
	const worker = runBunScript(
		'dev:worker',
		extraArgs,
		{},
		{ outputFilter: 'worker' },
	)

	setupInteractiveCli(workerOrigin)
	shutdown = setupShutdown([client, worker])
}

function resolveWorkerOrigin() {
	return (process.env.WORKER_DEV_ORIGIN || defaultWorkerOrigin).trim()
}

function runBunScript(
	script: string,
	args: Array<string> = [],
	envOverrides: Record<string, string> = {},
	options: { outputFilter?: OutputFilterKey } = {},
): ChildProcess {
	const bun = platform() === 'win32' ? 'bun.exe' : 'bun'
	const child = spawn(bun, ['run', '--silent', script, '--', ...args], {
		stdio: ['inherit', 'pipe', 'pipe'],
		env: { ...process.env, ...envOverrides },
	})

	pipeOutput(child, options.outputFilter)

	child.on('exit', (code, signal) => {
		if (signal) return
		if (code && code !== 0) {
			process.exitCode = code
		}
	})

	return child
}

function pipeOutput(
	child: ChildProcess,
	filterKey: OutputFilterKey = 'default',
) {
	const filters = outputFilters[filterKey]
	if (child.stdout) {
		pipeStream(child.stdout, process.stdout, filters)
	}
	if (child.stderr) {
		pipeStream(child.stderr, process.stderr, filters)
	}
}

function pipeStream(
	source: NodeJS.ReadableStream,
	target: NodeJS.WritableStream,
	filters: Array<RegExp>,
) {
	const rl = readline.createInterface({ input: source })
	rl.on('line', (line) => {
		if (filters.some((filter) => filter.test(line))) {
			return
		}
		target.write(`${line}\n`)
	})
}

function setupShutdown(children: Array<ChildProcess>) {
	function doShutdown() {
		for (const child of children) {
			if (!child.killed) {
				child.kill('SIGINT')
			}
		}

		setTimeout(() => {
			process.exit(0)
		}, 500)
	}

	process.on('SIGINT', doShutdown)
	process.on('SIGTERM', doShutdown)
	return doShutdown
}

function setupInteractiveCli(workerOrigin: string) {
	const stdin = process.stdin
	if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') return

	showHelp()
	console.log(`\n${dim('App running at')} ${bright(workerOrigin)}`)

	readline.emitKeypressEvents(stdin)
	stdin.setRawMode(true)
	stdin.resume()

	stdin.on('keypress', (_key, key) => {
		if (key?.ctrl && key.name === 'c') {
			shutdown?.()
			return
		}

		switch (key?.name) {
			case 'o': {
				openInBrowser(workerOrigin)
				break
			}
			case 'u': {
				copyToClipboard(workerOrigin)
				break
			}
			case 'c': {
				console.clear()
				showHelp()
				console.log(`\nApp running at ${workerOrigin}`)
				break
			}
			case 'h':
			case '?': {
				showHelp()
				break
			}
			case 'q': {
				shutdown?.()
				break
			}
		}
	})
}

function showHelp(header?: string) {
	if (header) console.log(header)
	console.log(`\n${bright('CLI shortcuts:')}`)
	console.log(
		`  ${colorize('o', 'cyan')} - ${colorize('open browser', 'green')}`,
	)
	console.log(
		`  ${colorize('u', 'cyan')} - ${colorize('copy URL', 'cornflowerblue')}`,
	)
	console.log(
		`  ${colorize('c', 'cyan')} - ${colorize('clear console', 'yellow')}`,
	)
	console.log(`  ${colorize('h', 'cyan')} - ${colorize('help', 'magenta')}`)
	console.log(`  ${colorize('q', 'cyan')} - ${colorize('quit', 'firebrick')}`)
	console.log(`\n${bright('Commands:')}`)
	for (const [name, description] of Object.entries(commands)) {
		console.log(`  ${colorize(name.padEnd(8), 'cyan')} ${description}`)
	}
}

function openInBrowser(url: string) {
	const os = platform()
	if (os === 'darwin') {
		spawn('open', [url], { stdio: 'ignore', detached: true }).unref()
		return
	}

	if (os === 'win32') {
		spawn('cmd', ['/c', 'start', url], {
			stdio: 'ignore',
			detached: true,
		}).unref()
		return
	}

	spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref()
}

function copyToClipboard(text: string) {
	const os = platform()
	if (os === 'darwin') {
		const proc = spawn('pbcopy', [], { stdio: ['pipe', 'ignore', 'ignore'] })
		proc.stdin?.write(text)
		proc.stdin?.end()
		return
	}

	if (os === 'win32') {
		const proc = spawn('clip', [], { stdio: ['pipe', 'ignore', 'ignore'] })
		proc.stdin?.write(text)
		proc.stdin?.end()
		return
	}

	const proc = spawn('xclip', ['-selection', 'clipboard'], {
		stdio: ['pipe', 'ignore', 'ignore'],
	})
	proc.stdin?.write(text)
	proc.stdin?.end()
}
