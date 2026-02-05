import { Counter } from './counter.tsx'
import { colors, spacing, typography } from './styles/tokens.ts'

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
