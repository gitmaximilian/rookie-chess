import { expect, test } from '@playwright/test';

// Am Handy steht der Kommentar über dem Brett (CommentBar), am Desktop in der Seitenspalte:
// Tests suchen deshalb den sichtbaren Text, egal an welcher Stelle.

const PGN = `[White "alice"]
[Black "rookietester"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

test('Aus eigener Partie lernen: Fehler nachspielen', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'Engine-lastig, einmal reicht');
	test.setTimeout(150_000);
	await page.route('https://lichess.org/api/games/user/**', (route) =>
		route.fulfill({
			status: 200,
			headers: { 'access-control-allow-origin': '*', 'content-type': 'application/x-ndjson' },
			body:
				JSON.stringify({
					id: 'legal2',
					variant: 'standard',
					createdAt: Date.now(),
					players: {
						white: { user: { name: 'alice' } },
						black: { user: { name: 'rookietester' } }
					},
					pgn: PGN
				}) + '\n'
		})
	);
	await page.goto('/import');
	await page.getByLabel('Username', { exact: true }).fill('rookietester');
	await page.getByRole('button', { name: /Import games/ }).click();
	await expect(
		page
			.getByText(/1 new game imported/)
			.locator('visible=true')
			.first()
	).toBeVisible({ timeout: 120_000 });

	await page.getByRole('link', { name: /View games/ }).click();
	await page.locator('.gli').first().click();
	const cta = page.getByRole('button', { name: /Replay your \d+ mistake/ });
	await expect(cta).toBeVisible({ timeout: 60_000 });
	await cta.click();
	await expect(
		page
			.getByText(/Mistake 1 of \d+/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await expect(
		page
			.getByText(/You played .+ Find a better move!/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page.getByRole('button', { name: 'Back to the analysis' }).click();
	await expect(cta).toBeVisible();
});
