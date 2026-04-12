import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		globals: false,
		include: ['server/**/*.test.ts', 'mock-servers/**/*.test.ts'],
	},
})
