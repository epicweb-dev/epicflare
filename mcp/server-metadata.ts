import { type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

export const serverMetadata = {
	implementation: {
		name: 'epicflare-mcp',
		version: '1.0.0',
	},
	instructions: `
Quick start
- Use 'do_math' any time you need arithmetic. Prefer calling the tool over doing mental math.

How to chain tools safely
- If you need to verify, re-run 'do_math' with the same arguments (idempotent) or validate with an inverse operation.
	`.trim(),
}

export const readOnlyToolAnnotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
} satisfies ToolAnnotations

export const toolsMetadata = {
	do_math: {
		name: 'do_math',
		title: 'Do Math',
		description: `
Compute a single arithmetic operation over two numbers.

Behavior:
- Division by zero is rejected.

Examples:
- "Add 8 and 4" → { left: 8, operator: "+", right: 4 }
- "Divide 1 by 3 with 3 decimals" → { left: 1, operator: "/", right: 3, precision: 3 }
		`.trim(),
		annotations: readOnlyToolAnnotations,
	},
} as const
