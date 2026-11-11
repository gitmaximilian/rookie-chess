import { expect, test } from '@playwright/test';

// ohne die „schon abgelehnt“-Markierung aus der globalen Konfiguration
test.use({
	storageState: {
		cookies: [],
		origins: [
			{
				origin: 'http://localhost:4173',
				localStorage: [{ name: 'rookie:onboarded', value: '1' }]
			}
		]
	}
});

test('iPhone: Installations-Hinweis mit Anleitung; „Nicht jetzt“ merkt sich die Wahl', async ({
	page
}, info) => {
	test.skip(info.project.name !== 'iphone', 'nur am Handy');
	await page.goto('/');
	const banner = page.getByRole('dialog', { name: 'Install Rookie as an app' });
	await expect(banner).toBeVisible({ timeout: 10_000 });

	await banner.getByRole('button', { name: 'Show me how' }).click();
	const guide = page.getByRole('dialog', { name: 'Add Rookie to your home screen' });
	await expect(guide.getByText(/Share button/)).toBeVisible();
	await expect(guide.getByText(/Add to Home Screen/)).toBeVisible();
	await guide.getByRole('button', { name: 'Not now' }).click();
	await expect(guide).toBeHidden();

	await page.reload();
	await page.waitForTimeout(2500);
	await expect(banner).toBeHidden();

	// in den Einstellungen bleibt die Anleitung erreichbar
	await page.goto('/settings');
	await page.getByRole('button', { name: /Install as app/ }).click();
	await expect(guide).toBeVisible();
});

test('iPhone: kein Hinweis über dem Brett', async ({ page }, info) => {
	test.skip(info.project.name !== 'iphone', 'nur am Handy');
	await page.goto('/play');
	await page.waitForTimeout(2500);
	await expect(page.getByRole('dialog', { name: 'Install Rookie as an app' })).toBeHidden();
});

test('Desktop: kein automatischer Hinweis', async ({ page }, info) => {
	test.skip(info.project.name === 'iphone', 'nur Desktop');
	await page.goto('/');
	await page.waitForTimeout(2500);
	await expect(page.getByRole('dialog', { name: 'Install Rookie as an app' })).toBeHidden();
});
