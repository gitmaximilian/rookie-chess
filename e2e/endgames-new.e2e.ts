import { expect, test } from '@playwright/test';
import { fen, playUci } from './helpers/board';

for (const id of ['kqkp', 'krkp', 'kbbk'])
	test(`Endspiel ${id} mit Tablebase-Zügen lösbar`, async ({ page, browserName }) => {
		test.skip(browserName !== 'chromium', 'Netzwerk-lastig, einmal reicht');
		test.setTimeout(180_000);
		await page.goto(`/learn/endgame?id=${id}`);
		await expect(page.getByText(/Technique · step 1 of 4/)).toBeVisible();
		for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Next/ }).click();
		await page.getByRole('button', { name: /Try it yourself/ }).click();
		for (let i = 0; i < 32; i++) {
			if (await page.getByText('Lesson complete!').isVisible()) break;
			await expect(page.getByText(/Your move/)).toBeVisible({ timeout: 15_000 });
			const f = await fen(page);
			const best = await page.evaluate(
				async (x) =>
					(
						await (
							await fetch('https://tablebase.lichess.ovh/standard?fen=' + encodeURIComponent(x))
						).json()
					).moves[0].uci as string,
				f
			);
			await playUci(page, best);
			await page.waitForTimeout(700);
		}
		await expect(page.getByText('Lesson complete!')).toBeVisible({ timeout: 15_000 });
	});
