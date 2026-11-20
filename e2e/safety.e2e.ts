import { expect, test, type Page } from '@playwright/test';
import { fen, playUci } from './helpers/board';

/** eine Blunder-Check-Aufgabe beantworten – egal ob der Zug sicher ist oder nicht */
async function answer(page: Page, which: 'answer-safe' | 'answer-unsafe') {
	await page.getByTestId(which).locator('visible=true').first().click();
	const showMe = page.getByRole('button', { name: 'Show me' }).locator('visible=true').first();
	const next = page.getByTestId('safety-next').locator('visible=true').first();
	await expect(showMe.or(next)).toBeVisible();
	if (await showMe.isVisible()) await showMe.click();
	await expect(next).toBeVisible();
	return next;
}

test('Blunder-Check: Frage, Antwort, Rückmeldung, nächste Aufgabe', async ({ page }) => {
	await page.goto('/puzzles/safety');
	await expect(page.getByRole('heading', { name: 'Is it safe?' })).toBeVisible();
	await expect(
		page
			.getByText(/You plan .+\. Is it safe\?/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	const next = await answer(page, 'answer-unsafe');
	await next.click();
	await expect(page.getByTestId('answer-safe').locator('visible=true').first()).toBeEnabled();
	await (await answer(page, 'answer-safe')).click();
	// Versuche werden gezählt
	await expect(
		page
			.getByText(/\d\/2 right/)
			.locator('visible=true')
			.first()
	).toBeVisible();
});

test('Kontrolltest: 12 Aufgaben mit sofortiger Rückmeldung, dann Ergebnis und Fortschritt im Coach', async ({
	page
}) => {
	test.setTimeout(90_000);
	await page.goto('/puzzles/safety?test=1');
	await expect(page.getByRole('heading', { name: 'Safety check-up' })).toBeVisible();
	for (let i = 0; i < 12; i++) {
		const next = await answer(page, i % 2 ? 'answer-safe' : 'answer-unsafe');
		await expect(
			page
				.getByText(
					/Right – the move is safe|The move was safe after all|Careful – that move loses|Exactly – you found the refutation|Not safe, well sensed/
				)
				.locator('visible=true')
				.first()
		).toBeVisible();
		await next.click();
	}
	const summary = page.getByTestId('checkup-summary');
	await expect(summary).toContainText(/of 12 points/);
	await page.goto('/coach/stats');
	const progress = page.getByTestId('progress-check');
	await expect(progress).toContainText('Is your training working?');
	await expect(progress).toContainText('Check-up');
	await expect(progress).toContainText(/next in 14 days|next in 13 days/);
});

test('Tagesplan: Blunder-Check steht vorn und führt zur Übung', async ({ page }) => {
	await page.goto('/');
	const plan = page.locator('.plan');
	// Einsteiger (noch keine Stärke-Schätzung): erst Brett-Scan, dann ein kürzerer Blunder-Check
	await expect(plan.getByRole('link', { name: /Board scan: 3 positions/ })).toBeVisible();
	const task = plan.getByRole('link', { name: /Blunder check: 4 moves/ });
	await expect(task).toBeVisible();
	await task.click();
	await expect(page).toHaveURL(/puzzles\/safety/);
});

test('Handy: kurzer Titel lässt Platz für die ganze Erklärung', async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto('/puzzles/safety');
	const card = page.getByTestId('safety-bar');
	const text = card.locator('p.text');
	await expect(text).toContainText('Imagine it played:');
	await expect
		.poll(() =>
			text.evaluate((el) => {
				const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
				return {
					lines: Math.round(el.getBoundingClientRect().height / lineHeight),
					fits: el.scrollHeight <= el.clientHeight + 1
				};
			})
		)
		.toEqual({ lines: 2, fits: true });
	await expect(card.getByRole('button', { name: 'More' })).toHaveCount(0);
});

test('Blunder-Check: auf gedrehtem Brett die weiße Widerlegung spielen', async ({
	page,
	hasTouch
}) => {
	await page.route('**/safety/items.json', (route) =>
		route.fulfill({
			json: [
				[
					'gC3KL',
					'1Q5k/6qp/5p2/4pP2/1p6/7P/2r2PP1/6K1 b - - 1 34',
					'g7f8',
					0,
					'b8f8',
					400,
					'hangingPiece',
					''
				]
			]
		})
	);
	await page.goto('/puzzles/safety');
	const board = page.locator('.cg-host');
	await expect(board).toHaveAttribute('data-orientation', 'black');
	const before = await fen(page);
	await playUci(page, 'g7f8', hasTouch ? 'touch' : 'mouse');
	await expect(board).toHaveAttribute('data-fen', before);
	await page.getByTestId('answer-unsafe').locator('visible=true').first().click();
	await expect(board).toHaveAttribute('data-fen', /1Q3q1k.* w /);
	const refute = await fen(page);
	await playUci(page, 'b8b7', hasTouch ? 'touch' : 'mouse');
	await expect(
		page
			.getByText(/Not that one/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await expect(board).toHaveAttribute('data-fen', refute);
	await playUci(page, 'b8b7', hasTouch ? 'touch' : 'mouse');
	await expect(board).toHaveAttribute('data-fen', refute);
	await playUci(page, 'b8f8', hasTouch ? 'touch' : 'mouse');
	await expect(board).toHaveAttribute('data-fen', /5Q1k.* b /);
	await expect(
		page
			.getByText(/you found the refutation/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await expect(page.getByTestId('safety-next').locator('visible=true').first()).toBeVisible();
});

test('Blunder-Check: eine andere, gleich starke Widerlegung zählt auch', async ({
	page,
	hasTouch
}) => {
	test.setTimeout(60_000);
	// Schwarz stellt die Dame auf d4 ein – gespeichert ist ♖xd4, ♘xd4 gewinnt sie genauso
	await page.route('**/safety/items.json', (route) =>
		route.fulfill({
			json: [
				['alt01', '3q3k/8/8/1N6/8/8/8/3RK3 b - - 0 1', 'd8d4', 0, 'd1d4', 400, 'hangingPiece', '']
			]
		})
	);
	await page.goto('/puzzles/safety');
	await page.getByTestId('answer-unsafe').locator('visible=true').first().click();
	await expect(page.locator('.cg-host')).toHaveAttribute('data-fen', /^7k\/8\/8\/1N6\/3q4/);
	await playUci(page, 'b5d4', hasTouch ? 'touch' : 'mouse');
	await expect(
		page
			.getByText(/you found the refutation/)
			.locator('visible=true')
			.first()
	).toBeVisible({ timeout: 30_000 });
});
