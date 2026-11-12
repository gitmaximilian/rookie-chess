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
	await expect(page.getByText('from learning', { exact: true })).toBeVisible();
	await page.goto('/settings');
	await page.getByRole('radio', { name: 'Deutsch' }).click();
	await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await page.goto('/');
	await expect(page.getByText('beim Lernen', { exact: true })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await page.goto('/settings');
	await page.getByRole('radio', { name: 'English' }).click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('Brettfarbe wirkt auch im Dunkelmodus', async ({ browser }) => {
	const ctx = await browser.newContext({ colorScheme: 'dark' });
	const page = await ctx.newPage();
	await page.goto('/settings');
	await page.getByRole('radio', { name: 'Slate' }).click();
	const bg = () =>
		page
			.locator('cg-board')
			.first()
			.evaluate((el) => getComputedStyle(el).backgroundImage);
	await expect.poll(bg).toContain('rgb(110, 118, 129)');
	await page.getByRole('radio', { name: 'Green' }).click();
	await expect.poll(bg).toContain('rgb(118, 150, 86)');
	// Holz im Dunkelmodus weiterhin gedämpft
	await page.locator('[data-board-preview="wood"]').click();
	await expect.poll(bg).toContain('rgb(167, 122, 81)');
	await ctx.close();
});

test('Einstellungen zeigen die App-Version', async ({ page }) => {
	await page.goto('/settings');
	await expect(page.getByTestId('app-version')).toContainText(/Rookie v\d+\.\d+\.\d+/);
});
