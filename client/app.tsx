import { ClientParamRoute, ClientRoute, HomeRoute } from './client-routes.tsx'
import { Router } from './client-router.tsx'
import { colors, spacing, typography } from './styles/tokens.ts'

export function App() {
	return () => (
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
				<a
					href="/client-route"
					css={{
						color: colors.primary,
						fontWeight: typography.fontWeight.medium,
						textDecoration: 'none',
						'&:hover': {
							textDecoration: 'underline',
						},
					}}
				>
					Client Route
				</a>
				<a
					href="/client/42"
					css={{
						color: colors.primary,
						fontWeight: typography.fontWeight.medium,
						textDecoration: 'none',
						'&:hover': {
							textDecoration: 'underline',
						},
					}}
				>
					Client Param
				</a>
			</nav>
			<Router
				setup={{
					routes: {
						'/': HomeRoute(),
						'/client-route': ClientRoute(),
						'/client/:id': ClientParamRoute(),
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
