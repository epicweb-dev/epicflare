import { type Handle, type RemixNode } from 'remix/ui'
import { type SessionInfo } from './session.ts'

export type SessionContextValue = {
	session: SessionInfo | null
}

export function SessionProvider(
	handle: Handle<
		{ children?: RemixNode; session: SessionInfo | null },
		SessionContextValue
	>,
) {
	handle.context.set({ session: handle.props.session })

	return () => handle.props.children
}

export function readSession(handle: Pick<Handle, 'context'>) {
	return handle.context.get(SessionProvider).session
}
