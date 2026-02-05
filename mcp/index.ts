import { invariant } from '@epic-web/invariant'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { registerTools } from './tools.ts'
import type { Env } from '../types/worker-configuration.d.ts'

export type State = {}
export type Props = {
	baseUrl: string
}
export class MCP extends McpAgent<Env, State, Props> {
	server = new McpServer(
		{
			name: 'MCP',
			version: '1.0.0',
		},
		{
			instructions: `Use this server to solve math problems reliably and accurately.`,
		},
	)
	async init() {
		await registerTools(this)
	}
	requireDomain() {
		const baseUrl = this.props?.baseUrl
		invariant(
			baseUrl,
			'This should never happen, but somehow we did not get the baseUrl from the request handler',
		)
		return baseUrl
	}
}
