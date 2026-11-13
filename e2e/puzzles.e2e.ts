import { expect, test } from '@playwright/test';

// Am Handy steht der Kommentar über dem Brett (CommentBar), am Desktop in der Seitenspalte:
// Tests suchen deshalb den sichtbaren Text, egal an welcher Stelle.

test('Puzzle laden, Lösung zeigen, Rating ändert sich', async ({ page }) => {
	await page.goto('/puzzles');
	await expect(
		page
			.getByText(/to move – find the best move/)
			.locator('visible=true')
			.first()
	).toBeVisible({ timeout: 10000 });
	await expect(page.locator('.r-val')).toContainText('800');
	await page.getByRole('button', { name: 'Solution' }).click();
	await expect(
		page.getByText('Not quite – here’s how').locator('visible=true').first()
	).toBeVisible({ timeout: 15000 });
	await expect(page.locator('.delta')).toBeVisible();
	await expect(
		page
			.getByText(/back for review/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page.getByRole('button', { name: /Next/ }).click();
	await expect(
		page
			.getByText(/to move – find the best move/)
			.locator('visible=true')
			.first()
	).toBeVisible({ timeout: 10000 });
	// Wiederholen-Zähler
	await expect(page.getByRole('button', { name: /Review/ })).toBeVisible();
});

test('Puzzle des Tages ist per Link erreichbar', async ({ page }) => {
	await page.goto('/puzzles?mode=daily');
	await expect(page.getByRole('button', { name: /Daily/ })).toHaveClass(/on/);
});

test('Handy: Hinweis und Lösung ohne Scrollen sichtbar, Brett frei', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'nur auf dem Handy');
	await page.goto('/puzzles');
	const hint = page.getByRole('button', { name: /Hint/ });
	await expect(hint).toBeVisible({ timeout: 20_000 });
	const vh = page.viewportSize()!.height;
	const hb = (await hint.boundingBox())!;
	expect(hb.y + hb.height).toBeLessThanOrEqual(vh);
	await expect(page.locator('.dock-root')).toBeVisible();
	const board = (await page.locator('cg-board').boundingBox())!;
	const dockBox = (await page.locator('.dock-root').boundingBox())!;
	expect(board.y + board.height).toBeLessThanOrEqual(dockBox.y + 2);
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
