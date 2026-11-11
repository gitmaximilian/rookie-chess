import { expect, test } from '@playwright/test';

const PGN = `[Event "Rated Blitz game"]
[White "alice"]
[Black "rookietester"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

test('Lichess-Import (nachgebildete Antwort): speichert, analysiert, macht Übungen', async ({
	page
}) => {
	test.setTimeout(120_000);
	await page.route('https://lichess.org/api/games/user/**', (route) =>
		route.fulfill({
			status: 200,
			headers: { 'access-control-allow-origin': '*', 'content-type': 'application/x-ndjson' },
			body:
				JSON.stringify({
					id: 'legal1',
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
	await page.getByLabel('Username').fill('rookietester');
	await page.getByRole('button', { name: /Import games/ }).click();
	await expect(page.getByText(/1 new game imported/)).toBeVisible({ timeout: 90_000 });
	await expect(page.getByRole('link', { name: /Practise my mistakes/ })).toBeVisible();

	// zweiter Import findet keine neuen Partien
	await page.getByRole('button', { name: /Import games/ }).click();
	await expect(page.getByText('No new games found.')).toBeVisible({ timeout: 30_000 });

	await page
		.getByRole('link', { name: /Practise my mistakes/ })
		.or(page.getByRole('link', { name: /View games/ }))
		.first()
		.click();
});

test('Unbekannter Benutzer zeigt Fehlermeldung', async ({ page }) => {
	await page.route('https://api.chess.com/**', (route) =>
		route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' })
	);
	await page.goto('/import');
	await page.getByRole('radio', { name: 'Chess.com' }).click();
	await page.getByLabel('Username').fill('gibtsnicht');
	await page.getByRole('button', { name: /Import games/ }).click();
	await expect(page.getByText('User not found.')).toBeVisible();
});
