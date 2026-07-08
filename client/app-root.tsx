import { clientEntry, type EntryComponent, type Handle } from 'remix/ui'
import { App } from './app.tsx'
import { RouterLocationProvider } from './router-location.tsx'
import { type SessionInfo } from './session.ts'

export const APP_ROOT_ENTRY_ID = '/client-entry.js#AppRoot'

export type AppRootProps = {
	url: string
	session: SessionInfo | null
	notFound?: boolean
}

export const AppRoot: EntryComponent<AppRootProps> = clientEntry(
	APP_ROOT_ENTRY_ID,
	function AppRoot(handle: Handle<AppRootProps>) {
		return () => (
			<RouterLocationProvider url={handle.props.url}>
				<App
					embeddedSession={handle.props.session}
					notFound={handle.props.notFound === true}
				/>
			</RouterLocationProvider>
		)
	},
)
