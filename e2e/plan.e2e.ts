import { expect, test } from '@playwright/test';

test('Tagesplan: erste Grundlagen-Lektion erscheint als erledigt', async ({ page }) => {
	await page.goto('/');
	const plan = page.locator('.plan');
	await expect(plan.getByText('Your training today')).toBeVisible();
	await expect(plan.getByText(/Solve 5 puzzles/)).toBeVisible();
	await expect(plan.getByRole('link', { name: /Start/ })).toBeVisible();
});

test.describe('mit Einstieg', () => {
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

	test('Tagesplan: Grundlagen-Lektion wird nach dem Lernen abgehakt', async ({ page }) => {
		await page.goto('/');
		const ob = page.getByRole('dialog', { name: 'Welcome to Rookie' });
		await ob.getByRole('button', { name: /Not yet/ }).click();
		await ob.getByRole('button', { name: /Learn the basics/ }).click();
		await expect(page).toHaveURL(/learn\/basics/);

		await page.goto('/');
		const plan = page.locator('.plan');
		await plan.getByRole('link', { name: /Lesson: The board/ }).click();
		await page.getByRole('button', { name: /Next/ }).click();
		await page.getByRole('button', { name: /Next/ }).click();
		await expect(page.getByText('Lesson complete!')).toBeVisible();
		await page.goto('/');
		await expect(plan.locator('.task.finished')).toContainText('The board');
	});
});
