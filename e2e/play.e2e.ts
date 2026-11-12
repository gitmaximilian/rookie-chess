import { expect, test } from '@playwright/test';
import { fen, playUci } from './helpers/board';

test('Partie gegen Bauer Bruno: Zug, Antwort, Zurück, Aufgeben', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: /Pawn Pete/ }).click();
	// ohne Coach: dieser Test prüft den reinen Spielablauf
	const coach = page.getByRole('switch', { name: /Play with coach/ });
	await expect(coach).toHaveAttribute('aria-checked', 'true');
	await coach.click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await expect(page.getByText('Your move')).toBeVisible();

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
	await expect(page.getByText('Your move')).toBeVisible();

	// Zurück
	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(page.locator('.moves')).toContainText('No moves yet');

	// Aufgeben
	await page.mouse.click(at(3, 1).x, at(3, 1).y);
	await page.mouse.click(at(3, 3).x, at(3, 3).y);
	await expect(page.locator('.moves .row').first().locator('.mv')).toHaveCount(2, {
		timeout: 15000
	});
	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: /Resign/ }).click();
	await expect(page.getByRole('dialog', { name: 'Result' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'You lost' })).toBeVisible();
});

test('Zug zurück und vor: nur ansehen, dann wieder zur aktuellen Stellung', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: /Pawn Pete/ }).click();
	const coach = page.getByRole('switch', { name: /Play with coach/ });
	await expect(coach).toHaveAttribute('aria-checked', 'true');
	await coach.click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await expect(page.getByText('Your move')).toBeVisible();
	await playUci(page, 'e2e4');
	// erst weiter, wenn der Bot geantwortet hat (ein neuer Zug bringt sonst zurück zur aktuellen Stellung)
	await expect(page.locator('.moves .row').first().locator('.mv')).toHaveCount(2, {
		timeout: 15000
	});
	await expect(page.getByText('Your move')).toBeVisible();
	const live = await fen(page);

	await page.getByRole('button', { name: 'Previous move' }).click();
	await expect(page.getByText('Move 1/2')).toBeVisible();
	expect(await fen(page)).not.toBe(live);
	await page.getByRole('button', { name: 'Previous move' }).click();
	expect(await fen(page)).toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR/);

	await page.getByRole('button', { name: 'Next move' }).click();
	await page.getByRole('button', { name: 'Next move' }).click();
	expect(await fen(page)).toBe(live);
	await expect(page.getByText('Your move')).toBeVisible();
});
