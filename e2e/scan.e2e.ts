import { expect, test } from '@playwright/test';

test('Brett-Scan: hängende Figuren antippen, auflösen, nächste Stellung', async ({ page }) => {
	await page.goto('/puzzles/scan?mode=hanging');
	await expect(page.getByRole('heading', { name: 'Board scan' })).toBeVisible();
	await expect(
		page
			.getByText(/Tap every hanging piece/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page.getByTestId('scan-done').locator('visible=true').first().click();
	await expect(
		page
			.getByText(/of \d+ found/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page.getByTestId('scan-next').locator('visible=true').first().click();
	await expect(page.getByTestId('scan-done').locator('visible=true').first()).toBeVisible();
});

test('Brett-Scan: Modus wechseln – Gegner-Sicht ist der Blunder-Check', async ({ page }) => {
	await page.goto('/puzzles/scan');
	await page
		.getByRole('button', { name: 'OPPONENT' })
		.or(page.getByRole('button', { name: 'Opponent' }))
		.first()
		.click();
	await expect(
		page
			.getByText(/What can your opponent do\?/)
			.locator('visible=true')
			.first()
	).toBeVisible();
});
