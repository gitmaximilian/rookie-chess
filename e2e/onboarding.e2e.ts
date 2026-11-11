import { expect, test } from '@playwright/test';

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

test('Einstieg: Regeln unbekannt → direkt zu den Grundlagen', async ({ page }) => {
	await page.goto('/');
	const ob = page.getByRole('dialog', { name: 'Welcome to Rookie' });
	await expect(ob).toBeVisible();
	await ob.getByRole('button', { name: /Not yet/ }).click();
	// keine Frage nach der Spielstärke
	await expect(ob.getByText('What would you like to do first?')).toBeVisible();
	await ob.getByRole('button', { name: /Play games/ }).click();
	await expect(page).toHaveURL(/\/learn\/basics/);
	await page.reload();
	await expect(ob).toBeHidden();
});

test('Einstieg: erfahren + Taktik → Puzzles mit höherem Start-Rating', async ({ page }) => {
	await page.goto('/');
	const ob = page.getByRole('dialog', { name: 'Welcome to Rookie' });
	await ob.getByRole('button', { name: /^Yes/ }).click();
	await ob.getByRole('button', { name: /Experienced/ }).click();
	await ob.getByRole('button', { name: /Get better at tactics/ }).click();
	await expect(page).toHaveURL(/\/puzzles/);
	await page.goto('/profile');
	await expect(page.getByText('1300?')).toBeVisible();
});

test('Einstieg überspringen', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Skip' }).click();
	await expect(page.getByRole('dialog', { name: 'Welcome to Rookie' })).toBeHidden();
	await page.reload();
	await page.waitForTimeout(800);
	await expect(page.getByRole('dialog', { name: 'Welcome to Rookie' })).toBeHidden();
});
