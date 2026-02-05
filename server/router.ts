import { createRouter } from 'remix/fetch-router'
import health from './handlers/health.ts'
import home from './handlers/home.ts'
import routes from './routes.ts'

const router = createRouter({
	middleware: [],
	defaultHandler() {
		return new Response('Not Found', { status: 404 })
	},
})

router.map(routes.home, home)
router.map(routes.health, health)

export default router
