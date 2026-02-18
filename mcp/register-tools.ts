import { type MCP } from './index.ts'

export async function registerTools(agent: MCP) {
	await import('./tools/do-math.ts').then(({ registerTool }) =>
		registerTool(agent),
	)
}
