import { type Handle } from 'remix/component'
import {
	AccountRoute,
	ChatRoute,
	HomeRoute,
	LoginRoute,
	OAuthAuthorizeRoute,
	OAuthCallbackRoute,
	ResetPasswordRoute,
} from './client-routes.tsx'
import { listenToRouterNavigation, Router } from './client-router.tsx'
import {
	fetchSessionInfo,
	type SessionInfo,
	type SessionStatus,
} from './session.ts'
import { colors, spacing, typography } from './styles/tokens.ts'

export function App(handle: Handle) {
	let session: SessionInfo | null = null
	let sessionStatus: SessionStatus = 'idle'
	let sessionRefreshInFlight = false
	let sessionRefreshQueued = false

	function queueSessionRefresh() {
		sessionRefreshQueued = true
		if (sessionRefreshInFlight) return

		// Preserve current nav state during refreshes after first load.
		if (sessionStatus === 'idle') {
			sessionStatus = 'loading'
			handle.update()
		}

		sessionRefreshQueued = false
		sessionRefreshInFlight = true
		handle.queueTask(async (signal) => {
			session = await fetchSessionInfo(signal)
			sessionRefreshInFlight = false
			if (signal.aborted) return
			sessionStatus = 'ready'
			handle.update()
			if (sessionRefreshQueued) {
				queueSessionRefresh()
			}
		})
		if (sessionStatus !== 'loading') {
			handle.update()
		}
	}

	queueSessionRefresh()
	listenToRouterNavigation(handle, queueSessionRefresh)

	const navLinkCss = {
		color: colors.primaryText,
		fontWeight: typography.fontWeight.medium,
		textDecoration: 'none',
		'&:hover': {
			textDecoration: 'underline',
		},
	}

	const logOutButtonCss = {
		padding: `${spacing.xs} ${spacing.md}`,
		borderRadius: '999px',
		border: `1px solid ${colors.border}`,
		backgroundColor: 'transparent',
		color: colors.text,
		fontWeight: typography.fontWeight.medium,
		cursor: 'pointer',
	}

	return () => {
		const sessionEmail = session?.email ?? ''
		const isSessionReady = sessionStatus === 'ready'
		const isLoggedIn = isSessionReady && Boolean(sessionEmail)
		const showAuthLinks = isSessionReady && !isLoggedIn

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
					<a href="/" css={navLinkCss}>
						Home
					</a>
					{showAuthLinks ? (
						<>
							<a href="/login" css={navLinkCss}>
								Login
							</a>
							<a href="/signup" css={navLinkCss}>
								Signup
							</a>
						</>
					) : null}
					{isLoggedIn ? (
						<>
							<a href="/chat" css={navLinkCss}>
								Chat
							</a>
							<a href="/account" css={navLinkCss}>
								{sessionEmail}
							</a>
							<form method="post" action="/logout" css={{ margin: 0 }}>
								<button type="submit" css={logOutButtonCss}>
									Log out
								</button>
							</form>
						</>
					) : null}
				</nav>
				<Router
					setup={{
						routes: {
							'/': HomeRoute(),
							'/chat': ChatRoute(),
							'/account': AccountRoute(),
							'/login': LoginRoute('login'),
							'/signup': LoginRoute('signup'),
							'/reset-password': ResetPasswordRoute(),
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
