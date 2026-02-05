import { setTimeout as delay } from 'node:timers/promises'
import net from 'node:net'
import getPort from 'get-port'

const envName = process.env.CLOUDFLARE_ENV ?? 'production'
const portWaitTimeoutMs = 5000
const args = process.argv.slice(2)

const hasEnvFlag = args.includes('--env') || args.includes('-e')
const isDevCommand = args[0] === 'dev'
const hasPortFlag = args.includes('--port')

const commandArgs = [...args]

if (!hasEnvFlag) {
	commandArgs.push('--env', envName)
}

let resolvedPort = process.env.PORT

if (isDevCommand && !hasPortFlag) {
	if (process.env.PORT) {
		resolvedPort = process.env.PORT
	} else {
		const desiredPort = 3742
		const portRange = Array.from(
			{ length: 10 },
			(_, index) => desiredPort + index,
		)
		resolvedPort = String(
			await getPort({
				port: portRange,
			}),
		)
	}
	commandArgs.push('--port', resolvedPort)
}

const processEnv = {
	...process.env,
	CLOUDFLARE_ENV: envName,
	...(resolvedPort ? { PORT: resolvedPort } : {}),
}

const proc = Bun.spawn(['wrangler', ...commandArgs], {
	stdio: ['inherit', 'inherit', 'inherit'],
	env: processEnv,
})

let isShuttingDown = false

function handleSignal(signal: NodeJS.Signals) {
	if (isShuttingDown) return
	isShuttingDown = true
	proc.kill(signal)
	setTimeout(() => {
		if (!proc.killed) proc.kill('SIGKILL')
		process.exit(1)
	}, 5_000).unref()
}

process.on('SIGINT', () => handleSignal('SIGINT'))
process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('exit', () => {
	if (!proc.killed) proc.kill('SIGKILL')
})

const exitCode = await proc.exited
if (isDevCommand && resolvedPort) {
	const didFreePort = await waitForPortFree(
		Number.parseInt(resolvedPort, 10),
		portWaitTimeoutMs,
	)
	if (!didFreePort) {
		console.warn(
			`Timed out waiting for port ${resolvedPort} to free up before exit.`,
		)
	}
}
process.exit(exitCode)

async function waitForPortFree(port: number, timeoutMs: number) {
	const start = Date.now()
	while (await isPortInUse(port)) {
		if (Date.now() - start >= timeoutMs) {
			return false
		}
		await delay(100)
	}
	return true
}

function isPortInUse(port: number) {
	return new Promise<boolean>((resolve) => {
		const socket = new net.Socket()

		const finish = (inUse: boolean) => {
			socket.removeAllListeners()
			socket.destroy()
			resolve(inUse)
		}

		socket.setTimeout(250)
		socket.once('connect', () => finish(true))
		socket.once('timeout', () => finish(true))
		socket.once('error', (error) => {
			if ('code' in error && error.code === 'ECONNREFUSED') {
				finish(false)
				return
			}
			finish(true)
		})

		socket.connect(port, '127.0.0.1')
	})
}
