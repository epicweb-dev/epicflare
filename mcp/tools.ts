import { z } from 'zod'
import { type MCP } from './index.ts'
import { toolsMetadata } from './server-metadata.ts'
import {
	mathOperationByOperator,
	mathOperations,
	mathOperators,
	type MathOperator,
} from './math-operations.ts'

type ListOperationsCursor = {
	offset: number
}

function parseCursor(cursor: string | undefined): ListOperationsCursor | null {
	if (!cursor) return { offset: 0 }
	const offset = Number.parseInt(cursor, 10)
	if (!Number.isFinite(offset) || offset < 0) return null
	return { offset }
}

function formatNumberForMarkdown(value: number, precision: number) {
	if (Number.isInteger(value)) return String(value)
	const rounded = value.toFixed(precision)
	return rounded.includes('.') ? rounded.replace(/\.?0+$/, '') : rounded
}

export async function registerTools(agent: MCP) {
	agent.server.registerTool(
		toolsMetadata.list_operations.name,
		{
			title: toolsMetadata.list_operations.title,
			description: toolsMetadata.list_operations.description,
			inputSchema: {
				limit: z
					.number()
					.int()
					.min(1)
					.max(50)
					.optional()
					.default(20)
					.describe('Max items to return (1-50, default: 20).'),
				cursor: z
					.string()
					.optional()
					.describe(
						'Opaque-ish cursor from a previous list_operations response (use structuredContent.pagination.nextCursor). Omit to start from the first page.',
					),
			},
			annotations: toolsMetadata.list_operations.annotations,
		},
		async ({ limit, cursor }: { limit: number; cursor?: string }) => {
			const parsed = parseCursor(cursor)
			if (!parsed) {
				return {
					content: [
						{
							type: 'text',
							text: `❌ Invalid cursor value: "${cursor}".\n\nNext: Omit 'cursor' to start, or pass the exact 'structuredContent.pagination.nextCursor' value from a prior list_operations call.`,
						},
					],
					structuredContent: {
						error: 'INVALID_CURSOR',
						cursor,
					},
					isError: true,
				}
			}

			const start = parsed.offset
			const end = Math.min(start + limit, mathOperations.length)
			const slice = mathOperations.slice(start, end).map((operation) => ({
				operator: operation.operator,
				name: operation.name,
				description: operation.description,
				example: operation.example,
			}))

			const hasMore = end < mathOperations.length
			const nextCursor = hasMore ? String(end) : undefined

			const rows = slice
				.map(
					(operation) =>
						`| \`${operation.operator}\` | ${operation.name} | ${operation.description} | ${operation.example} |`,
				)
				.join('\n')

			const nextSteps = hasMore
				? `\n\nNext: Call list_operations again with cursor="${nextCursor}" to fetch the next page, or call do_math with one of the operators above.`
				: `\n\nNext: Call do_math with one of the operators above.`

			return {
				content: [
					{
						type: 'text',
						text: `## 🧮 Supported operations\n\n| operator | name | description | example |\n| --- | --- | --- | --- |\n${rows}${nextSteps}`,
					},
				],
				structuredContent: {
					items: slice,
					pagination: {
						hasMore,
						nextCursor,
						itemsReturned: slice.length,
						limit,
					},
				},
			}
		},
	)

	agent.server.registerTool(
		toolsMetadata.do_math.name,
		{
			title: toolsMetadata.do_math.title,
			description: toolsMetadata.do_math.description,
			inputSchema: {
				left: z
					.number()
					.finite()
					.describe('Left operand (finite number). Example: 8'),
				right: z
					.number()
					.finite()
					.describe('Right operand (finite number). Example: 4'),
				operator: z
					.enum(mathOperators)
					.describe('Operator. Valid values: "+", "-", "*", "/".'),
				precision: z
					.number()
					.int()
					.min(0)
					.max(15)
					.optional()
					.default(6)
					.describe(
						'Decimal places used ONLY for the markdown output (0-15, default: 6). Does not round structuredContent.result.',
					),
			},
			annotations: toolsMetadata.do_math.annotations,
		},
		async ({
			left,
			right,
			operator,
			precision,
		}: {
			left: number
			right: number
			operator: MathOperator
			precision: number
		}) => {
			if (operator === '/' && right === 0) {
				return {
					content: [
						{
							type: 'text',
							text: `❌ Division by zero.\n\nInputs: left=${left}, operator="${operator}", right=${right}\n\nNext: Choose a non-zero right operand, or use list_operations to pick a different operator.`,
						},
					],
					structuredContent: {
						error: 'DIVISION_BY_ZERO',
						left,
						operator,
						right,
					},
					isError: true,
				}
			}

			const operation = mathOperationByOperator[operator]
			const result = operation.fn(left, right)
			if (!Number.isFinite(result)) {
				return {
					content: [
						{
							type: 'text',
							text: `❌ Result is not a finite number.\n\nInputs: left=${left}, operator="${operator}", right=${right}\n\nNext: Use smaller inputs or choose a different operator.`,
						},
					],
					structuredContent: {
						error: 'NON_FINITE_RESULT',
						left,
						operator,
						right,
					},
					isError: true,
				}
			}
			const expression = `${left} ${operator} ${right}`
			const markdownResult = formatNumberForMarkdown(result, precision)
			return {
				content: [
					{
						type: 'text',
						text: `## ✅ Result\n\n**Expression**: \`${expression}\`\n\n**Result**: \`${markdownResult}\`\n\nNext: If you need a machine-friendly number, use structuredContent.result.`,
					},
				],
				structuredContent: {
					left,
					operator,
					right,
					expression,
					result,
					precisionUsed: precision,
				},
			}
		},
	)
}
