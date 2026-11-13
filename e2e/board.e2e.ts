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

test('Brettbeschriftung: jede Koordinate hebt sich von ihrem Feld ab (a1 dunkel, h1 hell)', async ({
	page
}) => {
	await page.goto('/play/friend');
	await expect(page.locator('coords.files coord')).toHaveCount(8);
	const colors = await page.evaluate(() => {
		const css = getComputedStyle(document.documentElement);
		const probe = document.createElement('span');
		document.body.append(probe);
		const resolve = (v: string) => {
			probe.style.color = css.getPropertyValue(v);
			return getComputedStyle(probe).color;
		};
		const out = {
			onDark: resolve('--sq-coord-dark'),
			onLight: resolve('--sq-coord-light'),
			files: [...document.querySelectorAll('coords.files coord')].map(
				(c) => getComputedStyle(c).color
			),
			ranks: [...document.querySelectorAll('coords.ranks coord')].map(
				(c) => getComputedStyle(c).color
			)
		};
		probe.remove();
		return out;
	});
	// untere Reihe (Weiß unten): a1, c1, e1, g1 dunkel → helle Schrift
	expect(colors.files).toEqual(
		[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i % 2 ? colors.onLight : colors.onDark))
	);
	// rechte Spalte: h1 hell, h2 dunkel …
	expect(colors.ranks).toEqual(
		[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i % 2 ? colors.onDark : colors.onLight))
	);
});
