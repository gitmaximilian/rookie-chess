import { expect, test } from '@playwright/test';

test('Sicherung exportieren und wieder einspielen', async ({ page }) => {
	await page.goto('/settings');
	await page.getByRole('radio', { name: '10' }).click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: /Sicherung speichern/ }).click()
	]);
	const path = await download.path();
	expect(download.suggestedFilename()).toMatch(/^rookie-backup-.*\.json$/);

	// Tagesziel ändern, dann Sicherung zurückspielen
	await page.getByRole('radio', { name: '3' }).click();
	page.once('dialog', (d) => d.accept());
	await page.locator('input[type=file]').setInputFiles(path!);
	await expect(page.getByText('Sicherung eingespielt')).toBeVisible();
	await page.waitForLoadState('load');
	await page.goto('/settings');
	await expect(page.getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');
});

test('Dunkelmodus lässt sich erzwingen', async ({ page }) => {
	await page.goto('/settings');
	await page.getByRole('radio', { name: /Dunkel/ }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
