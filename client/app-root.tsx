import { clientEntry, type EntryComponent, type Handle } from 'remix/ui'
import { type AppLoaderData } from '#shared/loader-data.ts'
import { App } from './app.tsx'
import { AppLoaderDataProvider } from './loader-data-context.tsx'
import { RouterLocationProvider } from './router-location.tsx'
import { type SessionInfo } from './session.ts'

export const APP_ROOT_ENTRY_ID = '/client-entry.js#AppRoot'

export type AppRootProps = {
	url: string
	session: SessionInfo | null
	loaderData?: AppLoaderData
	notFound?: boolean
}

export const AppRoot: EntryComponent<AppRootProps> = clientEntry(
	APP_ROOT_ENTRY_ID,
	function AppRoot(handle: Handle<AppRootProps>) {
		return () => (
			<RouterLocationProvider url={handle.props.url}>
				<AppLoaderDataProvider loaderData={handle.props.loaderData}>
					<App
						embeddedSession={handle.props.session}
						notFound={handle.props.notFound === true}
					/>
				</AppLoaderDataProvider>
			</RouterLocationProvider>
		)
	},
)
