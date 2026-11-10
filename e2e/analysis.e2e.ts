import { expect, test } from '@playwright/test';

const LEGAL = `[White "Legal"]
[Black "Saint Brie"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

test('PGN analysieren: Patzer wird erkannt und erklärt', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto('/analysis');
	await page.getByRole('textbox').fill(LEGAL);
	await page.getByRole('button', { name: 'Analysieren' }).click();
	await expect(page).toHaveURL(/analysis\?game=\d+/);
	await expect(page.locator('.summary')).toBeVisible({ timeout: 60_000 });
	await page.getByRole('button', { name: /xd1/ }).click();
	await expect(page.locator('.badge')).toHaveText('Patzer');
	await expect(page.getByText('Matt zugelassen')).toBeVisible();
	// Tastatur-Navigation
	await page.keyboard.press('Home');
	await expect(page.getByText('Ausgangsstellung')).toBeVisible();
	// Partie erscheint in der Liste
	await page.getByRole('link', { name: 'Partien' }).click();
	await expect(page.getByText('gegen Saint Brie')).toBeVisible();
});
