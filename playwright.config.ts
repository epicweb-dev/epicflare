import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8787'

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
	},
	webServer: {
		command: `bun run build:client && bun run preview`,
		url: baseURL,
		reuseExistingServer: true,
		env: {
			COOKIE_SECRET: 'playwright-cookie-secret',
			WRANGLER_LOG_PATH: './logs.local',
			WRANGLER_DISABLE_REQUEST_BODY_DRAINING: 'true',
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
})
