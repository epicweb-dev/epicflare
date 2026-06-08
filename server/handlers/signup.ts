import { type Action } from 'remix/router'
import { type routes } from '#server/routes.ts'
import { createAuthPageHandler } from './auth-page.ts'

export const signup = createAuthPageHandler() satisfies Action<
	typeof routes.signup
>
