import mcpServerBestPracticesMarkdown from '#docs/mcp-server-best-practices.md'
import { type MCP } from './index.ts'
import {
	promptsMetadata,
	resourcesMetadata,
	serverMetadata,
	toolsMetadata,
} from './server-metadata.ts'
import { mathOperations } from './math-operations.ts'

function jsonText(value: unknown) {
	return JSON.stringify(value, null, 2)
}

export async function registerResources(agent: MCP) {
	agent.server.registerResource(
		resourcesMetadata.server_info.name,
		resourcesMetadata.server_info.uri,
		{
			title: resourcesMetadata.server_info.title,
			description: resourcesMetadata.server_info.description,
			mimeType: resourcesMetadata.server_info.mimeType,
		},
		async (uri) => {
			const baseUrl = agent.requireDomain()
			const payload = {
				server: serverMetadata.implementation,
				baseUrl,
				mcpEndpoint: `${baseUrl}/mcp`,
				instructions: serverMetadata.instructions,
				tools: Object.values(toolsMetadata).map((tool) => ({
					name: tool.name,
					title: tool.title,
				})),
				resources: Object.values(resourcesMetadata).map((resource) => ({
					name: resource.name,
					uri: resource.uri,
					title: resource.title,
					mimeType: resource.mimeType,
				})),
				prompts: Object.values(promptsMetadata).map((prompt) => ({
					name: prompt.name,
					title: prompt.title,
				})),
			}

			return {
				contents: [
					{
						uri: uri.toString(),
						mimeType: 'application/json',
						text: jsonText(payload),
					},
				],
			}
		},
	)

	agent.server.registerResource(
		resourcesMetadata.operations.name,
		resourcesMetadata.operations.uri,
		{
			title: resourcesMetadata.operations.title,
			description: resourcesMetadata.operations.description,
			mimeType: resourcesMetadata.operations.mimeType,
		},
		async (uri) => {
			const payload = {
				items: mathOperations.map((operation) => ({
					operator: operation.operator,
					name: operation.name,
					description: operation.description,
					example: operation.example,
				})),
			}

			return {
				contents: [
					{
						uri: uri.toString(),
						mimeType: 'application/json',
						text: jsonText(payload),
					},
				],
			}
		},
	)

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
