import { createRouter } from 'remix/fetch-router'
import account from './handlers/account.ts'
import auth from './handlers/auth.ts'
import health from './handlers/health.ts'
import home from './handlers/home.ts'
import { Layout } from './layout.ts'
import { render } from './render.ts'
import routes from './routes.ts'

const router = createRouter({
	middleware: [],
	async defaultHandler() {
		return render(Layout({}))
	},
})

router.map(routes.home, home)
router.map(routes.health, health)
router.map(routes.account, account)
router.map(routes.auth, auth)

export default router
