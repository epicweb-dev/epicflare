import { type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

export const serverMetadata = {
	implementation: {
		name: 'epicflare-mcp',
		version: '1.0.0',
	},
	instructions: `
Quick start
- Use 'do_math' to compute a single arithmetic operation on two numbers.
- Tools return both human-readable markdown in 'content' and machine-friendly data in 'structuredContent'.

Default behavior
- 'do_math.precision' controls ONLY the human-readable formatting. 'structuredContent.result' is not rounded.
- Division by zero is rejected with an actionable error message.

How to chain tools safely
- Use one of the supported operators: "+", "-", "*", "/".
- If you need to verify, re-run 'do_math' with the same arguments (idempotent) or validate with an inverse operation.

Common patterns & examples
- "Compute 8 + 4" → call 'do_math' with { left: 8, operator: "+", right: 4 }
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

Inputs:
- left: number (required) — Left operand, e.g. 8
- operator: "+" | "-" | "*" | "/" (required) — The operation to apply.
- right: number (required) — Right operand, e.g. 4
- precision: integer (optional, default: 6) — Decimal places used ONLY in the markdown output (structured result is not rounded).

Returns (structuredContent): { left, operator, right, expression, result, precisionUsed }

Examples:
- "Add 8 and 4" → { left: 8, operator: "+", right: 4 }
- "Divide 1 by 3 with 3 decimals" → { left: 1, operator: "/", right: 3, precision: 3 }

Next:
- Use 'structuredContent.result' if you need a machine-friendly number.
- If you need to present the result to a user, use the markdown text in 'content'.
		`.trim(),
		annotations: readOnlyToolAnnotations,
	},
} as const
