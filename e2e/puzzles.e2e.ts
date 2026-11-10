import { expect, test } from '@playwright/test';

test('Puzzle laden, Lösung zeigen, Rating ändert sich', async ({ page }) => {
	await page.goto('/puzzles');
	await expect(page.getByText(/to move – find the best move/)).toBeVisible({ timeout: 10000 });
	await expect(page.locator('.r-val')).toContainText('800');
	await page.getByRole('button', { name: 'Solution' }).click();
	await expect(page.getByText('Not quite – here’s how')).toBeVisible({ timeout: 15000 });
	await expect(page.locator('.delta')).toBeVisible();
	await expect(page.getByText(/back for review/)).toBeVisible();
	await page.getByRole('button', { name: /Next/ }).click();
	await expect(page.getByText(/to move – find the best move/)).toBeVisible({ timeout: 10000 });
	// Wiederholen-Zähler
	await expect(page.getByRole('button', { name: /Review/ })).toBeVisible();
});

test('Puzzle des Tages ist per Link erreichbar', async ({ page }) => {
	await page.goto('/puzzles?mode=daily');
	await expect(page.getByRole('button', { name: /Daily/ })).toHaveClass(/on/);
});
