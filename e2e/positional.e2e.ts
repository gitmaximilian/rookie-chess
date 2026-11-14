import { expect, test } from '@playwright/test';
import { playUci } from './helpers/board';

test('Stellungsspiel: Lektion mit Schwarz am Zug lösen (zum Zentrum zurückschlagen)', async ({
	page
}) => {
	await page.goto('/learn/basics?id=pos-structure');
	await expect(page.getByText('Pawn structure').locator('visible=true').first()).toBeVisible();
	await page.getByRole('button', { name: /Next/ }).locator('visible=true').first().click();
	await expect(
		page
			.getByText(/How do you recapture\?/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await expect(page.locator('.cg-host').first()).toHaveAttribute('data-orientation', 'black');
	await playUci(page, 'e6d5');
	await expect(
		page
			.getByText(/keeps a pawn in the centre/)
			.locator('visible=true')
			.first()
	).toBeVisible();
});

test('Lernen zeigt, was auf dem eigenen Niveau zählt, und die neuen Pfade', async ({ page }) => {
	await page.goto('/learn');
	const lvl = page.getByTestId('level-focus');
	await expect(lvl).toBeVisible();
	await expect(lvl).toContainText('What counts at your level');
	await expect(page.getByRole('link', { name: /Board scan/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /Positional play/ })).toBeVisible();
});
