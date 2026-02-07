import { type BuildAction } from 'remix/fetch-router'
import type routes from '../routes.ts'
import { createAuthPageHandler } from './auth-page.ts'

export default createAuthPageHandler() satisfies BuildAction<
	typeof routes.login.method,
	typeof routes.login.pattern
>
