import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			'cloudflare:workers': '/workspace/test-support/cloudflare-workers-shim.ts',
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
