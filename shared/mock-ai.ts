export type MockAiResponse =
	| {
			kind: 'text'
			text: string
			chunks?: Array<string>
	  }
	| {
			kind: 'tool-call'
			toolName: string
			input: Record<string, unknown>
			text?: string
	  }
	| {
			kind: 'error'
			message: string
	  }

function parseScalar(value: string) {
	const trimmed = value.trim()
	if (trimmed === 'true') return true
	if (trimmed === 'false') return false
	if (trimmed === 'null') return null
	if (trimmed === 'undefined') return undefined
	if (trimmed === '') return ''

	const numericValue = Number(trimmed)
	if (!Number.isNaN(numericValue) && trimmed === String(numericValue)) {
		return numericValue
	}

	return trimmed
}

export function parseMockToolCommand(input: string) {
	const [toolSegment, ...pairs] = input.split(';')
	if (!toolSegment) return null
	if (!toolSegment.startsWith('tool:')) return null

	const toolName = toolSegment.slice('tool:'.length).trim()
	if (!toolName) return null

	const parsedInput: Record<string, unknown> = {}
	for (const pair of pairs) {
		const [rawKey, ...rawValueParts] = pair.split('=')
		const key = rawKey?.trim()
		if (!key) continue
		parsedInput[key] = parseScalar(rawValueParts.join('='))
	}

	return {
		toolName,
		input: parsedInput,
	}
}
