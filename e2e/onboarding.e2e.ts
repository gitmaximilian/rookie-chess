import { expect, test } from '@playwright/test';

test.use({
	storageState: {
		cookies: [],
		origins: [
			{
				origin: 'http://localhost:4173',
				localStorage: [{ name: 'rookie:installDismissed', value: '9999999999999' }]
			}
		]
	}
});

test('Einstieg: Regeln unbekannt → direkt zu den Grundlagen', async ({ page }) => {
	await page.goto('/');
	const ob = page.getByRole('dialog', { name: 'Welcome to Rookie' });
	await expect(ob).toBeVisible();
	await ob.getByRole('button', { name: /Not yet/ }).click();
	// keine Frage nach der Spielstärke
	await expect(ob.getByText('What would you like to do first?')).toBeVisible();
	await ob.getByRole('button', { name: /Play games/ }).click();
	await expect(page).toHaveURL(/\/learn\/basics/);
	await page.reload();
	await expect(ob).toBeHidden();
});

test('Einstieg: erfahren + Taktik → Puzzles mit höherem Start-Rating', async ({ page }) => {
	await page.goto('/');
	const ob = page.getByRole('dialog', { name: 'Welcome to Rookie' });
	await ob.getByRole('button', { name: /^Yes/ }).click();
	await ob.getByRole('button', { name: /Experienced/ }).click();
	await ob.getByRole('button', { name: /Get better at tactics/ }).click();
	await expect(ob.getByText('Do you play on Lichess or Chess.com?')).toBeVisible();
	await ob.getByRole('button', { name: /don’t play online/ }).click();
	await expect(page).toHaveURL(/\/puzzles/);
	await page.goto('/profile');
	await expect(page.getByText('1300?')).toBeVisible();
});

test('Einstieg überspringen', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Skip' }).click();
	await expect(page.getByRole('dialog', { name: 'Welcome to Rookie' })).toBeHidden();
	await page.reload();
	await page.waitForTimeout(800);
	await expect(page.getByRole('dialog', { name: 'Welcome to Rookie' })).toBeHidden();
});

test('Einstieg: Lichess verknüpfen → Partien und Elo auf der Startseite', async ({ page }) => {
	await page.route('https://lichess.org/api/games/user/**', (route) =>
		route.fulfill({
			status: 200,
			headers: { 'access-control-allow-origin': '*', 'content-type': 'application/x-ndjson' },
			body:
				[1, 2, 3]
					.map((i) =>
						JSON.stringify({
							id: 'ob' + i,
							variant: 'standard',
							speed: 'blitz',
							createdAt: Date.now() - i * 3_600_000,
							players: {
								white: { user: { name: 'me' }, rating: 1500 + i },
								black: { user: { name: 'opp' + i }, rating: 1500 }
							},
							pgn: `[White "me"]\n[Black "opp${i}"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`
						})
					)
					.join('\n') + '\n'
		})
	);
	await page.goto('/');
	const ob = page.getByRole('dialog', { name: 'Welcome to Rookie' });
	await ob.getByRole('button', { name: /^Yes/ }).click();
	await ob.getByRole('button', { name: /I win sometimes/ }).click();
	await ob.getByRole('button', { name: /Play games/ }).click();
	await ob.getByPlaceholder('Lichess username').fill('me');
	await ob.getByRole('button', { name: 'Link and start' }).click();
	await expect(page).toHaveURL(/\/play/);
	await page.goto('/');
	const mine = page.locator('.mine');
	await expect(mine.getByText('vs opp1')).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('.sum')).toContainText('1501');
});
