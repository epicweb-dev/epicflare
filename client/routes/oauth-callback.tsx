import { colors, radius, spacing, typography } from '#client/styles/tokens.ts'
import { css, type Handle } from 'remix/ui'
import { readRouterSearch } from '#client/router-location.tsx'
import { routes } from '#server/routes.ts'

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

export function OAuthCallbackRoute(handle: Handle) {
	return () => {
		const params = getSearchParams(handle)
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
				mix={[
					css({
						maxWidth: '32rem',
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
						OAuth callback
					</h2>
					<p mix={[css({ color: colors.textMuted })]}>{title}.</p>
				</header>
				{detail ? (
					<pre
						mix={[
							css({
								margin: 0,
								padding: spacing.md,
								borderRadius: radius.md,
								border: `1px solid ${colors.border}`,
								backgroundColor: colors.surface,
								whiteSpace: 'pre-wrap',
							}),
						]}
					>
						{detail}
					</pre>
				) : null}
				{state ? (
					<p mix={[css({ color: colors.textMuted, margin: 0 })]}>
						State: {state}
					</p>
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
			</section>
		)
	}
}
