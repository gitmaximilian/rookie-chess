import { expect, test } from '@playwright/test';
import { fen, playUci } from './helpers/board';

test('Analysebrett: beide Farben ziehen, Stockfish rechnet live, Variante spielen, PGN laden', async ({
	page
}) => {
	test.setTimeout(90_000);
	await page.goto('/analysis');
	await page
		.getByRole('link', { name: /Analysis board/ })
		.first()
		.click();
	await expect(page).toHaveURL(/analysis\/board/);

	await playUci(page, 'e2e4');
	await expect.poll(() => fen(page)).toMatch(/ b KQkq/);
	await playUci(page, 'e7e5'); // Schwarz zieht ebenfalls selbst
	await expect.poll(() => fen(page)).toContain('4p3/4P3');
	await expect(page.locator('.pv').first()).toBeVisible({ timeout: 30_000 });
	await expect(page.locator('.e-depth')).toContainText(/depth [1-9]/);

	// erste Engine-Variante spielen → Weiß hat gezogen
	await page.locator('.pv').first().click();
	await expect.poll(() => fen(page)).toMatch(/ b KQkq/);
	// zurückblättern
	await page.getByRole('button', { name: 'Back' }).click();
	await expect.poll(() => fen(page)).toMatch(/ w KQkq/);

	// Engine ausschalten
	await page.getByRole('switch', { name: /Stockfish/ }).click();
	await expect(page.locator('.pv')).toHaveCount(0);

	// PGN laden
	await page.getByRole('button', { name: /Load FEN\/PGN/ }).click();
	await page.locator('textarea').fill('1. d4 d5 2. c4 e6');
	await page.getByRole('button', { name: 'Load', exact: true }).click();
	await expect.poll(() => fen(page)).toContain('PP2PPPP');
	await expect(page.locator('.opening')).toContainText(/Queen/);
});
