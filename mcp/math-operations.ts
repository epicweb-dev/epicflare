export type OperationFn = (left: number, right: number) => number

export const mathOperators = ['+', '-', '*', '/'] as const
export type MathOperator = (typeof mathOperators)[number]

export type MathOperationDefinition = {
	operator: MathOperator
	name: string
	description: string
	example: string
	fn: OperationFn
}

export const mathOperations: Array<MathOperationDefinition> = [
	{
		operator: '+',
		name: 'add',
		description: 'Adds the right operand to the left operand.',
		example: '8 + 4 = 12',
		fn: (left, right) => left + right,
	},
	{
		operator: '-',
		name: 'subtract',
		description: 'Subtracts the right operand from the left operand.',
		example: '8 - 4 = 4',
		fn: (left, right) => left - right,
	},
	{
		operator: '*',
		name: 'multiply',
		description: 'Multiplies the left and right operands.',
		example: '8 * 4 = 32',
		fn: (left, right) => left * right,
	},
	{
		operator: '/',
		name: 'divide',
		description: 'Divides the left operand by the right operand.',
		example: '8 / 4 = 2',
		fn: (left, right) => left / right,
	},
]

export const mathOperationByOperator = Object.fromEntries(
	mathOperations.map((operation) => [operation.operator, operation]),
) as Record<MathOperator, MathOperationDefinition>
