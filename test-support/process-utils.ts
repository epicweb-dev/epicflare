import { setTimeout as delay } from 'node:timers/promises'
import { type ChildProcess } from 'node:child_process'

export type TrackedProcess = {
	proc: ChildProcess
	exitPromise: Promise<number | null>
}

export function captureOutput(stream: NodeJS.ReadableStream | null | undefined) {
	let output = ''
	if (!stream) {
		return () => output
	}
	stream.setEncoding('utf8')
	stream.on('data', (chunk) => {
		output += chunk
	})
	stream.on('error', () => {
		// Ignore stream errors while capturing output.
	})
	return () => output
}

export function formatOutput(stdout: string, stderr: string) {
	const snippets: Array<string> = []
	if (stdout.trim()) {
		snippets.push(`stdout: ${stdout.trim().slice(-2000)}`)
	}
	if (stderr.trim()) {
		snippets.push(`stderr: ${stderr.trim().slice(-2000)}`)
	}
	return snippets.length > 0 ? ` Output:\n${snippets.join('\n')}` : ''
}

export function createExitPromise(proc: ChildProcess): Promise<number | null> {
	if (proc.exitCode !== null || proc.signalCode !== null) {
		return Promise.resolve(proc.exitCode)
	}
	return new Promise((resolve) => {
		const finalize = (code: number | null) => {
			proc.off('error', onError)
			proc.off('exit', onExit)
			resolve(code)
		}
		const onError = () => finalize(null)
		const onExit = (code: number | null) => finalize(code)
		proc.once('error', onError)
		proc.once('exit', onExit)
	})
}

export async function stopProcess({ proc, exitPromise }: TrackedProcess) {
	proc.kill('SIGINT')
	const exited = await Promise.race([
		exitPromise.then(() => true),
		delay(5_000).then(() => false),
	])
	if (!exited) {
		proc.kill('SIGKILL')
		await exitPromise
	}
}
