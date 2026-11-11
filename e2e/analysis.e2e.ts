import { expect, test } from '@playwright/test';

const LEGAL = `[White "Legal"]
[Black "Saint Brie"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

test('PGN analysieren: Patzer wird erkannt und erklärt', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto('/analysis');
	await page.getByRole('textbox').fill(LEGAL);
	await page.getByRole('button', { name: 'Analyse' }).click();
	await expect(page).toHaveURL(/analysis\?game=\d+/);
	await expect(page.locator('.summary')).toBeVisible({ timeout: 60_000 });
	await page.getByRole('button', { name: /xd1/ }).click();
	await expect(page.locator('.move-card .badge')).toHaveText('Blunder');
	await expect(page.locator('.move-card').getByText('Allowed mate')).toBeVisible();
	// Tastatur-Navigation
	await page.keyboard.press('Home');
	await expect(page.getByText('Starting position')).toBeVisible();
	// Partie erscheint in der Liste
	await page.getByRole('main').getByRole('link', { name: 'Games' }).click();
	await expect(page.getByText('vs Saint Brie')).toBeVisible();
});

test('Weiterklicken in der Analyse scrollt die Seite nicht', async ({ page }) => {
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
	for (let i = 0; i < 30; i++) await next.click();
	await page.waitForTimeout(600);
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
