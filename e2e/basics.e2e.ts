import { expect, test } from '@playwright/test';
import { playUci } from './helpers/board';

test('Grundlagen: Turm sammelt Sterne, Matt-Aufgabe, Lektion fertig', async ({ page }) => {
	await page.goto('/learn');
	await page.getByRole('link', { name: /Chess basics/ }).click();
	await expect(page.getByText(/0 of 15 lessons done/)).toBeVisible();
	await page.getByRole('button', { name: /The rook/ }).click();

	await page.getByRole('button', { name: /Next/ }).click();
	await expect(page.getByText('3 stars left')).toBeVisible();
	for (const u of ['a1a5', 'a5e5', 'e5e8']) {
		await playUci(page, u);
		await page.waitForTimeout(250);
	}
	await expect(page.getByText(/All stars collected in 3 moves/)).toBeVisible();
	await page.getByRole('button', { name: /Next/ }).click();
	for (const u of ['h1h6', 'h6c6', 'c6c2', 'c2f2']) {
		await playUci(page, u);
		await page.waitForTimeout(250);
	}
	await page.getByRole('button', { name: /Next/ }).click();
	await expect(page.getByText('Lesson complete!')).toBeVisible();
	await page.getByRole('button', { name: /Next lesson/ }).click();
	await expect(page.locator('.crumb')).toHaveText('The bishop');
});

test('Grundlagen: falscher Zug, dann Matt in 1', async ({ page }) => {
	await page.goto('/learn/basics?id=mate');
	await page.getByRole('button', { name: /Next/ }).click();
	await playUci(page, 'a1a7');
	await expect(page.getByText(/Not quite/)).toBeVisible();
	await playUci(page, 'a1a8');
	await expect(page.getByText(/Back-rank mate/)).toBeVisible();
});

test('Taktik: Gabel lernen, dann mit Puzzles üben', async ({ page }) => {
	await page.goto('/learn');
	await page.getByRole('link', { name: /Tactics/ }).click();
	await expect(page.getByRole('heading', { name: 'Tactics' })).toBeVisible();
	await page.getByRole('button', { name: /The fork/ }).click();
	await page.getByRole('button', { name: /Next/ }).click();
	await page.getByRole('button', { name: /Next/ }).click();
	await playUci(page, 'b5c7');
	await expect(page.getByText(/the rook is yours/)).toBeVisible();
	await page.getByRole('button', { name: /Next/ }).click();
	await playUci(page, 'd3d4');
	await expect(page.getByText(/A pawn fork/)).toBeVisible();
	await page.getByRole('button', { name: /Next/ }).click();
	await expect(page.getByText('Lesson complete!')).toBeVisible();
	await page.getByRole('link', { name: /Practise with puzzles/ }).click();
	await expect(page).toHaveURL(/puzzles\?theme=fork/);
});
