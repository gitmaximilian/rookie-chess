import { expect, test } from '@playwright/test';

test('Profil zeigt Kennzahlen, Diagramme und Links', async ({ page }) => {
	// ein Puzzle lösen lassen (Lösung zeigen) → Rating-Historie entsteht
	await page.goto('/puzzles');
	await expect(page.getByText(/to move – find the best move/)).toBeVisible({ timeout: 10000 });
	await page.getByRole('button', { name: 'Solution' }).click();
	await expect(page.getByText('Not quite – here’s how')).toBeVisible({ timeout: 15000 });
	await page.getByRole('button', { name: /Next/ }).click();
	await expect(page.getByText(/to move – find the best move/)).toBeVisible({ timeout: 10000 });
	await page.getByRole('button', { name: 'Solution' }).click();
	await expect(page.getByText('Not quite – here’s how')).toBeVisible({ timeout: 15000 });

	await page.goto('/profile');
	await expect(page.getByText('Puzzle rating')).toBeVisible();
	await expect(page.locator('[data-testid="profile-tiles"] > .tile')).toHaveCount(7);
	await expect(page.locator('.chart svg')).toBeVisible();
	await expect(page.locator('.heat .cell.l1, .heat .cell.l2').first()).toBeVisible();
	await expect(page.getByRole('link', { name: /My games/ })).toBeVisible();
	await expect(page.locator('.links').getByRole('link', { name: /Legal notice/ })).toHaveAttribute(
		'href',
		'https://maximilianauer.at/legal/'
	);
});
