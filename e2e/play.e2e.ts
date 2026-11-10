import { expect, test } from '@playwright/test';

test('Partie gegen Bauer Bruno: Zug, Antwort, Zurück, Aufgeben', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: /Bauer Bruno/ }).click();
	await page.getByRole('button', { name: 'Partie starten' }).click();
	await expect(page.getByText('Du bist am Zug')).toBeVisible();

	const board = page.locator('.cg-host');
	const box = (await board.boundingBox())!;
	const sq = box.width / 8;
	const at = (file: number, rank: number) => ({
		x: box.x + (file + 0.5) * sq,
		y: box.y + (7 - rank + 0.5) * sq
	});
	// e2 → e4
	await page.mouse.click(at(4, 1).x, at(4, 1).y);
	await page.mouse.click(at(4, 3).x, at(4, 3).y);
	await expect(page.locator('.moves')).toContainText('e4');
	// Bot antwortet
	await expect(page.locator('.moves .row').first().locator('.mv')).toHaveCount(2, {
		timeout: 15000
	});
	await expect(page.getByText('Du bist am Zug')).toBeVisible();

	// Zurück
	await page.getByRole('button', { name: /Zurück/ }).click();
	await expect(page.locator('.moves')).toContainText('Noch keine Züge');

	// Aufgeben
	await page.mouse.click(at(3, 1).x, at(3, 1).y);
	await page.mouse.click(at(3, 3).x, at(3, 3).y);
	await expect(page.locator('.moves .row').first().locator('.mv')).toHaveCount(2, {
		timeout: 15000
	});
	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: /Aufgeben/ }).click();
	await expect(page.getByRole('dialog', { name: 'Ergebnis' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Verloren' })).toBeVisible();
});
