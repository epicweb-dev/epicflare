import { route } from 'remix/fetch-router'

const routes = route({
	home: '/',
	health: '/health',
})

export default routes
