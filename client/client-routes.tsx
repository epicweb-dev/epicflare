import { type Handle } from 'remix/component'
import { navigate } from './client-router.tsx'
import { Counter } from './counter.tsx'
import {
	fetchSessionInfo,
	type SessionInfo,
	type SessionStatus,
} from './session.ts'
import {
	colors,
	radius,
	shadows,
	spacing,
	transitions,
	typography,
} from './styles/tokens.ts'

function getSearchParams() {
	return typeof window === 'undefined'
		? new URLSearchParams()
		: new URLSearchParams(window.location.search)
}

function normalizeRedirectTo(value: string | null) {
	if (!value) return null
	if (!value.startsWith('/')) return null
	if (value.startsWith('//')) return null
	return value
}

export function HomeRoute() {
	return (_match: { path: string; params: Record<string, string> }) => (
		<section
			css={{
				display: 'grid',
				gap: spacing.lg,
				justifyItems: 'center',
				textAlign: 'center',
			}}
		>
			<div
				css={{
					display: 'grid',
					gap: spacing.lg,
					padding: spacing.lg,
					borderRadius: radius.lg,
					border: `1px solid ${colors.border}`,
					background: `linear-gradient(135deg, ${colors.primarySoftStrong}, ${colors.primarySoftest})`,
					boxShadow: shadows.sm,
					maxWidth: '36rem',
					width: '100%',
				}}
			>
				<div
					css={{
						display: 'grid',
						gap: spacing.md,
						justifyItems: 'center',
					}}
				>
					<img
						src="/logo.png"
						alt="epicflare logo"
						css={{
							width: '220px',
							maxWidth: '100%',
							height: 'auto',
						}}
					/>
					<div css={{ display: 'grid', gap: spacing.sm }}>
						<h1
							css={{
								fontSize: typography.fontSize['2xl'],
								fontWeight: typography.fontWeight.semibold,
								margin: 0,
								color: colors.text,
							}}
						>
							epicflare <span css={{ color: colors.primaryText }}>Remix 3</span>
						</h1>
						<p css={{ margin: 0, color: colors.textMuted }}>
							Remix 3 components running on the client, backed by Remix 3
							routing in the worker.
						</p>
					</div>
				</div>
			</div>
			<Counter setup={{ initial: 1 }} />
		</section>
	)
}

type AuthMode = 'login' | 'signup'
type AuthStatus = 'idle' | 'submitting' | 'success' | 'error'
type AccountStatus = 'idle' | 'loading' | 'ready' | 'error'

type LoginFormSetup = {
	initialMode?: AuthMode
}

function buildAuthPath(mode: AuthMode, redirectTo: string | null) {
	const path = mode === 'signup' ? '/signup' : '/login'
	if (!redirectTo) return path
	const params = new URLSearchParams({ redirectTo })
	return `${path}?${params.toString()}`
}

function LoginForm(handle: Handle, setup: LoginFormSetup = {}) {
	let mode: AuthMode = setup.initialMode ?? 'login'
	let status: AuthStatus = 'idle'
	let message: string | null = null
	let sessionStatus: SessionStatus = 'idle'
	let sessionEmail = ''
	const redirectTo = normalizeRedirectTo(getSearchParams().get('redirectTo'))
	const redirectTarget = redirectTo ?? '/account'

	function setState(nextStatus: AuthStatus, nextMessage: string | null = null) {
		status = nextStatus
		message = nextMessage
		handle.update()
	}

	function switchMode(nextMode: AuthMode) {
		if (mode === nextMode) return
		mode = nextMode
		status = 'idle'
		message = null
		navigate(buildAuthPath(nextMode, redirectTo))
		handle.update()
	}

	handle.queueTask(async (signal) => {
		if (sessionStatus !== 'idle') return
		sessionStatus = 'loading'

		const session = await fetchSessionInfo(signal)
		if (signal.aborted) return
		sessionEmail = session?.email ?? ''

		sessionStatus = 'ready'
		if (sessionEmail && typeof window !== 'undefined') {
			window.location.assign(redirectTarget)
			return
		}
		handle.update()
	})

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		if (!(event.currentTarget instanceof HTMLFormElement)) return

		const formData = new FormData(event.currentTarget)
		const email = String(formData.get('email') ?? '').trim()
		const password = String(formData.get('password') ?? '')

		if (!email || !password) {
			setState('error', 'Email and password are required.')
			return
		}

		setState('submitting')

		try {
			const response = await fetch('/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email, password, mode }),
			})
			const payload = await response.json().catch(() => null)

			if (!response.ok) {
				const errorMessage =
					typeof payload?.error === 'string'
						? payload.error
						: 'Unable to authenticate.'
				setState('error', errorMessage)
				return
			}

			if (typeof window !== 'undefined') {
				window.location.assign(redirectTarget)
			}
		} catch {
			setState('error', 'Network error. Please try again.')
		}
	}

	return () => {
		const isSignup = mode === 'signup'
		const isSubmitting = status === 'submitting'
		const title = isSignup ? 'Create your account' : 'Welcome back'
		const description = isSignup
			? 'Sign up to start using epicflare.'
			: 'Log in to continue to epicflare.'
		const submitLabel = isSignup ? 'Create account' : 'Sign in'
		const toggleLabel = isSignup
			? 'Already have an account?'
			: 'Need an account?'
		const toggleAction = isSignup ? 'Sign in instead' : 'Sign up instead'

		return (
			<section
				css={{
					maxWidth: '28rem',
					margin: '0 auto',
					display: 'grid',
					gap: spacing.lg,
				}}
			>
				<header css={{ display: 'grid', gap: spacing.xs }}>
					<h2
						css={{
							fontSize: typography.fontSize.xl,
							fontWeight: typography.fontWeight.semibold,
							color: colors.text,
						}}
					>
						{title}
					</h2>
					<p css={{ color: colors.textMuted }}>{description}</p>
				</header>
				<form
					css={{
						display: 'grid',
						gap: spacing.md,
						padding: spacing.lg,
						borderRadius: radius.lg,
						border: `1px solid ${colors.border}`,
						backgroundColor: colors.surface,
						boxShadow: shadows.sm,
					}}
					on={{ submit: handleSubmit }}
				>
					<label css={{ display: 'grid', gap: spacing.xs }}>
						<span
							css={{
								color: colors.text,
								fontWeight: typography.fontWeight.medium,
								fontSize: typography.fontSize.sm,
							}}
						>
							Email
						</span>
						<input
							type="email"
							name="email"
							required
							autoFocus
							autoComplete="email"
							placeholder="you@example.com"
							css={{
								padding: spacing.sm,
								borderRadius: radius.md,
								border: `1px solid ${colors.border}`,
								fontSize: typography.fontSize.base,
								fontFamily: typography.fontFamily,
							}}
						/>
					</label>
					<label css={{ display: 'grid', gap: spacing.xs }}>
						<span
							css={{
								color: colors.text,
								fontWeight: typography.fontWeight.medium,
								fontSize: typography.fontSize.sm,
							}}
						>
							Password
						</span>
						<input
							type="password"
							name="password"
							required
							autoComplete={isSignup ? 'new-password' : 'current-password'}
							placeholder="At least 8 characters"
							css={{
								padding: spacing.sm,
								borderRadius: radius.md,
								border: `1px solid ${colors.border}`,
								fontSize: typography.fontSize.base,
								fontFamily: typography.fontFamily,
							}}
						/>
					</label>
					<button
						type="submit"
						disabled={isSubmitting}
						css={{
							padding: `${spacing.sm} ${spacing.lg}`,
							borderRadius: radius.full,
							border: 'none',
							backgroundColor: colors.primary,
							color: colors.onPrimary,
							fontSize: typography.fontSize.base,
							fontWeight: typography.fontWeight.semibold,
							cursor: isSubmitting ? 'not-allowed' : 'pointer',
							opacity: isSubmitting ? 0.7 : 1,
							transition: `transform ${transitions.fast}, background-color ${transitions.normal}`,
							'&:hover': isSubmitting
								? undefined
								: {
										backgroundColor: colors.primaryHover,
										transform: 'translateY(-1px)',
									},
							'&:active': isSubmitting
								? undefined
								: {
										backgroundColor: colors.primaryActive,
										transform: 'translateY(0)',
									},
						}}
					>
						{isSubmitting ? 'Submitting...' : submitLabel}
					</button>
					{message ? (
						<p
							css={{
								color: status === 'error' ? colors.error : colors.text,
								fontSize: typography.fontSize.sm,
							}}
							aria-live="polite"
						>
							{message}
						</p>
					) : null}
				</form>
				<div css={{ display: 'grid', gap: spacing.sm }}>
					<a
						href={buildAuthPath(isSignup ? 'login' : 'signup', redirectTo)}
						aria-pressed={isSignup}
						on={{
							click: (event) => {
								if (event.defaultPrevented) return
								switchMode(isSignup ? 'login' : 'signup')
							},
						}}
						css={{
							background: 'none',
							border: 'none',
							padding: 0,
							color: colors.primaryText,
							fontSize: typography.fontSize.sm,
							cursor: 'pointer',
							textAlign: 'left',
							textDecoration: 'none',
							'&:hover': {
								textDecoration: 'underline',
							},
						}}
					>
						{toggleLabel} {toggleAction}
					</a>
					<a
						href="/"
						css={{
							color: colors.textMuted,
							fontSize: typography.fontSize.sm,
							textDecoration: 'none',
							'&:hover': {
								textDecoration: 'underline',
							},
						}}
					>
						Back home
					</a>
				</div>
			</section>
		)
	}
}

export function LoginRoute(initialMode: AuthMode = 'login') {
	return (_match: { path: string; params: Record<string, string> }) => (
		<LoginForm setup={{ initialMode }} />
	)
}

function AccountPage(handle: Handle) {
	let status: AccountStatus = 'loading'
	let email = ''
	let message: string | null = null

	async function loadAccount(signal: AbortSignal) {
		try {
			const response = await fetch('/session', {
				headers: { Accept: 'application/json' },
				credentials: 'include',
				signal,
			})
			if (signal.aborted) return
			const payload = await response.json().catch(() => null)
			const sessionEmail =
				response.ok &&
				payload?.ok &&
				typeof payload?.session?.email === 'string'
					? payload.session.email.trim()
					: ''
			if (!sessionEmail) {
				window.location.assign('/login')
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
		}
	}

	return () => {
		if (status === 'loading') {
			handle.queueTask(loadAccount)
		}

		return (
			<section
				css={{
					maxWidth: '28rem',
					margin: '0 auto',
					display: 'grid',
					gap: spacing.lg,
				}}
			>
				<header css={{ display: 'grid', gap: spacing.xs }}>
					<h1
						css={{
							fontSize: typography.fontSize.xl,
							fontWeight: typography.fontWeight.semibold,
							color: colors.text,
							margin: 0,
						}}
					>
						{email ? `Welcome, ${email}` : 'Welcome'}
					</h1>
					<p css={{ color: colors.textMuted }}>
						You are signed in to epicflare.
					</p>
				</header>
				{status === 'loading' ? (
					<p css={{ color: colors.textMuted }}>Loading your account…</p>
				) : null}
				{message ? (
					<p css={{ color: colors.error }} role="alert">
						{message}
					</p>
				) : null}
			</section>
		)
	}
}

export function AccountRoute() {
	return (_match: { path: string; params: Record<string, string> }) => (
		<AccountPage />
	)
}

type OAuthAuthorizeInfo = {
	client: { id: string; name: string }
	scopes: Array<string>
}

type OAuthAuthorizeStatus = 'idle' | 'loading' | 'ready' | 'error'
type OAuthAuthorizeMessage = { type: 'error' | 'info'; text: string }

function OAuthAuthorizeForm(handle: Handle) {
	let info: OAuthAuthorizeInfo | null = null
	let status: OAuthAuthorizeStatus = 'idle'
	let message: OAuthAuthorizeMessage | null = null
	let submitting = false
	let lastSearch = ''
	let session: SessionInfo | null = null
	let sessionStatus: SessionStatus = 'idle'

	function setMessage(next: OAuthAuthorizeMessage | null) {
		message = next
		handle.update()
	}

	function readQueryError() {
		const params = getSearchParams()
		const description = params.get('error_description')
		if (description) return description
		const error = params.get('error')
		return error ? `Authorization error: ${error}` : null
	}

	async function loadInfo() {
		status = 'loading'

		const queryError = readQueryError()
		if (queryError) {
			message = { type: 'error', text: queryError }
		}

		try {
			const query = typeof window === 'undefined' ? '' : window.location.search
			const response = await fetch(`/oauth/authorize-info${query}`, {
				headers: { Accept: 'application/json' },
				credentials: 'include',
			})
			const payload = await response.json().catch(() => null)
			if (!response.ok || !payload?.ok) {
				const errorText =
					typeof payload?.error === 'string'
						? payload.error
						: 'Unable to load authorization details.'
				info = null
				status = 'error'
				message = { type: 'error', text: errorText }
				handle.update()
				return
			}
			info = {
				client: payload.client,
				scopes: payload.scopes,
			}
			status = 'ready'
			if (!queryError) {
				message = null
			}
			handle.update()
		} catch {
			info = null
			status = 'error'
			message = {
				type: 'error',
				text: 'Unable to load authorization details.',
			}
			handle.update()
		}
	}

	async function loadSession() {
		if (sessionStatus !== 'idle') return
		sessionStatus = 'loading'

		session = await fetchSessionInfo()

		sessionStatus = 'ready'
		handle.update()
	}

	async function submitDecision(
		decision: 'approve' | 'deny',
		form?: HTMLFormElement,
	) {
		if (submitting) return
		submitting = true
		handle.update()

		try {
			const body = new URLSearchParams()
			body.set('decision', decision)
			if (decision === 'approve' && form) {
				const formData = new FormData(form)
				const email = String(formData.get('email') ?? '').trim()
				const password = String(formData.get('password') ?? '')
				if (!email || !password) {
					setMessage({
						type: 'error',
						text: 'Email and password are required.',
					})
					submitting = false
					handle.update()
					return
				}
				body.set('email', email)
				body.set('password', password)
			}
			const response = await fetch(window.location.href, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				credentials: 'include',
				body,
			})
			const payload = await response.json().catch(() => null)
			if (!response.ok) {
				const errorText =
					typeof payload?.error === 'string'
						? payload.error
						: 'Unable to complete authorization.'
				setMessage({ type: 'error', text: errorText })
				submitting = false
				handle.update()
				return
			}
			if (payload?.redirectTo) {
				window.location.assign(payload.redirectTo)
				return
			}
			setMessage({ type: 'error', text: 'Missing redirect response.' })
		} catch {
			setMessage({
				type: 'error',
				text: 'Network error. Please try again.',
			})
		} finally {
			submitting = false
			handle.update()
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		if (!(event.currentTarget instanceof HTMLFormElement)) return
		const hasSession = Boolean(session?.email)
		await submitDecision(
			'approve',
			hasSession ? undefined : event.currentTarget,
		)
	}

	return () => {
		const currentSearch =
			typeof window === 'undefined' ? '' : window.location.search
		if (currentSearch !== lastSearch) {
			lastSearch = currentSearch
			void loadInfo()
		}
		if (sessionStatus === 'idle') {
			void loadSession()
		}

		const clientLabel = info?.client?.name ?? 'Unknown client'
		const scopes = info?.scopes ?? []
		const scopeLabel =
			scopes.length > 0 ? scopes.join(', ') : 'No scopes requested.'
		const sessionEmail = session?.email ?? ''
		const isSessionReady = sessionStatus === 'ready'
		const isSessionLoading =
			sessionStatus === 'loading' || sessionStatus === 'idle'
		const isLoggedIn = isSessionReady && Boolean(sessionEmail)
		const actionsDisabled = status !== 'ready' || submitting || isSessionLoading
		const formReady = status === 'ready' && !isSessionLoading
		const authorizeLabel = submitting
			? 'Submitting...'
			: isLoggedIn
				? 'Approve connection'
				: 'Authorize'

		return (
			<section
				css={{
					maxWidth: '28rem',
					margin: '0 auto',
					display: 'grid',
					gap: spacing.lg,
				}}
			>
				<header css={{ display: 'grid', gap: spacing.xs }}>
					<h2
						css={{
							fontSize: typography.fontSize.xl,
							fontWeight: typography.fontWeight.semibold,
							color: colors.text,
						}}
					>
						Authorize access
					</h2>
					<p css={{ color: colors.textMuted }}>
						{clientLabel} wants to access your epicflare account.
					</p>
				</header>
				<section
					css={{
						padding: spacing.lg,
						borderRadius: radius.lg,
						border: `1px solid ${colors.border}`,
						backgroundColor: colors.surface,
						boxShadow: shadows.sm,
						display: 'grid',
						gap: spacing.sm,
					}}
				>
					<p
						css={{
							margin: 0,
							fontWeight: typography.fontWeight.medium,
							color: colors.text,
						}}
					>
						Requested scopes
					</p>
					<p css={{ margin: 0, color: colors.textMuted }}>{scopeLabel}</p>
				</section>
				{isSessionLoading ? (
					<p css={{ color: colors.textMuted }}>Checking your session…</p>
				) : null}
				{isLoggedIn ? (
					<section
						css={{
							padding: spacing.md,
							borderRadius: radius.md,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.surface,
							display: 'grid',
							gap: spacing.xs,
						}}
					>
						<p
							css={{
								margin: 0,
								fontWeight: typography.fontWeight.medium,
								color: colors.text,
							}}
						>
							Signed in as {sessionEmail}
						</p>
						<p css={{ margin: 0, color: colors.textMuted }}>
							Approve to continue with this account.
						</p>
					</section>
				) : null}
				{status === 'loading' ? (
					<p css={{ color: colors.textMuted }}>
						Loading authorization details…
					</p>
				) : null}
				{message ? (
					<p
						css={{
							color: message.type === 'error' ? colors.error : colors.text,
							fontSize: typography.fontSize.sm,
						}}
						role={message.type === 'error' ? 'alert' : undefined}
					>
						{message.text}
					</p>
				) : null}
				<form
					css={{
						display: 'grid',
						gap: spacing.md,
						padding: spacing.lg,
						borderRadius: radius.lg,
						border: `1px solid ${colors.border}`,
						backgroundColor: colors.surface,
						boxShadow: shadows.sm,
						opacity: formReady ? 1 : 0.7,
					}}
					on={{ submit: handleSubmit }}
				>
					{!isLoggedIn && isSessionReady ? (
						<>
							<label css={{ display: 'grid', gap: spacing.xs }}>
								<span
									css={{
										color: colors.text,
										fontWeight: typography.fontWeight.medium,
										fontSize: typography.fontSize.sm,
									}}
								>
									Email
								</span>
								<input
									type="email"
									name="email"
									required
									autoComplete="email"
									placeholder="you@example.com"
									disabled={actionsDisabled}
									css={{
										padding: spacing.sm,
										borderRadius: radius.md,
										border: `1px solid ${colors.border}`,
										fontSize: typography.fontSize.base,
										fontFamily: typography.fontFamily,
									}}
								/>
							</label>
							<label css={{ display: 'grid', gap: spacing.xs }}>
								<span
									css={{
										color: colors.text,
										fontWeight: typography.fontWeight.medium,
										fontSize: typography.fontSize.sm,
									}}
								>
									Password
								</span>
								<input
									type="password"
									name="password"
									required
									autoComplete="current-password"
									placeholder="Enter your password"
									disabled={actionsDisabled}
									css={{
										padding: spacing.sm,
										borderRadius: radius.md,
										border: `1px solid ${colors.border}`,
										fontSize: typography.fontSize.base,
										fontFamily: typography.fontFamily,
									}}
								/>
							</label>
						</>
					) : null}
					<div css={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
						<button
							type="submit"
							disabled={actionsDisabled}
							css={{
								padding: `${spacing.sm} ${spacing.lg}`,
								borderRadius: radius.full,
								border: 'none',
								backgroundColor: colors.primary,
								color: colors.onPrimary,
								fontSize: typography.fontSize.base,
								fontWeight: typography.fontWeight.semibold,
								cursor: actionsDisabled ? 'not-allowed' : 'pointer',
								opacity: actionsDisabled ? 0.7 : 1,
							}}
						>
							{authorizeLabel}
						</button>
						<button
							type="button"
							disabled={actionsDisabled}
							on={{ click: () => submitDecision('deny') }}
							css={{
								padding: `${spacing.sm} ${spacing.lg}`,
								borderRadius: radius.full,
								border: `1px solid ${colors.border}`,
								backgroundColor: 'transparent',
								color: colors.text,
								fontSize: typography.fontSize.base,
								fontWeight: typography.fontWeight.medium,
								cursor: actionsDisabled ? 'not-allowed' : 'pointer',
								opacity: actionsDisabled ? 0.7 : 1,
							}}
						>
							Deny
						</button>
					</div>
				</form>
				<a
					href="/"
					css={{
						color: colors.textMuted,
						fontSize: typography.fontSize.sm,
						textDecoration: 'none',
						'&:hover': {
							textDecoration: 'underline',
						},
					}}
				>
					Back home
				</a>
			</section>
		)
	}
}

export function OAuthAuthorizeRoute() {
	return (_match: { path: string; params: Record<string, string> }) => (
		<OAuthAuthorizeForm />
	)
}

export function OAuthCallbackRoute() {
	return (_match: { path: string; params: Record<string, string> }) => {
		const params =
			typeof window === 'undefined'
				? new URLSearchParams()
				: new URLSearchParams(window.location.search)
		const error = params.get('error')
		const description = params.get('error_description')
		const code = params.get('code')
		const state = params.get('state')
		const isError = Boolean(error || description)
		const title = isError ? 'Authorization failed' : 'Authorization completed'
		const message = description || error
		const detail = isError ? message : code

		return (
			<section
				css={{
					maxWidth: '32rem',
					margin: '0 auto',
					display: 'grid',
					gap: spacing.lg,
				}}
			>
				<header css={{ display: 'grid', gap: spacing.xs }}>
					<h2
						css={{
							fontSize: typography.fontSize.xl,
							fontWeight: typography.fontWeight.semibold,
							color: colors.text,
						}}
					>
						OAuth callback
					</h2>
					<p css={{ color: colors.textMuted }}>{title}.</p>
				</header>
				{detail ? (
					<pre
						css={{
							margin: 0,
							padding: spacing.md,
							borderRadius: radius.md,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.surface,
							whiteSpace: 'pre-wrap',
						}}
					>
						{detail}
					</pre>
				) : null}
				{state ? (
					<p css={{ color: colors.textMuted, margin: 0 }}>State: {state}</p>
				) : null}
				<a
					href="/"
					css={{
						color: colors.textMuted,
						fontSize: typography.fontSize.sm,
						textDecoration: 'none',
						'&:hover': {
							textDecoration: 'underline',
						},
					}}
				>
					Back home
				</a>
			</section>
		)
	}
}
