import { EnvSchema, type AppEnv } from '#types/env-schema.ts'

export function getEnv(env: Env): AppEnv {
	const result = EnvSchema.safeParse(env)

	if (!result.success) {
		const message = result.error.issues
			.map((issue) => {
				const key = issue.path.join('.') || 'env'
				return `${key}: ${issue.message}`
			})
			.join(', ')

		throw new Error(
			`Invalid environment variables: ${message}.\n\n💡 Tip: Check \`docs/environment-variables.md\` for details.`,
		)
	}

	return result.data
}
