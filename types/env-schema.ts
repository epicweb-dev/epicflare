import { z } from 'zod'

const optionalNonEmptyString = z.preprocess((value) => {
	if (typeof value !== 'string') return value
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}, z.string().optional())

const resendApiBaseUrlSchema = z.preprocess((value) => {
	if (typeof value !== 'string') return value
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}, z.url().optional())

const appBaseUrlSchema = z.preprocess((value) => {
	if (typeof value !== 'string') return value
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}, z.url().optional())

const databaseUrlSchema = z
	.string()
	.min(1, 'Missing DATABASE_URL for database access.')
	.refine(
		(value) =>
			value.startsWith('postgres://') ||
			value.startsWith('postgresql://') ||
			value.startsWith('sqlite:') ||
			value.startsWith('pglite:'),
		{
			message:
				'DATABASE_URL must start with postgres://, postgresql://, sqlite:, or pglite:.',
		},
	)

export const EnvSchema = z.object({
	COOKIE_SECRET: z
		.string()
		.min(
			32,
			'COOKIE_SECRET must be at least 32 characters for session signing.',
		),
	DATABASE_URL: databaseUrlSchema,
	DATABASE_WS_PROXY: optionalNonEmptyString,
	APP_BASE_URL: appBaseUrlSchema,
	RESEND_API_BASE_URL: resendApiBaseUrlSchema,
	RESEND_API_KEY: optionalNonEmptyString,
	RESEND_FROM_EMAIL: optionalNonEmptyString,
})

export type AppEnv = z.infer<typeof EnvSchema>
