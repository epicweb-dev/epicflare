import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		clearMocks: true,
		include: ['vitest-tests/**/*.test.ts'],
	},
})
