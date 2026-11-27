import { expect, test } from '@playwright/test';

test('Startseite zeigt Begrüßung, Zusammenfassung und Bereiche', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toContainText(/Good|Hello/);
	// Das Rapid-Ziel führt direkt zum Import, bevor eine Wertung vorliegt.
	await expect(page.getByTestId('tile-week')).toBeVisible();
	await expect(page.getByTestId('tile-strength')).toContainText('Import a rated Rapid game');
	await expect(page.getByTestId('tile-stars')).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Play/ }).first()).toBeVisible();
});

test('Navigation zwischen allen Bereichen', async ({ page, isMobile }) => {
	await page.goto('/');
	const nav = page.getByRole('navigation', { name: 'Main navigation' }).locator('visible=true');
	for (const [label, heading] of [
		['Play', 'Play'],
		['Puzzles', 'Puzzles'],
		['Learn', 'Learn'],
		['Games', 'My games']
	]) {
		await nav.getByRole('link', { name: label }).click();
		await expect(page.locator('h1')).toHaveText(heading);
		await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
	}
	// Coach hängt an Start: über die Wochen-Kachel, Start bleibt aktiv
	await page.goto('/');
	await page.getByTestId('tile-week').click();
	await expect(page.locator('h1')).toHaveText('How you play');
	await expect(nav.getByRole('link', { name: 'Coach' })).toHaveAttribute('aria-current', 'page');
	// Profil hängt am Avatar oben rechts
	await page.goto('/');
	await page.getByRole('link', { name: 'Profile' }).first().click();
	await expect(page.locator('h1')).toHaveText('Profile');
	expect(isMobile !== undefined).toBe(true);
});

test('Coach: Überblick und Statistik, alte Statistik-Adresse leitet weiter', async ({ page }) => {
	await page.goto('/coach');
	await expect(page.getByRole('heading', { name: 'Your focus' })).toBeVisible();
	// Spielerprofil als Fünfeck mit fünf antippbaren Ecken
	await expect(page.getByRole('heading', { name: 'Your skill penta' })).toBeVisible();
	await expect(page.locator('.radar .vertex')).toHaveCount(5);
	await page.getByRole('link', { name: 'Statistics', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Statistics', level: 1 })).toBeVisible();
	await page.goto('/profile/stats');
	await expect(page).toHaveURL(/\/coach\/stats/);
});

test('Seite ist cross-origin-isoliert (Multi-Thread-Stockfish möglich)', async ({ page }) => {
	await page.goto('/');
	expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);
});

test('App startet offline nach dem ersten Besuch', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'Service Worker nur in Playwright-Chromium testbar');
	await page.goto('/');
	await expect(page.locator('[data-testid="home-bento"] .tile').first()).toBeVisible();
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
	await expect(page.getByTestId('tile-week')).toBeVisible();
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

test('Startseite: nach dem Verknüpfen kein Verknüpfen-Hinweis mehr', async ({ page }) => {
	await page.route(/lichess\.org|chess\.com/, (r) => r.abort());
	await page.goto('/');
	await expect(page.locator('[data-testid="home-bento"] .tile').first()).toBeVisible();
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
	await expect(page.locator('[data-testid="home-bento"] .tile').first()).toBeVisible();
	await expect(page.getByText('Link Lichess or Chess.com')).toHaveCount(0);
	await expect(page.getByText('Puzzle of the day')).toHaveCount(0);
	if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
});

test('Tab-Leiste: Tabs füllen die ganze Breite', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'Tab-Leiste nur am Handy');
	await page.goto('/');
	const bar = page.locator('.tabbar');
	const box = (await bar.boundingBox())!;
	const last = (await bar.getByRole('link').last().boundingBox())!;
	expect(box.x + box.width - (last.x + last.width)).toBeLessThan(12);
});
