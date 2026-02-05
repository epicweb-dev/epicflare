import getPort from 'get-port'

const envName = process.env.CLOUDFLARE_ENV ?? 'production'
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
	const desiredPort = Number.parseInt(process.env.PORT ?? '3742', 10)
	const portRange = Array.from(
		{ length: 10 },
		(_, index) => desiredPort + index,
	)
	resolvedPort = String(
		await getPort({
			port: portRange,
		}),
	)
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

const exitCode = await proc.exited
process.exit(exitCode)
