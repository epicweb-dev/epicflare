import { type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

export const serverMetadata = {
	implementation: {
		name: 'epicflare-mcp',
		version: '1.0.0',
	},
	instructions: `Quick start
- If you are unsure what math operations are available, call 'list_operations' first.
- Use 'do_math' to compute a single arithmetic operation on two numbers.
- Tools return both human-readable markdown in 'content' and machine-friendly data in 'structuredContent'.

Default behavior
- 'list_operations' paginates with { limit, cursor }. If omitted, sensible defaults are used.
- 'do_math.precision' controls ONLY the human-readable formatting. 'structuredContent.result' is not rounded.
- Division by zero is rejected with an actionable error message.

How to chain tools safely
- Call 'list_operations' to confirm valid operator values.
- Call 'do_math' using an operator returned by 'list_operations'.
- If you need to verify, re-run 'do_math' with the same arguments (idempotent) or validate with an inverse operation.

Common patterns & examples
- "Compute 8 + 4" → call 'do_math' with { left: 8, operator: "+", right: 4 }
- "See what operators exist" → call 'list_operations', then pick an operator and call 'do_math'

Resources
- 'epicflare://server' → server overview (JSON)
- 'epicflare://operations' → supported operations (JSON)
- 'epicflare://docs/mcp-server-best-practices' → this repo's MCP server best practices (markdown)

Prompts
- 'solve_math_problem' → workflow starter for interactive math solving`,
}

export const readOnlyToolAnnotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
} satisfies ToolAnnotations

export const toolsMetadata = {
	list_operations: {
		name: 'list_operations',
		title: 'List Operations',
		description: `List supported arithmetic operators and their meaning.

Inputs:
- limit: integer (optional, default: 20, max: 50) — Max items to return per page.
- cursor: string (optional) — Cursor from the previous 'list_operations' response to fetch the next page.

Returns: {
  items: Array<{ operator, name, description, example }>,
  pagination: { hasMore, nextCursor, itemsReturned, limit }
}

Examples:
- "Show available operators" → { }
- "First page (2 items)" → { limit: 2 }
- "Next page" → { cursor: "<nextCursor from prior call>", limit: 2 }

Next: Pick an operator value and pass it to 'do_math'.`,
		annotations: readOnlyToolAnnotations,
	},
	do_math: {
		name: 'do_math',
		title: 'Do Math',
		description: `Compute a single arithmetic operation over two numbers.

Inputs:
- left: number (required) — Left operand, e.g. 8
- operator: "+" | "-" | "*" | "/" (required) — The operation to apply. If unsure, call 'list_operations' first.
- right: number (required) — Right operand, e.g. 4
- precision: integer (optional, default: 6) — Decimal places used ONLY in the markdown output (structured result is not rounded).

Returns (structuredContent): { left, operator, right, expression, result, precisionUsed }

Examples:
- "Add 8 and 4" → { left: 8, operator: "+", right: 4 }
- "Divide 1 by 3 with 3 decimals" → { left: 1, operator: "/", right: 3, precision: 3 }

Next:
- Use 'structuredContent.result' if you need a machine-friendly number.
- If you need to present the result to a user, use the markdown text in 'content'.`,
		annotations: readOnlyToolAnnotations,
	},
} as const

export const resourcesMetadata = {
	server_info: {
		name: 'server_info',
		uri: 'epicflare://server',
		title: 'Server info',
		description:
			'High-level server overview (instructions, tools/resources/prompts summary).',
		mimeType: 'application/json',
	},
	operations: {
		name: 'operations',
		uri: 'epicflare://operations',
		title: 'Math operations',
		description: 'Read-only list of supported math operations/operators.',
		mimeType: 'application/json',
	},
	mcp_server_best_practices: {
		name: 'mcp_server_best_practices',
		uri: 'epicflare://docs/mcp-server-best-practices',
		title: 'MCP Server Best Practices',
		description:
			'Learnings from analyzing high-quality MCP server implementations.',
		mimeType: 'text/markdown',
	},
} as const

export const promptsMetadata = {
	solve_math_problem: {
		name: 'solve_math_problem',
		title: 'Solve a math problem',
		description:
			'Interactive workflow starter that guides the user and calls list_operations/do_math.',
	},
} as const
