import { expect, test } from '@playwright/test';

const PGN = (r: string) => `[Event "Rated Blitz game"]
[White "me"]
[Black "opp"]
[Result "${r}"]
[WhiteRatingDiff "+4"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 ${r}`;

test('Statistik zeigt Ergebnisse, Wertungsverlauf und Eröffnungen', async ({ page }) => {
	const games = [
		['g1', '1-0', 1500, 1450, 1],
		['g2', '0-1', 1510, 1600, 2],
		['g3', '1/2-1/2', 1505, 1500, 3]
	].map(([id, r, me, opp, d]) =>
		JSON.stringify({
			id,
			variant: 'standard',
			speed: 'blitz',
			createdAt: 1_700_000_000_000 + (d as number) * 86_400_000,
			players: {
				white: { user: { name: 'me' }, rating: me },
				black: { user: { name: 'opp' }, rating: opp }
			},
			pgn: PGN(r as string)
		})
	);
	await page.route('https://lichess.org/api/games/user/**', (route) =>
		route.fulfill({
			status: 200,
			headers: { 'access-control-allow-origin': '*', 'content-type': 'application/x-ndjson' },
			body: games.join('\n') + '\n'
		})
	);
	await page.goto('/import');
	await page.getByLabel('Lichess Username').fill('me');
	await page.getByRole('button', { name: 'Link', exact: true }).first().click();
	await expect(page.getByText(/Last synced/)).toBeVisible();

	await page.goto('/coach');
	await page.getByRole('link', { name: 'Statistics', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Statistics', level: 1 })).toBeVisible();
	await expect(page.getByText('3 games').first()).toBeVisible();
	await expect(page.getByText('50% score').first()).toBeVisible();
	// Wertung nach der letzten Partie (Lichess: vorher + RatingDiff)
	await expect(page.locator('.rh .cur')).toHaveText('1509');
	await expect(page.getByText('Peak').first()).toBeVisible();
	await expect(page.getByText('Italian Game').first()).toBeVisible();

	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /Games \(CSV\)/ }).click();
	expect((await dl).suggestedFilename()).toMatch(/^rookie-games-.*\.csv$/);
});
