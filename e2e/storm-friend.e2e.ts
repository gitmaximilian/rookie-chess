import { expect, test } from '@playwright/test';
import { playUci } from './helpers/board';

test('Gegen Freunde: Narrenmatt, Partie gespeichert', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('link', { name: /Play a friend/ }).click();
	await expect(page.getByText('White to move')).toBeVisible();
	for (const u of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) {
		await playUci(page, u);
		await page.waitForTimeout(250);
	}
	await expect(page.locator('.result')).toHaveText('Black wins');

	await page.getByRole('link', { name: /Analyse game/ }).click();
	await expect(page).toHaveURL(/analysis\?game=/);
});

test('Sterne: Profil zeigt Fortschritt je Lernbereich', async ({ page }) => {
	await page.goto('/profile');
	const stars = page.locator('section.stars');
	await expect(stars.getByRole('heading', { name: 'Your stars' })).toBeVisible();
	await expect(stars.getByText('Chess basics')).toBeVisible();
	await expect(stars.getByText('Endgames')).toBeVisible();
	await expect(stars.locator('.big b')).toHaveText('0');
});

test('Puzzle-Sturm: startet mit Zeit und Punktestand', async ({ page }) => {
	await page.goto('/puzzles');
	await page.getByRole('link', { name: /Puzzle Storm/ }).click();
	await expect(page.getByRole('heading', { name: 'Puzzle Storm' })).toBeVisible();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page.locator('.clock')).toContainText(/2:5\d|3:00/);
	await expect(page.getByText(/to move – find the best move/)).toBeVisible();
	// falscher Zug kostet 10 Sekunden
	const before = await page.locator('.clock').innerText();
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(page.getByText(/0 solved/)).toBeVisible();
	void before;
});
