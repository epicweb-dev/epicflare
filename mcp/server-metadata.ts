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
