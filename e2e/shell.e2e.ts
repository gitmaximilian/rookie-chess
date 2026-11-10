import { expect, test } from '@playwright/test';

test('Startseite zeigt Begrüßung, Hero und Bereiche', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toContainText(/Guten|Hallo/);
	await expect(page.getByText('Puzzle des Tages')).toBeVisible();
	await expect(page.getByRole('link', { name: /Spielen/ }).first()).toBeVisible();
});

test('Navigation zwischen allen Bereichen', async ({ page, isMobile }) => {
	await page.goto('/');
	const nav = page.getByRole('navigation', { name: 'Hauptnavigation' }).locator('visible=true');
	for (const [label, heading] of [
		['Spielen', 'Spielen'],
		['Puzzles', 'Puzzles'],
		['Lernen', 'Lernen'],
		['Profil', 'Profil']
	]) {
		await nav.getByRole('link', { name: label }).click();
		await expect(page.locator('h1')).toHaveText(heading);
		await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
	}
	expect(isMobile !== undefined).toBe(true);
});

test('Seite ist cross-origin-isoliert (Multi-Thread-Stockfish möglich)', async ({ page }) => {
	await page.goto('/');
	expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);
});

test('App startet offline nach dem ersten Besuch', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'Service Worker nur in Playwright-Chromium testbar');
	await page.goto('/');
	await page.evaluate(async () => {
		const reg = await navigator.serviceWorker.ready;
		return reg.active?.state;
	});
	// warten bis der Precache fertig ist
	await page.waitForFunction(async () => (await caches.keys()).length > 0);
	await context.setOffline(true);
	await page.goto('/puzzles');
	await expect(page.locator('h1')).toHaveText('Puzzles');
	await page.goto('/');
	await expect(page.getByText('Puzzle des Tages')).toBeVisible();
	await context.setOffline(false);
});

test('Impressum & Datenschutz ist erreichbar', async ({ page }) => {
	await page.goto('/profile');
	await page
		.getByRole('link', { name: /Impressum/ })
		.first()
		.click();
	await expect(page.locator('h1')).toHaveText('Impressum & Datenschutz');
	await expect(page.getByRole('heading', { name: /Offenlegung/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible();
});
