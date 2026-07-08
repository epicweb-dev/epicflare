import { css, on, type Handle } from 'remix/ui'
import { buildAuthLink } from '#client/auth-links.ts'
import {
	getPathname,
	listenToRouterNavigation,
} from '#client/client-router.tsx'
import { readRouterSearch } from '#client/router-location.tsx'
import { routes } from '#server/routes.ts'
import { fetchSessionInfo, type SessionStatus } from '#client/session.ts'
import {
	colors,
	radius,
	shadows,
	spacing,
	transitions,
	typography,
} from '#client/styles/tokens.ts'
type AuthMode = 'login' | 'signup'
type AuthStatus = 'idle' | 'submitting' | 'success' | 'error'
type AuthPayload = {
	error?: unknown
}
function getSearchParams(handle: Handle) {
	if (typeof window !== 'undefined') {
		return new URLSearchParams(window.location.search)
	}

	try {
		return new URLSearchParams(readRouterSearch(handle))
	} catch {
		return new URLSearchParams()
	}
}
function normalizeRedirectTo(value: string | null) {
	if (!value) return null
	if (!value.startsWith('/')) return null
	if (value.startsWith('//')) return null
	return value
}
function buildAuthPath(mode: AuthMode, redirectTo: string | null) {
	const path = mode === 'signup' ? routes.signup.href() : routes.login.href()
	return buildAuthLink(path, redirectTo)
}
function getAuthModeFromPathname(pathname: string): AuthMode {
	return pathname === routes.signup.href() ? 'signup' : 'login'
}
function getCurrentAuthMode(handle: Handle) {
	return getAuthModeFromPathname(getPathname(handle))
}
function getCurrentRedirectTo(handle: Handle) {
	return normalizeRedirectTo(getSearchParams(handle).get('redirectTo'))
}
export function LoginRoute(handle: Handle) {
	let status: AuthStatus = 'idle'
	let message: string | null = null
	let sessionStatus: SessionStatus = 'idle'
	let sessionEmail = ''
	let activeMode = getCurrentAuthMode(handle)
	let routePath: string | null = null
	function setState(nextStatus: AuthStatus, nextMessage: string | null = null) {
		status = nextStatus
		message = nextMessage
		handle.update()
	}
	function resetAuthState() {
		status = 'idle'
		message = null
	}
	listenToRouterNavigation(handle, () => {
		if (!routePath) return
		if (getPathname(handle) !== routePath) {
			resetAuthState()
		}
	})
	if (typeof window !== 'undefined') {
		handle.queueTask(async (signal) => {
			if (sessionStatus !== 'idle') return
			sessionStatus = 'loading'
			const session = await fetchSessionInfo(signal)
			if (signal.aborted) return
			sessionEmail = session?.email ?? ''
			sessionStatus = 'ready'
			if (sessionEmail) {
				window.location.assign(
					getCurrentRedirectTo(handle) ?? routes.account.href(),
				)
				return
			}
			handle.update()
		})
	}
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		if (!(event.currentTarget instanceof HTMLFormElement)) return
		const formData = new FormData(event.currentTarget)
		const email = String(formData.get('email') ?? '').trim()
		const password = String(formData.get('password') ?? '')
		const mode = getCurrentAuthMode(handle)
		const rememberMe = mode === 'login' && formData.get('rememberMe') === 'on'
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
				body: JSON.stringify({ email, password, mode, rememberMe }),
			})
			const payload = (await response
				.json()
				.catch(() => null)) as AuthPayload | null
			if (!response.ok) {
				const errorMessage =
					typeof payload?.error === 'string'
						? payload.error
						: 'Unable to authenticate.'
				setState('error', errorMessage)
				return
			}
			if (typeof window !== 'undefined') {
				window.location.assign(
					getCurrentRedirectTo(handle) ?? routes.account.href(),
				)
			}
		} catch {
			setState('error', 'Network error. Please try again.')
		}
	}
	return () => {
		const mode = getCurrentAuthMode(handle)
		if (!routePath) {
			routePath = getPathname(handle)
		}
		if (mode !== activeMode) {
			activeMode = mode
			resetAuthState()
		}
		const redirectTo = getCurrentRedirectTo(handle)
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
					<h2
						mix={[
							css({
								fontSize: typography.fontSize.xl,
								fontWeight: typography.fontWeight.semibold,
								color: colors.text,
							}),
						]}
					>
						{title}
					</h2>
					<p mix={[css({ color: colors.textMuted })]}>{description}</p>
				</header>
				<form
					mix={[
						css({
							display: 'grid',
							gap: spacing.md,
							padding: spacing.lg,
							borderRadius: radius.lg,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.surface,
							boxShadow: shadows.sm,
						}),
						on<HTMLFormElement, 'submit'>('submit', handleSubmit),
					]}
				>
					<label mix={[css({ display: 'grid', gap: spacing.xs })]}>
						<span
							mix={[
								css({
									color: colors.text,
									fontWeight: typography.fontWeight.medium,
									fontSize: typography.fontSize.sm,
								}),
							]}
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
							mix={[
								css({
									padding: spacing.sm,
									borderRadius: radius.md,
									border: `1px solid ${colors.border}`,
									fontSize: typography.fontSize.base,
									fontFamily: typography.fontFamily,
								}),
							]}
						/>
					</label>
					<label mix={[css({ display: 'grid', gap: spacing.xs })]}>
						<span
							mix={[
								css({
									color: colors.text,
									fontWeight: typography.fontWeight.medium,
									fontSize: typography.fontSize.sm,
								}),
							]}
						>
							Password
						</span>
						<input
							type="password"
							name="password"
							required
							autoComplete={isSignup ? 'new-password' : 'current-password'}
							placeholder="At least 8 characters"
							mix={[
								css({
									padding: spacing.sm,
									borderRadius: radius.md,
									border: `1px solid ${colors.border}`,
									fontSize: typography.fontSize.base,
									fontFamily: typography.fontFamily,
								}),
							]}
						/>
					</label>
					{!isSignup ? (
						<label
							mix={[
								css({
									display: 'flex',
									gap: spacing.sm,
									alignItems: 'flex-start',
									color: colors.text,
								}),
							]}
						>
							<input
								type="checkbox"
								name="rememberMe"
								mix={[
									css({
										marginTop: '0.15rem',
									}),
								]}
							/>
							<span mix={[css({ display: 'grid', gap: spacing.xs })]}>
								<span
									mix={[
										css({
											fontWeight: typography.fontWeight.medium,
											fontSize: typography.fontSize.sm,
										}),
									]}
								>
									Remember me
								</span>
								<span
									mix={[
										css({
											color: colors.textMuted,
											fontSize: typography.fontSize.sm,
										}),
									]}
								>
									Stay signed in for 30 days. Active sessions renew after 14
									days.
								</span>
							</span>
						</label>
					) : null}
					<button
						type="submit"
						disabled={isSubmitting}
						mix={[
							css({
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
							}),
						]}
					>
						{isSubmitting ? 'Submitting...' : submitLabel}
					</button>
					{message ? (
						<p
							aria-live="polite"
							mix={[
								css({
									color: status === 'error' ? colors.error : colors.text,
									fontSize: typography.fontSize.sm,
								}),
							]}
						>
							{message}
						</p>
					) : null}
				</form>
				<div mix={[css({ display: 'grid', gap: spacing.sm })]}>
					<a
						href={buildAuthPath(isSignup ? 'login' : 'signup', redirectTo)}
						aria-pressed={isSignup}
						mix={[
							css({
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
							}),
						]}
					>
						{toggleLabel} {toggleAction}
					</a>
					{!isSignup ? (
						<a
							href={routes.resetPassword.href()}
							mix={[
								css({
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
								}),
							]}
						>
							Forgot password?
						</a>
					) : null}
					<a
						href={routes.home.href()}
						mix={[
							css({
								color: colors.textMuted,
								fontSize: typography.fontSize.sm,
								textDecoration: 'none',
								'&:hover': {
									textDecoration: 'underline',
								},
							}),
						]}
					>
						Back home
					</a>
				</div>
			</section>
		)
	}
}
