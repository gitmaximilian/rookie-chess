import { expect, test } from '@playwright/test';
import { playUci } from './helpers/board';

test('Brett-Scan: hängende Figuren antippen, auflösen, nächste Stellung', async ({ page }) => {
	await page.goto('/puzzles/scan?mode=hanging');
	await expect(page.getByRole('heading', { name: 'Board scan' })).toBeVisible();
	await expect(
		page
			.getByText(/Tap every hanging piece/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page.getByTestId('scan-done').locator('visible=true').first().click();
	await expect(
		page
			.getByText(/of \d+ found/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page.getByTestId('scan-next').locator('visible=true').first().click();
	await expect(page.getByTestId('scan-done').locator('visible=true').first()).toBeVisible();
});

test('Brett-Scan: Modus wechseln – Gegner-Sicht ist der Blunder-Check', async ({ page }) => {
	await page.goto('/puzzles/scan');
	await page
		.getByRole('button', { name: 'OPPONENT' })
		.or(page.getByRole('button', { name: 'Opponent' }))
		.first()
		.click();
	await expect(
		page
			.getByText(/What can your opponent do\?/)
			.locator('visible=true')
			.first()
	).toBeVisible();
});

test('Handy: Board-Scan zeigt nur ganze Zeilen und öffnet den vollständigen Text', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto('/puzzles/scan?mode=opponent');
	const card = page.getByTestId('scan-bar');
	await expect(card).toContainText('What can your opponent do?');
	const more = card.getByRole('button', { name: 'More' });
	await expect(more).toBeVisible();
	const wholeLines = await card.locator('p').evaluateAll((paragraphs) =>
		paragraphs.every((el) => {
			const height = el.getBoundingClientRect().height;
			const line = Number.parseFloat(getComputedStyle(el).lineHeight);
			return height >= line - 1 && Math.abs(height - Math.round(height / line) * line) < 1;
		})
	);
	expect(wholeLines).toBe(true);
	await more.click();
	const sheet = page.getByRole('dialog');
	await expect(sheet).toContainText('What can your opponent do?');
	await expect(sheet).toContainText('This is the blunder check');
});

test('Tagesziel im Scan zählt Auflösungen, bleibt nach Neuladen und beginnt am neuen Tag bei null', async ({
	page
}) => {
	await page.clock.setFixedTime(new Date(2026, 10, 17, 12));
	await page.goto('/puzzles/scan');
	const progress = page.getByTestId('daily-task-progress');
	const done = page.getByTestId('scan-done').locator('visible=true').first();
	const next = page.getByTestId('scan-next').locator('visible=true').first();
	await expect(progress).toHaveText('Today: 0 of 3');
	await done.click();
	await expect(progress).toHaveText('Today: 1 of 3');
	await page.reload();
	await expect(progress).toHaveText('Today: 1 of 3');
	await done.click();
	await expect(progress).toHaveText('Today: 2 of 3');
	await next.click();
	const board = page.locator('.cg-host');
	const before = await board.boundingBox();
	await done.click();
	await expect(progress).toHaveText('Done for today');
	expect((await board.boundingBox())?.width).toBe(before?.width);
	await next.click();
	await expect(done).toBeVisible();
	await page.clock.setFixedTime(new Date(2026, 10, 18, 12));
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
	await expect(progress).toHaveText('Today: 0 of 3');
});

test('Gegner-Scan: auf der Fotostellung wird nur der übersehene Schlag rot markiert', async ({
	page,
	hasTouch
}) => {
	await page.route('**/safety/items.json', (route) =>
		route.fulfill({
			json: [
				[
					'photo',
					'r1br2k1/1p2bppp/2B5/6B1/P3p3/5N2/1PP2PPP/R3K2R b KQ - 0 1',
					'g8h8',
					1,
					'',
					400,
					'hangingPiece',
					''
				]
			]
		})
	);
	await page.goto('/puzzles/scan?mode=opponent');
	const resultText = (text: string | RegExp) =>
		page.getByText(text).locator('visible=true').first();
	await expect(resultText(/0\/3/)).toBeVisible();
	const input = hasTouch ? 'touch' : 'mouse';
	await playUci(page, 'c6b7', input);
	await expect(resultText(/1\/3/)).toBeVisible();
	await playUci(page, 'c6e4', input);
	await expect(resultText(/2\/3/)).toBeVisible();
	await page.getByTestId('scan-done').locator('visible=true').first().click();
	await expect(resultText(/2 of 3 found/)).toBeVisible();
	await expect(page.locator('.cg-host svg.cg-shapes line[stroke="#d64545"]')).toHaveCount(1);
});
