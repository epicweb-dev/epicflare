import { post, route } from 'remix/fetch-router'

const routes = route({
	home: '/',
	health: '/health',
	account: '/account',
	auth: post('/auth'),
})

export default routes
