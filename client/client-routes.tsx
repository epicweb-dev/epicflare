import { type Handle } from 'remix/component'
import { navigate } from './client-router.tsx'
import { Counter } from './counter.tsx'
import {
	colors,
	radius,
	shadows,
	spacing,
	transitions,
	typography,
} from './styles/tokens.ts'

export function HomeRoute() {
	return (_match: { path: string; params: Record<string, string> }) => (
		<section>
			<h1
				css={{
					fontSize: typography.fontSize.xl,
					fontWeight: typography.fontWeight.semibold,
					marginBottom: spacing.md,
					color: colors.text,
				}}
			>
				Epicflare Remix 3
			</h1>
			<p
				css={{
					marginBottom: spacing.lg,
					color: colors.textMuted,
				}}
			>
				Remix 3 components running on the client, backed by Remix 3 routing in
				the worker.
			</p>
			<Counter setup={{ initial: 1 }} />
		</section>
	)
}

export function ClientRoute() {
	return (match: { path: string; params: Record<string, string> }) => (
		<section>
			<h2
				css={{
					fontSize: typography.fontSize.lg,
					fontWeight: typography.fontWeight.semibold,
					marginBottom: spacing.sm,
					color: colors.text,
				}}
			>
				Client-side Route
			</h2>
			<p
				css={{
					marginBottom: spacing.md,
					color: colors.textMuted,
				}}
			>
				This page is rendered by the client-side router without a server
				roundtrip.
			</p>
			<p
				css={{
					color: colors.text,
					fontSize: typography.fontSize.sm,
				}}
			>
				Current path: {match.path}
			</p>
		</section>
	)
}

export function ClientParamRoute() {
	return (match: { path: string; params: Record<string, string> }) => (
		<section>
			<h2
				css={{
					fontSize: typography.fontSize.lg,
					fontWeight: typography.fontWeight.semibold,
					marginBottom: spacing.sm,
					color: colors.text,
				}}
			>
				Client Param Route
			</h2>
			<p
				css={{
					marginBottom: spacing.md,
					color: colors.textMuted,
				}}
			>
				This route proves `:id` params are working.
			</p>
			<p css={{ color: colors.text }}>
				ID param: <strong>{match.params.id ?? 'missing'}</strong>
			</p>
			<p
				css={{
					color: colors.text,
					fontSize: typography.fontSize.sm,
				}}
			>
				Current path: {match.path}
			</p>
		</section>
	)
}

type AuthMode = 'login' | 'signup'
type AuthStatus = 'idle' | 'submitting' | 'success' | 'error'

type LoginFormSetup = {
	initialMode?: AuthMode
}

function LoginForm(handle: Handle, setup: LoginFormSetup = {}) {
	let mode: AuthMode = setup.initialMode ?? 'login'
	let status: AuthStatus = 'idle'
	let message: string | null = null

	const setState = (
		nextStatus: AuthStatus,
		nextMessage: string | null = null,
	) => {
		status = nextStatus
		message = nextMessage
		handle.update()
	}

	const switchMode = (nextMode: AuthMode) => {
		if (mode === nextMode) return
		mode = nextMode
		status = 'idle'
		message = null
		navigate(nextMode === 'signup' ? '/signup' : '/login')
		handle.update()
	}

	const handleSubmit = async (event: SubmitEvent) => {
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
				window.location.assign('/account')
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
			? 'Sign up to start using Epicflare.'
			: 'Log in to continue to Epicflare.'
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
						href={isSignup ? '/login' : '/signup'}
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
							color: colors.primary,
							fontSize: typography.fontSize.sm,
							cursor: 'pointer',
							textAlign: 'left',
							textDecoration: 'none',
							'&:hover': {
								textDecoration: 'underline',
							},
						}}
						aria-pressed={isSignup}
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
