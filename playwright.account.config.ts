import { defineConfig, devices } from '@playwright/test';

/** Konto/Sync gegen lokale Pages Functions + D1 (wrangler), nur Chromium (virtueller Passkey) */
export default defineConfig({
	testDir: 'e2e-account',
	testMatch: '**/*.e2e.ts',
	timeout: 60_000,
	webServer: {
		command:
			'npx wrangler pages dev build --d1 DB=rookie-e2e --port 8789 --compatibility-date=2026-11-01 --persist-to .wrangler/e2e',
		port: 8789,
		reuseExistingServer: false,
		timeout: 120_000
	},
	use: {
		baseURL: 'http://localhost:8789',
		storageState: {
			cookies: [],
			origins: [
				{
					origin: 'http://localhost:8789',
					localStorage: [
						{ name: 'rookie:installDismissed', value: '9999999999999' },
						{ name: 'rookie:onboarded', value: '1' }
					]
				}
			]
		}
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
