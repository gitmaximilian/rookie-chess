import { expect, test } from '@playwright/test';
import { playUci } from './helpers/board';

test('Zug und Antwort: eigener Zug, Gegnerzug, sofortige Rückmeldung', async ({
	page,
	hasTouch
}) => {
	await page.goto('/puzzles/scan');
	await page.getByRole('link', { name: 'Move and reply' }).click();
	const input = hasTouch ? 'touch' : 'mouse';
	await expect(page.getByText('Position 1 of 6')).toBeVisible();
	await expect(page.locator('cg-board piece.white.knight').first()).toBeVisible();
	await page.locator('cg-board').scrollIntoViewIfNeeded();
	await playUci(page, 'g1f3', input);
	await expect(page.getByText(/play a strong reply/)).toBeVisible();
	await playUci(page, 'b8c6', input);
	await expect(page.getByText(/Your move is sound|A stronger move/)).toBeVisible();
	await expect(
		page.getByText(/You found a strong reply|The opponent has a stronger reply/)
	).toBeVisible();
	await page.getByRole('button', { name: 'Next position' }).click();
	await expect(page.getByText('Position 2 of 6')).toBeVisible();
});

test('Neue Stellungen: Zwischenstand nach Neuladen und keine Auflösung zwischen Aufgaben', async ({
	page,
	hasTouch
}) => {
	await page.goto('/puzzles/decision?test=1');
	const input = hasTouch ? 'touch' : 'mouse';
	await expect(page.getByText('Position 1 of 6')).toBeVisible();
	await expect(page.locator('cg-board piece.white.knight').first()).toBeVisible();
	await page.locator('cg-board').scrollIntoViewIfNeeded();
	await playUci(page, 'e2e4', input);
	await expect(page.getByText(/play a strong reply/)).toBeVisible();
	await page.reload();
	await expect(page.getByText(/play a strong reply/)).toBeVisible();
	await playUci(page, 'b8c6', input);
	await expect(page.getByText('Position 2 of 6')).toBeVisible();
	await expect(
		page.getByText(/Your move is sound|A stronger move|You found a strong reply/)
	).toHaveCount(0);
	await page.reload();
	await expect(page.getByText('Position 2 of 6')).toBeVisible();
});

test('Erste Partie: geführter Einstieg wählt den Einstiegsbot', async ({ page }) => {
	await page.goto('/play?first=1');
	await expect(page.getByTestId('first-game')).toContainText('Your first full game');
	await page.getByRole('button', { name: 'Start game' }).first().click();
	await expect(page.getByText('Your move', { exact: true })).toBeVisible();
	await expect(page.locator('.player.top')).toContainText('Pawn Pete');
});
