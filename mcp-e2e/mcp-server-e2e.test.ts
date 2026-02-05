import { expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { auth } from '@modelcontextprotocol/sdk/client/auth.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const bunBin = process.execPath
const defaultTimeoutMs = 60_000

const passwordHashPrefix = 'pbkdf2_sha256'
const passwordSaltBytes = 16
const passwordHashBytes = 32
const passwordHashIterations = 120_000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const toHex = (bytes: Uint8Array) =>
	Array.from(bytes)
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('')

const createPasswordHash = async (password: string) => {
	const salt = crypto.getRandomValues(new Uint8Array(passwordSaltBytes))
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	)
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt,
			iterations: passwordHashIterations,
			hash: 'SHA-256',
		},
		key,
		passwordHashBytes * 8,
	)
	return `${passwordHashPrefix}$${passwordHashIterations}$${toHex(salt)}$${toHex(
		new Uint8Array(derivedBits),
	)}`
}

const escapeSql = (value: string) => value.replace(/'/g, "''")

const runWrangler = async (args: string[]) => {
	const proc = Bun.spawn({
		cmd: [bunBin, 'x', 'wrangler', ...args],
		cwd: projectRoot,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const stdoutPromise = proc.stdout
		? new Response(proc.stdout).text()
		: Promise.resolve('')
	const stderrPromise = proc.stderr
		? new Response(proc.stderr).text()
		: Promise.resolve('')
	const exitCode = await proc.exited
	const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise])
	if (exitCode !== 0) {
		throw new Error(
			`wrangler ${args.join(' ')} failed (${exitCode}). ${stderr || stdout}`,
		)
	}
	return { stdout, stderr }
}

const createTestDatabase = async () => {
	const persistDir = await mkdtemp(join(tmpdir(), 'epicflare-mcp-e2e-'))
	const user = {
		email: `mcp-${crypto.randomUUID()}@example.com`,
		password: `pw-${crypto.randomUUID()}`,
	}

	await runWrangler([
		'd1',
		'execute',
		'APP_DB',
		'--local',
		'--env',
		'test',
		'--persist-to',
		persistDir,
		'--file',
		'migrations/0001-init.sql',
	])

	const passwordHash = await createPasswordHash(user.password)
	const username = user.email.split('@')[0] || 'user'
	const insertSql = `INSERT INTO users (username, email, password_hash) VALUES ('${escapeSql(
		username,
	)}', '${escapeSql(user.email)}', '${escapeSql(passwordHash)}');`

	await runWrangler([
		'd1',
		'execute',
		'APP_DB',
		'--local',
		'--env',
		'test',
		'--persist-to',
		persistDir,
		'--command',
		insertSql,
	])

	return {
		persistDir,
		user,
		[Symbol.asyncDispose]: async () => {
			await rm(persistDir, { recursive: true, force: true })
		},
	}
}

const getAvailablePort = async () =>
	new Promise<number>((resolve, reject) => {
		const server = createServer()
		server.once('error', reject)
		server.listen(0, '127.0.0.1', () => {
			const address = server.address() as AddressInfo
			server.close(() => resolve(address.port))
		})
	})

const captureOutput = (stream: ReadableStream<Uint8Array> | null) => {
	let output = ''
	if (!stream) {
		return () => output
	}

	const reader = stream.getReader()
	const decoder = new TextDecoder()

	const read = async () => {
		try {
			while (true) {
				const { value, done } = await reader.read()
				if (done) break
				if (value) {
					output += decoder.decode(value)
				}
			}
		} catch {
			// Ignore stream errors while capturing output.
		}
	}

	void read()
	return () => output
}

const formatOutput = (stdout: string, stderr: string) => {
	const snippets: string[] = []
	if (stdout.trim()) {
		snippets.push(`stdout: ${stdout.trim().slice(-2000)}`)
	}
	if (stderr.trim()) {
		snippets.push(`stderr: ${stderr.trim().slice(-2000)}`)
	}
	return snippets.length > 0 ? ` Output:\n${snippets.join('\n')}` : ''
}

const waitForServer = async (
	origin: string,
	proc: ReturnType<typeof Bun.spawn>,
	getStdout: () => string,
	getStderr: () => string,
) => {
	let exited = false
	let exitCode: number | null = null
	void proc.exited
		.then((code) => {
			exited = true
			exitCode = code
		})
		.catch(() => {
			exited = true
		})

	const metadataUrl = new URL('/.well-known/oauth-protected-resource', origin)
	const deadline = Date.now() + 25_000
	while (Date.now() < deadline) {
		if (exited) {
			throw new Error(
				`wrangler dev exited (${exitCode ?? 'unknown'}).${formatOutput(
					getStdout(),
					getStderr(),
				)}`,
			)
		}
		try {
			const response = await fetch(metadataUrl)
			if (response.ok) {
				await response.body?.cancel()
				return
			}
		} catch {
			// Retry until the server is ready.
		}
		await delay(250)
	}

	throw new Error(
		`Timed out waiting for dev server at ${origin}.${formatOutput(
			getStdout(),
			getStderr(),
		)}`,
	)
}

const stopProcess = async (proc: ReturnType<typeof Bun.spawn>) => {
	let exited = false
	void proc.exited.then(() => {
		exited = true
	})
	proc.kill('SIGINT')
	await Promise.race([proc.exited, delay(5_000)])
	if (!exited) {
		proc.kill('SIGKILL')
		await proc.exited
	}
}

const startDevServer = async (persistDir: string) => {
	const port = await getAvailablePort()
	const origin = `http://127.0.0.1:${port}`
	const proc = Bun.spawn({
		cmd: [
			bunBin,
			'x',
			'wrangler',
			'dev',
			'--local',
			'--env',
			'test',
			'--port',
			String(port),
			'--ip',
			'127.0.0.1',
			'--persist-to',
			persistDir,
			'--show-interactive-dev-session=false',
			'--log-level',
			'error',
		],
		cwd: projectRoot,
		stdout: 'pipe',
		stderr: 'pipe',
		env: {
			...process.env,
			CLOUDFLARE_ENV: 'test',
		},
	})

	const getStdout = captureOutput(proc.stdout)
	const getStderr = captureOutput(proc.stderr)

	await waitForServer(origin, proc, getStdout, getStderr)

	return {
		origin,
		[Symbol.asyncDispose]: async () => {
			await stopProcess(proc)
		},
	}
}

const authorizeWithPassword = async (
	authorizationUrl: URL,
	user: { email: string; password: string },
) => {
	const response = await fetch(authorizationUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json',
		},
		body: new URLSearchParams({
			decision: 'approve',
			email: user.email,
			password: user.password,
		}),
	})
	const payload = await response.json().catch(() => null)
	if (!response.ok || !payload || payload.ok !== true) {
		throw new Error(
			`OAuth approval failed (${response.status}). ${JSON.stringify(payload)}`,
		)
	}
	const redirectUrl = new URL(payload.redirectTo)
	const code = redirectUrl.searchParams.get('code')
	if (!code) {
		throw new Error('Authorization response missing code.')
	}
	return code
}

class E2EOAuthClientProvider {
	_redirectUrl: URL
	_clientMetadata: Record<string, unknown>
	_authorize: (authorizationUrl: URL) => Promise<string>
	_clientInformation?: Record<string, unknown>
	_tokens?: Record<string, unknown>
	_codeVerifier?: string
	_authorizationCode?: Promise<string>

	constructor(
		redirectUrl: URL,
		clientMetadata: Record<string, unknown>,
		authorize: (authorizationUrl: URL) => Promise<string>,
	) {
		this._redirectUrl = redirectUrl
		this._clientMetadata = clientMetadata
		this._authorize = authorize
	}

	get redirectUrl() {
		return this._redirectUrl
	}

	get clientMetadata() {
		return this._clientMetadata
	}

	clientInformation() {
		return this._clientInformation
	}

	saveClientInformation(clientInformation: Record<string, unknown>) {
		this._clientInformation = clientInformation
	}

	tokens() {
		return this._tokens
	}

	saveTokens(tokens: Record<string, unknown>) {
		this._tokens = tokens
	}

	redirectToAuthorization(authorizationUrl: URL) {
		this._authorizationCode = this._authorize(authorizationUrl)
	}

	saveCodeVerifier(codeVerifier: string) {
		this._codeVerifier = codeVerifier
	}

	codeVerifier() {
		if (!this._codeVerifier) {
			throw new Error('No code verifier saved')
		}
		return this._codeVerifier
	}

	async waitForAuthorizationCode() {
		if (!this._authorizationCode) {
			throw new Error('Authorization flow was not started')
		}
		return this._authorizationCode
	}
}

const ensureAuthorized = async (
	serverUrl: URL,
	transport: StreamableHTTPClientTransport,
	provider: E2EOAuthClientProvider,
) => {
	const result = await auth(provider, { serverUrl })
	if (result === 'AUTHORIZED') {
		return
	}
	const authorizationCode = await provider.waitForAuthorizationCode()
	await transport.finishAuth(authorizationCode)
}

const createMcpClient = async (
	origin: string,
	user: { email: string; password: string },
) => {
	const redirectUrl = new URL('/oauth/callback', origin)
	const provider = new E2EOAuthClientProvider(
		redirectUrl,
		{
			client_name: 'mcp-e2e-client',
			redirect_uris: [redirectUrl.toString()],
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'client_secret_post',
		},
		(authorizationUrl) => authorizeWithPassword(authorizationUrl, user),
	)
	const serverUrl = new URL('/mcp', origin)
	const transport = new StreamableHTTPClientTransport(serverUrl, {
		authProvider: provider,
	})
	const client = new Client(
		{ name: 'mcp-e2e', version: '1.0.0' },
		{ capabilities: {} },
	)

	await ensureAuthorized(serverUrl, transport, provider)
	await client.connect(transport)

	return {
		client,
		[Symbol.asyncDispose]: async () => {
			await client.close()
		},
	}
}

test(
	'mcp server lists tools after oauth flow',
	{ timeout: defaultTimeoutMs },
	async () => {
		await using database = await createTestDatabase()
		await using server = await startDevServer(database.persistDir)
		await using mcpClient = await createMcpClient(server.origin, database.user)

		const result = await mcpClient.client.listTools()
		const toolNames = result.tools.map((tool) => tool.name)

		expect(toolNames).toContain('do_math')
	},
)

test(
	'mcp server executes do_math tool',
	{ timeout: defaultTimeoutMs },
	async () => {
		await using database = await createTestDatabase()
		await using server = await startDevServer(database.persistDir)
		await using mcpClient = await createMcpClient(server.origin, database.user)

		const result = await mcpClient.client.callTool({
			name: 'do_math',
			arguments: {
				left: 8,
				right: 4,
				operator: '+',
			},
		})

		const textOutput =
			result.content?.find((item) => item.type === 'text')?.text ?? ''

		expect(textOutput).toContain('12')
	},
)
