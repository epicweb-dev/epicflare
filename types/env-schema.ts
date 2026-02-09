import { z } from 'zod'

const d1DatabaseSchema = z.custom<D1Database>((value) => Boolean(value), {
	message: 'Missing APP_DB binding for database access.',
})

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

export const EnvSchema = z.object({
	COOKIE_SECRET: z
		.string()
		.min(
			32,
			'COOKIE_SECRET must be at least 32 characters for session signing.',
		),
	APP_DB: d1DatabaseSchema,
	APP_BASE_URL: appBaseUrlSchema,
	RESEND_API_BASE_URL: resendApiBaseUrlSchema,
	RESEND_API_KEY: optionalNonEmptyString,
	RESEND_FROM_EMAIL: optionalNonEmptyString,
})

export type AppEnv = z.infer<typeof EnvSchema>
