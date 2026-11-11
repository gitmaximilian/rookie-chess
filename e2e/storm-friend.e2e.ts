import { expect, test } from '@playwright/test';
import { playUci } from './helpers/board';

test('Gegen Freunde: Narrenmatt, Partie gespeichert, Erfolg freigeschaltet', async ({ page }) => {
	await page.goto('/profile');
	await expect(page.getByText(/0 of 22 unlocked/)).toBeVisible();

	await page.goto('/play');
	await page.getByRole('link', { name: /Play a friend/ }).click();
	await expect(page.getByText('White to move')).toBeVisible();
	for (const u of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) {
		await playUci(page, u);
		await page.waitForTimeout(250);
	}
	await expect(page.locator('.result')).toHaveText('Black wins');
	await expect(page.getByText('Achievement unlocked')).toBeVisible();
	await expect(page.getByText('Friendly match')).toBeVisible();

	await page.getByRole('link', { name: /Analyse game/ }).click();
	await expect(page).toHaveURL(/analysis\?game=/);
	await page.goto('/profile');
	await expect(page.getByText(/1 of 22 unlocked/)).toBeVisible();
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
