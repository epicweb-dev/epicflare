import { z } from 'zod'
import { type MCP } from './index.ts'
import { toolsMetadata } from './server-metadata.ts'

type OperationFn = (left: number, right: number) => number
type MathOperator = '+' | '-' | '*' | '/'

const operations = {
	'+': (left: number, right: number) => left + right,
	'-': (left: number, right: number) => left - right,
	'*': (left: number, right: number) => left * right,
	'/': (left: number, right: number) => left / right,
} satisfies Record<MathOperator, OperationFn>

const mathOperators = Object.keys(operations) as Array<MathOperator>

function formatNumberForMarkdown(value: number, precision: number) {
	if (Number.isInteger(value)) return String(value)
	const rounded = value.toFixed(precision)
	return rounded.includes('.') ? rounded.replace(/\.?0+$/, '') : rounded
}

export async function registerTools(agent: MCP) {
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
						'Decimal places used ONLY for the markdown output (0-15, default: 6). Does not change the computed numeric result.',
					),
			},
			outputSchema: {
				left: z
					.number()
					.finite()
					.describe('Left operand used in the evaluated expression.'),
				operator: z
					.enum(mathOperators)
					.describe('Operator used in the evaluated expression.'),
				right: z
					.number()
					.finite()
					.describe('Right operand used in the evaluated expression.'),
				expression: z.string().describe('Expression string, e.g. "8 + 4".'),
				result: z
					.number()
					.finite()
					.describe('Exact numeric result (not rounded).'),
				precisionUsed: z
					.number()
					.int()
					.min(0)
					.max(15)
					.describe('Precision used ONLY for markdown formatting.'),
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
							text: `
❌ Division by zero.

Inputs: left=${left}, operator="${operator}", right=${right}

Next: Choose a non-zero right operand.
							`.trim(),
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

			const operation = operations[operator]
			const result = operation(left, right)
			if (!Number.isFinite(result)) {
				return {
					content: [
						{
							type: 'text',
							text: `
❌ Result is not a finite number.

Inputs: left=${left}, operator="${operator}", right=${right}

Next: Use smaller inputs or choose a different operator.
							`.trim(),
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
						text: `
## ✅ Result

**Expression**: \`${expression}\`

**Result**: \`${markdownResult}\`
						`.trim(),
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
