import { AccountRoute } from './account.tsx'
import { ChatRoute } from './chat.tsx'
import { HomeRoute } from './home.tsx'
import { LoginRoute } from './login.tsx'
import { OAuthAuthorizeRoute } from './oauth-authorize.tsx'
import { OAuthCallbackRoute } from './oauth-callback.tsx'
import { ResetPasswordRoute } from './reset-password.tsx'

export const clientRoutes = {
	'/': <HomeRoute />,
	'/chat': <ChatRoute />,
	'/account': <AccountRoute />,
	'/login': <LoginRoute />,
	'/signup': <LoginRoute setup={{ initialMode: 'signup' }} />,
	'/reset-password': <ResetPasswordRoute />,
	'/oauth/authorize': <OAuthAuthorizeRoute />,
	'/oauth/callback': <OAuthCallbackRoute />,
}
