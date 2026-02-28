import {
	RESOURCE_MIME_TYPE,
	registerAppResource,
} from '@modelcontextprotocol/ext-apps/server'
import { createUIResource } from '@mcp-ui/server'
import {
	calculatorUiResourceUri,
	renderCalculatorUiEntryPoint,
} from '#mcp/apps/calculator-ui-entry-point.ts'
import { type MCP } from '#mcp/index.ts'

const calculatorAppResource = {
	name: 'calculator_app_resource',
	title: 'Calculator App Resource',
	description:
		'Interactive calculator app entry point rendered by MCP App compatible hosts.',
} as const

export async function registerCalculatorAppResource(agent: MCP) {
	const baseUrl = agent.requireDomain()
	const styleSheetUrl = new URL('/styles.css', baseUrl).toString()
	const widgetScriptUrl = new URL(
		'/mcp-apps/calculator-widget.js',
		baseUrl,
	).toString()
	const resourceDomain = new URL(styleSheetUrl).origin

	registerAppResource(
		agent.server,
		calculatorAppResource.name,
		calculatorUiResourceUri,
		{
			title: calculatorAppResource.title,
			description: calculatorAppResource.description,
		},
		async () => {
			const calculatorUiResource = createUIResource({
				uri: calculatorUiResourceUri,
				content: {
					type: 'rawHtml',
					htmlString: renderCalculatorUiEntryPoint({
						stylesheetHref: styleSheetUrl,
						widgetScriptHref: widgetScriptUrl,
					}),
				},
				encoding: 'text',
				adapters: {
					mcpApps: {
						enabled: true,
					},
				},
			})

			return {
				contents: [
					{
						...calculatorUiResource.resource,
						mimeType: RESOURCE_MIME_TYPE,
						_meta: {
							ui: {
								prefersBorder: true,
								domain: resourceDomain,
								csp: {
									resourceDomains: [resourceDomain],
								},
							},
							'openai/widgetDomain': resourceDomain,
						},
					},
				],
			}
		},
	)
}
