import { expect, test } from '@playwright/test';
import { fen, playUci } from './helpers/board';

// Am Handy steht der Kommentar über dem Brett (CommentBar), am Desktop in der Seitenspalte:
// Tests suchen deshalb den sichtbaren Text, egal an welcher Stelle.

const LEGAL = `[White "Legal"]
[Black "Saint Brie"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

test('PGN analysieren: Patzer wird erkannt und erklärt', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto('/analysis');
	await page.locator('textarea').fill(LEGAL);
	await page.getByRole('button', { name: 'Analyse' }).click();
	await expect(page).toHaveURL(/analysis\?game=\d+/);
	await expect(page.locator('.summary')).toBeVisible({ timeout: 60_000 });
	await page.locator('.moves-card').getByRole('button', { name: /xd1/ }).click();
	// Abzeichen am Brett und Kommentar in der Besprechungskarte
	await expect(page.locator('.sq-badge')).toHaveAttribute('aria-label', 'Blunder');
	await expect(page.locator('.rp .head')).toContainText('is a blunder');
	await expect(
		page
			.getByText(/Allowed mate/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	// Live-Engine: mehrere Kandidatenzüge
	await expect(page.locator('.rp .line:not(.ph)').first()).toBeVisible({ timeout: 30_000 });
	// Tastatur-Navigation
	await page.keyboard.press('Home');
	await expect(page.getByText('Starting position').locator('visible=true').first()).toBeVisible();
	// Partie erscheint in der Liste
	await page.getByRole('main').getByRole('link', { name: 'Games' }).click();
	await expect(
		page
			.locator('.gli .name')
			.getByText('Saint Brie', { exact: true })
			.locator('visible=true')
			.first()
	).toBeVisible();
	// Coach: zeigt, wie viele Partien ins Profil einfließen
	await page.goto('/coach');
	await expect(
		page.getByText('1 of 1 game analysed').locator('visible=true').first()
	).toBeVisible();
});

test('Weiterklicken in der Analyse scrollt die Seite nicht und das Brett springt nicht', async ({
	page
}) => {
	await page.goto('/analysis');
	await page
		.locator('textarea')
		.fill(
			'1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Re8 11. Nf1 Be6 12. Ng3 Bxb3 13. Qxb3 Qd7 14. Be3 Bxe3 15. Rxe3 Rab8 16. Rae1 b5 17. d4 exd4 18. cxd4 Nb4 19. a3 Nc6 20. d5 Ne5 *'
		);
	await page.getByRole('button', { name: 'Analyse', exact: true }).click();
	const next = page.getByRole('button', { name: 'Forward', exact: true });
	await expect(next).toBeVisible();
	await page.evaluate(() => window.scrollTo(0, 0));
	const board = page.locator('.cg-host').first();
	// schon ab der Startstellung und während die Analyse noch läuft (früher fehlte die Leiste dann)
	await page.waitForTimeout(300);
	const start = await board.boundingBox();
	const boxes = new Set<string>();
	for (let i = 0; i < 30; i++) {
		await next.click();
		const b = (await board.boundingBox())!;
		boxes.add(`${Math.round(b.y)}:${Math.round(b.width)}`);
	}
	await page.waitForTimeout(600);
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
	// Brett bleibt gleich groß und an derselben Stelle (früher sprang es mit der Kommentarlänge)
	expect([...boxes]).toEqual([`${Math.round(start!.y)}:${Math.round(start!.width)}`]);
});

test('Analyse: bei einem Fehler zeigt das Brett den gespielten (rot) und den besseren Zug (grün)', async ({
	page
}) => {
	test.setTimeout(90_000);
	await page.goto('/analysis');
	await page.locator('textarea').fill(LEGAL);
	await page.getByRole('button', { name: 'Analyse' }).click();
	await expect(page.locator('.summary')).toBeVisible({ timeout: 60_000 });
	await page.locator('.moves-card').getByRole('button', { name: /xd1/ }).click();
	// chessground zeichnet Pfeile als SVG-Linien mit der Pinselfarbe
	// chessground zeichnet im nächsten Frame – auf die neuen Farben warten
	const arrows = page.locator('.cg-host svg.cg-shapes line');
	await expect
		.poll(async () =>
			(await arrows.evaluateAll((ls) => ls.map((l) => l.getAttribute('stroke')))).sort()
		)
		.toEqual(['#2b9a66', '#d64545']);
	// Partie-Bewertung mit Einordnung, Wendepunkt und Lernpunkt
	const report = page.getByTestId('game-report');
	await expect(report).toBeVisible();
	await expect(report).toContainText('Turning point');
	await expect(report).toContainText(/accuracy typical of|too short/);
});

test('Erst du: eigene Fehler markieren, auflösen, dann nachspielen', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto('/analysis');
	await page.locator('textarea').fill('1. f3 e5 2. g4 Qh4# 0-1');
	await page.getByRole('button', { name: 'Analyse', exact: true }).click();
	await expect(page).toHaveURL(/analysis\?game=\d+/);
	const id = new URL(page.url()).searchParams.get('game');
	// wie aus dem Tagesplan
	await page.goto(`/analysis?game=${id}&retry=1`);
	const panel = page.getByTestId('self-review');
	await expect(panel).toBeVisible();
	// keine Bewertungen sichtbar, solange man selbst sucht
	await expect(page.locator('.sq-badge')).toHaveCount(0);
	const fwd = page.getByRole('button', { name: 'Forward', exact: true }).locator('visible=true');
	await fwd.first().click();
	await fwd.first().click();
	await fwd.first().click(); // 2. g4
	await page.getByTestId('mark-move').locator('visible=true').first().click();
	await expect(panel).toContainText('2. g4');
	const mark = page.getByTestId('mark-move').locator('visible=true').first();
	await expect(mark).toHaveText('Unmark');
	await mark.click();
	await expect(panel).not.toContainText('2. g4');
	await mark.click();
	await expect(page.getByText('1/3 marked')).toBeVisible();
	const resolveBtn = page.getByTestId('resolve').locator('visible=true').first();
	await expect(resolveBtn).toBeEnabled({ timeout: 60_000 });
	await resolveBtn.click();
	await expect(
		page
			.getByText(/You found 1 of 1 mistakes yourself/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await expect(page.getByTestId('self-review-counts')).toHaveText('1 found · 0 missed · 0 extra');
	await page.getByTestId('self-review-next').locator('visible=true').first().click();
	await expect(
		page
			.getByText(/Mistake 1 of 1/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Exit', exact: true })
		.locator('visible=true')
		.first()
		.click();
	await expect(page.getByTestId('self-review')).toHaveCount(0);
	await expect(page.getByText(/Mistake 1 of 1/).locator('visible=true')).toHaveCount(0);
	await expect(page.locator('.moves-card')).toContainText('g4');
});

test('Partieanalyse: eigene Variante spielen und zur unveränderten Partie zurück', async ({
	page
}) => {
	await page.goto('/analysis');
	await page.locator('textarea').fill('1. e4 e5 2. Nf3 Nc6 *');
	await page.getByRole('button', { name: 'Analyse', exact: true }).click();
	const next = page.getByRole('button', { name: 'Forward', exact: true });
	await next.click();
	const original = await fen(page);

	await playUci(page, 'c7c5');
	const back = page.getByRole('button', { name: 'Back to original game' });
	await expect(back).toBeVisible();
	await expect(page.locator('.moves-card')).toContainText('c5');
	await playUci(page, 'g1f3');
	await expect.poll(() => fen(page)).toMatch(/ b /);

	await back.click();
	await expect.poll(() => fen(page)).toBe(original);
	await expect(page.locator('.moves-card')).toContainText('e5');
	await expect(page.locator('.moves-card')).not.toContainText('c5');

	await playUci(page, 'e7e5');
	await expect(back).toHaveCount(0);
	await expect.poll(() => fen(page)).toMatch(/ w /);
});

test('Erst du: eine Partie ohne grobe Fehler lässt sich auflösen', async ({ page }) => {
	await page.goto('/analysis');
	await page.locator('textarea').fill('1. e4 *');
	await page.getByRole('button', { name: 'Analyse', exact: true }).click();
	await expect(page).toHaveURL(/analysis\?game=\d+/);
	const id = new URL(page.url()).searchParams.get('game');
	await page.goto(`/analysis?game=${id}&retry=1`);
	const reveal = page.getByTestId('resolve').locator('visible=true').first();
	await expect(reveal).toBeEnabled({ timeout: 30_000 });
	await reveal.click();
	await expect(
		page
			.getByText('No serious mistakes in this game – well played!')
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page.getByTestId('self-review-next').locator('visible=true').first().click();
	await expect(page.getByTestId('self-review')).toHaveCount(0);
});
