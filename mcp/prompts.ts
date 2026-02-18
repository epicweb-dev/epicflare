import { z } from 'zod'
import { type MCP } from './index.ts'
import { promptsMetadata } from './server-metadata.ts'

export async function registerPrompts(agent: MCP) {
	agent.server.registerPrompt(
		promptsMetadata.solve_math_problem.name,
		{
			title: promptsMetadata.solve_math_problem.title,
			description: promptsMetadata.solve_math_problem.description,
			argsSchema: {
				problem: z
					.string()
					.optional()
					.describe(
						'Optional math problem statement (natural language or an expression like "8 + 4").',
					),
			},
		},
		async ({ problem }: { problem?: string }) => {
			const userMessage = problem
				? `Please solve this math problem: ${problem}

If the operator is unclear, call list_operations first, then use do_math.`
				: `I want to solve a math problem.

Please ask me for:
1) the left number
2) the operator
3) the right number

If I am unsure about operators, call list_operations first, then use do_math.`

			return {
				description:
					'Guides the user to provide operands/operator, then calls list_operations/do_math.',
				messages: [
					{
						role: 'user',
						content: [{ type: 'text' as const, text: userMessage }],
					},
				],
			}
		},
	)
}
