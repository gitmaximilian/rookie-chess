import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview -- --port 4173 --strictPort',
		port: 4173,
		reuseExistingServer: false
	},
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	use: {
		baseURL: 'http://localhost:4173',
		// Installations-Hinweis in den üblichen Tests ausblenden (eigener Test: install.e2e.ts)
		storageState: {
			cookies: [],
			origins: [
				{
					origin: 'http://localhost:4173',
					localStorage: [{ name: 'rookie:installDismissed', value: '9999999999999' }]
				}
			]
		}
	},
	projects: [
		// Safari-Engine wie auf iPhone und Mac
		{ name: 'iphone', use: { ...devices['iPhone 15'] } },
		{ name: 'mac-safari', use: { ...devices['Desktop Safari'] } },
		// Chromium für Service-Worker-/Offline-Tests (WebKit in Playwright unterstützt keine SW)
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }
	]
});
