import { type Action } from 'remix/router'
import { type AppEnv } from '#types/env-schema.ts'
import { type routes } from '#server/routes.ts'
import { createAuthPageHandler } from './auth-page.ts'

export function createSignupHandler(appEnv: AppEnv) {
	return createAuthPageHandler(appEnv) satisfies Action<typeof routes.signup>
}
