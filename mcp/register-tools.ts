import { type MCP } from './index.ts'
import { registerDoMathTool } from './tools/do-math.ts'

export async function registerTools(agent: MCP) {
	await registerDoMathTool(agent)
}
