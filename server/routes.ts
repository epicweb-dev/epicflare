import { post, route } from 'remix/fetch-router'

const routes = route({
	home: '/',
	health: '/health',
	login: '/login',
	signup: '/signup',
	account: '/account',
	auth: post('/auth'),
	session: '/session',
	logout: post('/logout'),
})

export default routes
