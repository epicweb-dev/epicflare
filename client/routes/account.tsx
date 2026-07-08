import { css, type Handle } from 'remix/ui'
import { buildAuthLink } from '#client/auth-links.ts'
import { tryConsumeRouteLoaderData } from '#client/loader-data-context.tsx'
import { consumeStaleNavigationData } from '#client/navigation-data.ts'
import { readRouterUrl } from '#client/router-location.tsx'
import { routeLoaderRedirect } from '#client/route-loader.ts'
import { readSession } from '#client/session-context.tsx'
import { fetchSessionInfo } from '#client/session.ts'
import { colors, spacing, typography } from '#client/styles/tokens.ts'
import { routes } from '#server/routes.ts'
import { type AccountLoaderData } from '#shared/loader-data.ts'
type AccountStatus = 'idle' | 'loading' | 'ready' | 'error'
type SessionPayload = {
	ok?: boolean
	session?: {
		email?: unknown
	}
}
function getCurrentHref(handle: Pick<Handle, 'context'>) {
	try {
		return readRouterUrl(handle)
	} catch {
		return typeof window === 'undefined'
			? routes.account.href()
			: `${window.location.pathname}${window.location.search}${window.location.hash}`
	}
}
function setLoginRedirect(url: URL) {
	return routeLoaderRedirect(
		buildAuthLink(routes.login.href(), `${url.pathname}${url.search}`),
	)
}
export async function loadAccountRouteData(url: URL, signal: AbortSignal) {
	const session = await fetchSessionInfo(signal)
	if (!session) return setLoginRedirect(url)
	const account: AccountLoaderData = {
		ok: true,
		email: session.email,
	}
	return {
		account,
	}
}
export function AccountRoute(handle: Handle) {
	function readEmbeddedEmail() {
		return readSession(handle)?.email.trim() ?? ''
	}
	const initialEmail = readEmbeddedEmail()
	let status: AccountStatus = initialEmail ? 'ready' : 'loading'
	let email = initialEmail
	let message: string | null = null
	let loadInFlight = false
	let lastLoaderHref: string | null = null
	function syncRouteLoaderData() {
		const href = getCurrentHref(handle)
		const isStale = consumeStaleNavigationData(href)
		if (!isStale && href === lastLoaderHref) return
		lastLoaderHref = href
		const data = tryConsumeRouteLoaderData(handle, 'account', href)
		if (!data?.ok) return
		email = data.email
		status = 'ready'
		message = null
	}
	function syncEmbeddedSession() {
		const nextEmail = readEmbeddedEmail()
		if (nextEmail) {
			email = nextEmail
			status = 'ready'
			message = null
			return
		}
		if (status === 'ready') {
			email = ''
			status = 'loading'
			message = null
		}
	}
	async function loadAccount(signal: AbortSignal) {
		try {
			const response = await fetch('/session', {
				headers: { Accept: 'application/json' },
				credentials: 'include',
				signal,
			})
			if (signal.aborted) return
			const payload = (await response
				.json()
				.catch(() => null)) as SessionPayload | null
			const sessionEmail =
				response.ok &&
				payload?.ok &&
				typeof payload?.session?.email === 'string'
					? payload.session.email.trim()
					: ''
			if (!sessionEmail) {
				window.location.assign(routes.login.href())
				return
			}
			email = sessionEmail
			status = 'ready'
			message = null
			handle.update()
		} catch {
			if (signal.aborted) return
			status = 'error'
			message = 'Unable to load your account.'
			handle.update()
		} finally {
			loadInFlight = false
		}
	}
	return () => {
		syncRouteLoaderData()
		syncEmbeddedSession()
		if (
			typeof window !== 'undefined' &&
			status === 'loading' &&
			!loadInFlight
		) {
			loadInFlight = true
			handle.queueTask(loadAccount)
		}
		return (
			<section
				mix={[
					css({
						maxWidth: '28rem',
						margin: '0 auto',
						display: 'grid',
						gap: spacing.lg,
					}),
				]}
			>
				<header mix={[css({ display: 'grid', gap: spacing.xs })]}>
					<h1
						mix={[
							css({
								fontSize: typography.fontSize.xl,
								fontWeight: typography.fontWeight.semibold,
								color: colors.text,
								margin: 0,
							}),
						]}
					>
						{email ? `Welcome, ${email}` : 'Welcome'}
					</h1>
					<p mix={[css({ color: colors.textMuted })]}>
						You are signed in to epicflare.
					</p>
				</header>
				{status === 'loading' ? (
					<p mix={[css({ color: colors.textMuted })]}>Loading your account…</p>
				) : null}
				{message ? (
					<p role="alert" mix={[css({ color: colors.error })]}>
						{message}
					</p>
				) : null}
			</section>
		)
	}
}
