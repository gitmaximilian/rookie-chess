import { expect, test } from '@playwright/test';

test('Startseite zeigt Begrüßung, Zusammenfassung und Bereiche', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toContainText(/Good|Hello/);
	await expect(page.getByText('unlocked', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: /Play/ }).first()).toBeVisible();
});

test('Navigation zwischen allen Bereichen', async ({ page, isMobile }) => {
	await page.goto('/');
	const nav = page.getByRole('navigation', { name: 'Main navigation' }).locator('visible=true');
	for (const [label, heading] of [
		['Play', 'Play'],
		['Puzzles', 'Puzzles'],
		['Learn', 'Learn'],
		['Profile', 'Profile']
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
	await expect(page.locator('section.sum .tile').first()).toBeVisible();
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
	await expect(page.getByText('unlocked', { exact: true })).toBeVisible();
	await context.setOffline(false);
});

test('Impressum verweist auf maximilianauer.at', async ({ page }) => {
	await page.goto('/profile');
	await expect(page.getByRole('link', { name: /Legal notice/ }).first()).toHaveAttribute(
		'href',
		'https://maximilianauer.at/legal/'
	);
});

test('Unterseiten mit Parametern funktionieren auch über den Service Worker', async ({
	page,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'Service Worker nur in Playwright-Chromium testbar');
	await page.goto('/learn');
	await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
	await page.waitForFunction(async () => (await caches.keys()).length > 0);
	await page.goto('/learn/endgame?id=kqk');
	await expect(page.getByRole('heading', { name: 'Mate with the queen' })).toBeVisible();
	await expect(page.locator('.cg-host')).toBeVisible();
});

test('Startseite zeigt nur verknüpfte Konten', async ({ page }) => {
	await page.route(/lichess\.org|chess\.com/, (r) => r.abort());
	await page.goto('/');
	await expect(page.locator('section.sum .tile').first()).toBeVisible();
	await page.evaluate(
		() =>
			new Promise<void>((res, rej) => {
				const req = indexedDB.open('rookie');
				req.onsuccess = () => {
					const tx = req.result.transaction('settings', 'readwrite');
					tx.objectStore('settings').put({
						key: 'linkedAccounts',
						value: { lichess: 'testuser', lastSync: { lichess: Date.now() } },
						t: Date.now()
					});
					tx.oncomplete = () => res();
					tx.onerror = () => rej(tx.error);
				};
			})
	);
	await page.reload();
	const sum = page.locator('section.sum');
	await expect(sum.getByText('Lichess')).toBeVisible();
	await expect(sum.getByText('Chess.com')).toHaveCount(0);
	await expect(page.getByText('Puzzle of the day')).toHaveCount(0);
	if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
});
