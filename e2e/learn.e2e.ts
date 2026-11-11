import { expect, test } from '@playwright/test';
import { fen, playUci } from './helpers/board';

test('Lernen-Hub zeigt Endspiele und Eröffnungen', async ({ page }) => {
	await page.goto('/learn');
	await expect(page.getByRole('heading', { name: 'Endgames' })).toBeVisible();
	await expect(page.getByText('Ladder mate')).toBeVisible();
	await expect(
		page.getByText('Opening trainer').or(page.getByText('Openings')).first()
	).toBeVisible();
});

test('Treppenmatt mit Tablebase-Zügen lösen → Sterne', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'Netzwerk-lastig, einmal reicht');
	test.setTimeout(120_000);
	await page.goto('/learn/endgame?id=kkrr');
	await expect(page.getByText(/Your move/)).toBeVisible();
	for (let i = 0; i < 12; i++) {
		if (await page.getByText('Lesson complete!').isVisible()) break;
		await expect(page.getByText(/Your move/)).toBeVisible({ timeout: 15_000 });
		const f = await fen(page);
		const res = await page.evaluate(
			async (x) =>
				(
					await (
						await fetch('https://tablebase.lichess.ovh/standard?fen=' + encodeURIComponent(x))
					).json()
				).moves[0].uci as string,
			f
		);
		await playUci(page, res);
		await page.waitForTimeout(700);
	}
	await expect(page.getByText('Lesson complete!')).toBeVisible({ timeout: 15_000 });
	await page.goto('/learn');
	await expect(page.locator('.lesson.done')).toHaveCount(1);
});
