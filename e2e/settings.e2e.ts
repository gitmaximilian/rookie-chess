import { expect, test } from '@playwright/test';

test('Sicherung exportieren und wieder einspielen', async ({ page }) => {
	await page.goto('/settings');
	await page.getByRole('radio', { name: '10' }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: /Save backup/ }).click()
	]);
	const path = await download.path();
	expect(download.suggestedFilename()).toMatch(/^rookie-backup-.*\.json$/);

	// Tagesziel ändern, dann Sicherung zurückspielen
	await page.getByRole('radio', { name: '3' }).click();
	page.once('dialog', (d) => d.accept());
	await page.locator('input[type=file]').setInputFiles(path!);
	await expect(page.getByText('Backup restored')).toBeVisible();
	await page.waitForLoadState('load');
	await page.goto('/settings');
	await expect(page.getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');
});

test('Dunkelmodus lässt sich erzwingen', async ({ page }) => {
	await page.goto('/settings');
	await page.getByRole('radio', { name: /Dark/ }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Sprache: Englisch ist Standard, Deutsch umschaltbar und gespeichert', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByText('Puzzle of the day')).toBeVisible();
	await page.goto('/settings');
	await page.getByRole('radio', { name: 'Deutsch' }).click();
	await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await page.goto('/');
	await expect(page.getByText('Puzzle des Tages')).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await page.goto('/settings');
	await page.getByRole('radio', { name: 'English' }).click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});
