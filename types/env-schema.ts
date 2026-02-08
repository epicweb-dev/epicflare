import { z } from 'zod'

const d1DatabaseSchema = z.custom<D1Database>((value) => Boolean(value), {
	message: 'Missing APP_DB binding for database access.',
})

export const EnvSchema = z.object({
	COOKIE_SECRET: z
		.string()
		.min(
			32,
			'COOKIE_SECRET must be at least 32 characters for session signing.',
		),
	APP_DB: d1DatabaseSchema,
})

export type AppEnv = z.infer<typeof EnvSchema>
