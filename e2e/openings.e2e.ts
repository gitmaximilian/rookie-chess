import { expect, test } from '@playwright/test';
import { fen, playUci } from './helpers/board';

test('Start-Repertoire hinzufügen und trainieren', async ({ page }) => {
	await page.goto('/learn/openings');
	const italian = page.locator('.starter', { hasText: 'Italian Game' });
	await italian.getByRole('button', { name: /Add/ }).click();
	await expect(italian.getByText('Added')).toBeVisible();
	await expect(page.locator('.side.white .meta')).toContainText('in your repertoire');

	await page.locator('.side.white').getByRole('button', { name: /Train/ }).click();
	await expect(page.getByText('Play your repertoire move')).toBeVisible();

	// Richtiger Zug aus dem Repertoire: in der Startstellung 1.e4
	const f = await fen(page);
	if (f.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')) {
		await playUci(page, 'e2e4');
		await expect(page.getByText(/Correct!|Line complete!|Play your repertoire move/)).toBeVisible();
	} else {
		// falscher Zug → Korrektur
		await playUci(page, 'a2a3');
		await expect(page.getByText(/Your repertoire says/)).toBeVisible();
	}
});

test('Editor: eigenen Zug anlegen, Eröffnungsname erscheint', async ({ page }) => {
	await page.goto('/learn/openings');
	// Seite ist vorgerendert: Klick erst wirksam, wenn Svelte hydriert hat
	await expect(async () => {
		await page.locator('.side.black').getByRole('button', { name: /Edit/ }).click();
		await expect(page.locator('.cg-host').first()).toBeVisible({ timeout: 1000 });
	}).toPass();
	await playUci(page, 'e2e4');
	await playUci(page, 'c7c5');
	await expect(page.locator('.opening')).toContainText('Sicilian');
	await page
		.getByRole('button', { name: /Start|toStart|Back to start/ })
		.first()
		.click();
	await expect(page.locator('.node')).toHaveCount(1);
	await expect(page.locator('.node').first()).toContainText('opponent');
});
