import { type MCP } from './index.ts'
import { resourcesMetadata } from './server-metadata.ts'
import { mcpServerBestPracticesMarkdown } from './server-best-practices-doc.ts'

export async function registerResources(agent: MCP) {
	agent.server.registerResource(
		resourcesMetadata.mcp_server_best_practices.name,
		resourcesMetadata.mcp_server_best_practices.uri,
		{
			title: resourcesMetadata.mcp_server_best_practices.title,
			description: resourcesMetadata.mcp_server_best_practices.description,
			mimeType: resourcesMetadata.mcp_server_best_practices.mimeType,
		},
		async (uri) => {
			return {
				contents: [
					{
						uri: uri.toString(),
						mimeType: 'text/markdown',
						text: mcpServerBestPracticesMarkdown,
					},
				],
			}
		},
	)
}
