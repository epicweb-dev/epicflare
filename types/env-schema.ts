import { z } from 'zod'

export const EnvSchema = z.object({
	COOKIE_SECRET: z
		.string()
		.min(1, 'Missing COOKIE_SECRET for session signing.'),
})

export type AppEnv = z.infer<typeof EnvSchema>
