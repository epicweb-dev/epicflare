import { type Handle } from 'remix/component'
import {
	HomeRoute,
	LoginRoute,
	OAuthAuthorizeRoute,
	OAuthCallbackRoute,
} from './client-routes.tsx'
import { Router } from './client-router.tsx'
import { colors, spacing, typography } from './styles/tokens.ts'

type SessionInfo = {
	email: string
}

type SessionStatus = 'idle' | 'loading' | 'ready'

type NavLink = {
	href: string
	label: string
}

export function App(handle: Handle) {
	let session: SessionInfo | null = null
	let sessionStatus: SessionStatus = 'idle'

	async function loadSession() {
		if (sessionStatus !== 'idle') return
		sessionStatus = 'loading'

		try {
			const response = await fetch('/session', {
				headers: { Accept: 'application/json' },
				credentials: 'include',
			})
			const payload = await response.json().catch(() => null)
			const email =
				response.ok &&
				payload?.ok &&
				typeof payload?.session?.email === 'string'
					? payload.session.email.trim()
					: ''
			session = email ? { email } : null
		} catch {
			session = null
		}

		sessionStatus = 'ready'
		handle.update()
	}

	return () => {
		if (sessionStatus === 'idle') {
			void loadSession()
		}

		const authLinks: Array<NavLink> = []
		if (sessionStatus === 'ready') {
			if (session) {
				authLinks.push({ href: '/account', label: session.email })
			} else {
				authLinks.push(
					{ href: '/login', label: 'Login' },
					{ href: '/signup', label: 'Signup' },
				)
			}
		}

		return (
			<main
				css={{
					maxWidth: '52rem',
					margin: '0 auto',
					padding: spacing['2xl'],
					fontFamily: typography.fontFamily,
				}}
			>
				<nav
					css={{
						display: 'flex',
						gap: spacing.md,
						flexWrap: 'wrap',
						marginBottom: spacing.xl,
					}}
				>
					<a
						href="/"
						css={{
							color: colors.primary,
							fontWeight: typography.fontWeight.medium,
							textDecoration: 'none',
							'&:hover': {
								textDecoration: 'underline',
							},
						}}
					>
						Home
					</a>
					{authLinks.map((link) => (
						<a
							key={link.href}
							href={link.href}
							css={{
								color: colors.primary,
								fontWeight: typography.fontWeight.medium,
								textDecoration: 'none',
								'&:hover': {
									textDecoration: 'underline',
								},
							}}
						>
							{link.label}
						</a>
					))}
				</nav>
				<Router
					setup={{
						routes: {
							'/': HomeRoute(),
							'/login': LoginRoute('login'),
							'/signup': LoginRoute('signup'),
							'/oauth/authorize': OAuthAuthorizeRoute(),
							'/oauth/callback': OAuthCallbackRoute(),
						},
						fallback: () => (
							<section>
								<h2
									css={{
										fontSize: typography.fontSize.lg,
										fontWeight: typography.fontWeight.semibold,
										marginBottom: spacing.sm,
										color: colors.text,
									}}
								>
									Not Found
								</h2>
								<p css={{ color: colors.textMuted }}>
									That route does not exist.
								</p>
							</section>
						),
					}}
				/>
			</main>
		)
	}
}
