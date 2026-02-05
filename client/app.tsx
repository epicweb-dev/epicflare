import { Counter } from './counter.tsx'
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
		</main>
	)
}
