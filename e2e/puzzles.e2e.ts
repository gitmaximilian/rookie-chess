import { expect, test } from '@playwright/test';

test('Puzzle laden, Lösung zeigen, Rating ändert sich', async ({ page }) => {
	await page.goto('/puzzles');
	await expect(page.getByText(/am Zug – finde den besten Zug/)).toBeVisible({ timeout: 10000 });
	await expect(page.locator('.r-val')).toContainText('800');
	await page.getByRole('button', { name: 'Lösung' }).click();
	await expect(page.getByText('Nicht ganz – so geht’s')).toBeVisible({ timeout: 15000 });
	await expect(page.locator('.delta')).toBeVisible();
	await expect(page.getByText(/zur Wiederholung/)).toBeVisible();
	await page.getByRole('button', { name: /Weiter/ }).click();
	await expect(page.getByText(/am Zug – finde den besten Zug/)).toBeVisible({ timeout: 10000 });
	// Wiederholen-Zähler
	await expect(page.getByRole('button', { name: /Wiederholen/ })).toBeVisible();
});

test('Puzzle des Tages ist per Link erreichbar', async ({ page }) => {
	await page.goto('/puzzles?mode=daily');
	await expect(page.getByRole('button', { name: /Des Tages/ })).toHaveClass(/on/);
});
