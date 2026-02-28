import { post, route } from 'remix/fetch-router/routes'

export const routes = route({
	home: '/',
	chat: '/chat',
	health: '/health',
	login: '/login',
	signup: '/signup',
	account: '/account',
	auth: post('/auth'),
	session: '/session',
	logout: post('/logout'),
	passwordResetRequest: post('/password-reset'),
	passwordResetConfirm: post('/password-reset/confirm'),
})
