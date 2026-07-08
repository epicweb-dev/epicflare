import { type ChatThreadSummary } from './chat.ts'

export type AccountLoaderData = {
	ok: true
	email: string
}

export type OAuthAuthorizeLoaderData =
	| {
			ok: true
			client: {
				id: string
				name: string
			}
			scopes: Array<string>
	  }
	| {
			ok: false
			error: string
	  }

export type ChatLoaderData = {
	ok: true
	threads: Array<ChatThreadSummary>
	hasMore: boolean
	nextCursor: string | null
	totalCount: number
	selectedThread: ChatThreadSummary | null
	search: string
}

export type AppLoaderData = {
	account?: AccountLoaderData
	chat?: ChatLoaderData
	oauthAuthorize?: OAuthAuthorizeLoaderData
}
