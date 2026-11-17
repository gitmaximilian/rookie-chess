import { expect, test, type Locator } from '@playwright/test';
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

for (const example of [
	{
		side: 'w',
		pieces: 'cburnett',
		theme: 'dark',
		fen: '8/P3k3/8/8/8/8/8/4K3 w - - 0 1',
		uci: 'a7a8',
		board: /^N7/
	},
	{
		side: 'b',
		pieces: 'merida',
		theme: 'light',
		fen: '4k3/8/8/8/8/8/p3K3/8 b - - 0 1',
		uci: 'a2a1',
		board: /\/n7 w /
	}
]) {
	test(`Umwandlung auf 320 px: ${example.side}, ${example.pieces}, ${example.theme}`, async ({
		page,
		hasTouch
	}) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await page.addInitScript(({ pieces, theme }) => {
			localStorage.setItem('rookie:board', JSON.stringify({ pieces }));
			localStorage.setItem('rookie:theme', theme);
		}, example);
		await page.goto('/analysis/board?fen=' + encodeURIComponent(example.fen));
		await expect.poll(() => fen(page)).toBe(example.fen);
		const input = hasTouch ? 'touch' : 'mouse';
		await playUci(page, example.uci, input);
		const dialog = page.getByRole('dialog', { name: 'Choose promotion' });
		await expect(dialog).toBeVisible();
		await dialog.evaluate((el) => Promise.allSettled(el.getAnimations().map((a) => a.finished)));
		const art = await dialog.locator('piece').evaluateAll((elements) =>
			elements.map((piece) => ({
				width: piece.getBoundingClientRect().width,
				color: piece.classList.contains('white') ? 'w' : 'b',
				background: getComputedStyle(piece).backgroundImage
			}))
		);
		expect(art).toHaveLength(4);
		for (const piece of art) {
			expect(piece.width).toBeGreaterThanOrEqual(32);
			expect(piece.color).toBe(example.side);
			if (example.pieces === 'cburnett') expect(piece.background).toContain('data:image/svg+xml');
			else expect(piece.background).toContain('/pieces/' + example.pieces + '/' + example.side);
		}
		async function pressVisible(button: Locator) {
			await expect(button).toBeInViewport({ ratio: 1 });
			const box = (await button.boundingBox())!;
			const click = hasTouch
				? page.touchscreen.tap.bind(page.touchscreen)
				: page.mouse.click.bind(page.mouse);
			await click(box.x + box.width / 2, box.y + box.height / 2);
		}
		await pressVisible(dialog.getByRole('button', { name: 'Cancel' }));
		await expect(dialog).toHaveCount(0);
		expect(await fen(page)).toBe(example.fen);
		await playUci(page, example.uci, input);
		await expect(dialog).toBeVisible();
		await dialog.evaluate((el) => Promise.allSettled(el.getAnimations().map((a) => a.finished)));
		await pressVisible(dialog.getByRole('button', { name: 'Knight' }));
		await expect.poll(() => fen(page)).toMatch(example.board);
	});
}
