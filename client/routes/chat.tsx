import { type Handle } from 'remix/component'
import { colors, spacing, typography } from '#client/styles/tokens.ts'

export function ChatRoute(_handle: Handle) {
	return () => (
		<section css={{ display: 'grid', gap: spacing.lg }}>
			<h2
				css={{
					fontSize: typography.fontSize.lg,
					fontWeight: typography.fontWeight.semibold,
					margin: 0,
					color: colors.text,
				}}
			>
				Chat
			</h2>
			<p css={{ margin: 0, color: colors.textMuted }}>AI chat coming soon.</p>
		</section>
	)
}
