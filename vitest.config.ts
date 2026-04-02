import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			'cloudflare:workers': fileURLToPath(
				new URL('./test-support/cloudflare-workers-shim.ts', import.meta.url),
			),
		},
	},
	test: {
		environment: 'node',
		globals: false,
		include: [
			'client/**/*.test.ts',
			'mcp/**/*.test.ts',
			'mock-servers/**/*.test.ts',
			'server/**/*.test.ts',
			'shared/**/*.test.ts',
			'tools/**/*.test.ts',
			'worker/**/*.test.ts',
		],
		exclude: ['e2e/**/*.spec.ts'],
	},
})
