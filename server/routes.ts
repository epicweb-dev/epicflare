import { post, route } from 'remix/fetch-router'

const routes = route({
	home: '/',
	health: '/health',
	auth: post('/auth'),
})

export default routes
