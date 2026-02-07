export type SessionInfo = {
	email: string
}

export type SessionStatus = 'idle' | 'loading' | 'ready'

export async function fetchSessionInfo(): Promise<SessionInfo | null> {
	try {
		const response = await fetch('/session', {
			headers: { Accept: 'application/json' },
			credentials: 'include',
		})
		const payload = await response.json().catch(() => null)
		const email =
			response.ok && payload?.ok && typeof payload?.session?.email === 'string'
				? payload.session.email.trim()
				: ''
		return email ? { email } : null
	} catch {
		return null
	}
}
