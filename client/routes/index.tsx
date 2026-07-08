import { routes } from '#server/routes.ts'
import { AccountRoute } from './account.tsx'
import { ChatRoute } from './chat.tsx'
import { HomeRoute } from './home.tsx'
import { LoginRoute } from './login.tsx'
import { OAuthAuthorizeRoute } from './oauth-authorize.tsx'
import { OAuthCallbackRoute } from './oauth-callback.tsx'
import { ResetPasswordRoute } from './reset-password.tsx'

export const clientRoutes = {
	[routes.home.href()]: <HomeRoute />,
	[routes.chat.href()]: <ChatRoute />,
	'/chat/:threadId': <ChatRoute />,
	[routes.account.href()]: <AccountRoute />,
	[routes.login.href()]: <LoginRoute />,
	[routes.signup.href()]: <LoginRoute />,
	[routes.resetPassword.href()]: <ResetPasswordRoute />,
	[routes.oauthAuthorize.href()]: <OAuthAuthorizeRoute />,
	[routes.oauthCallback.href()]: <OAuthCallbackRoute />,
}
