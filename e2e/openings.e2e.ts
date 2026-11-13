import { expect, test } from '@playwright/test';

// Am Handy steht der Kommentar über dem Brett (CommentBar), am Desktop in der Seitenspalte:
// Tests suchen deshalb den sichtbaren Text, egal an welcher Stelle.
import { fen, playUci } from './helpers/board';

test('Kurs: Variante lernen mit Feedback, danach im Repertoire trainieren', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto('/learn/openings');
	await page.getByRole('link', { name: /Italian Game/ }).click();
	await expect(page.getByRole('heading', { name: 'Italian Game' })).toBeVisible();
	await expect(page.getByText('Key ideas').locator('visible=true').first()).toBeVisible();
	await expect(page.getByText('Middlegame plans').locator('visible=true').first()).toBeVisible();
	await expect(page.getByText('Légal’s mate').locator('visible=true').first()).toBeVisible();
	await page.getByRole('button', { name: /Start learning/ }).click();

	// Lernmodus: Zug für Zug mit Erklärung
	await expect(
		page
			.getByText(/Press “Next”/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page.getByRole('button', { name: /^Next/ }).click();
	await expect(
		page
			.getByText(/Take the centre/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await expect(page.getByText('Move 1 of 15').locator('visible=true').first()).toBeVisible();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByText('Move 2 of 15').locator('visible=true').first()).toBeVisible();
	await page.getByRole('button', { name: /Course overview/ }).click();

	// Üben
	await page.getByRole('button', { name: 'Practise' }).first().click();

	// falscher erster Zug → Feedback, Brett bleibt in der Grundstellung
	await expect(
		page
			.getByText(/Your move/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await playUci(page, 'a2a3');
	await expect(
		page.locator('.fb:visible, [data-testid="course-bar"][data-state="feedback"]').first()
	).toBeVisible({ timeout: 30_000 });
	expect(await fen(page)).toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR w/);

	// Tipp zeigt die Figur
	await page.getByRole('button', { name: /Hint/ }).click();
	await expect(
		page
			.getByText(/Piece to move: pawn/)
			.locator('visible=true')
			.first()
	).toBeVisible();

	// Variante durchspielen: Weiß-Züge der Giuoco Piano
	for (const uci of ['e2e4', 'g1f3', 'f1c4', 'c2c3', 'd2d3', 'e1g1', 'f1e1', 'c4b3']) {
		await expect(
			page
				.getByText(/Your move/)
				.locator('visible=true')
				.first()
		).toBeVisible({ timeout: 10_000 });
		await playUci(page, uci);
		// erst weiter, wenn der Zug angekommen ist (Gegner antwortet bzw. Variante fertig)
		await expect(
			page
				.getByText(/Watch the opponent|Line learned/)
				.locator('visible=true')
				.first()
		).toBeVisible();
	}
	await expect(page.getByText('Line learned!').locator('visible=true').first()).toBeVisible({
		timeout: 10_000
	});
	await expect(
		page
			.getByText(/Take the centre/)
			.locator('visible=true')
			.first()
	).toBeVisible();

	// Zug ist jetzt im Repertoire und fällig
	await page.getByRole('link', { name: /Review due moves/ }).click();
	await expect(page.locator('.side.white .meta')).toContainText('in your repertoire');
	await page.locator('.side.white').getByRole('button', { name: /Train/ }).click();
	await expect(
		page.getByText('Play your repertoire move').locator('visible=true').first()
	).toBeVisible();
	await playUci(page, 'a2a3');
	await expect(
		page
			.getByText(/Your repertoire says/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await expect(page.locator('.why')).toBeVisible();
});

test('Editor: eigenen Zug anlegen, Eröffnungsname erscheint', async ({ page }) => {
	await page.goto('/learn/openings');
	// Seite ist vorgerendert: Klick erst wirksam, wenn Svelte hydriert hat
	await expect(async () => {
		await page.locator('.side.black').getByRole('button', { name: /Edit/ }).click();
		await expect(page.locator('.cg-host').first()).toBeVisible({ timeout: 1000 });
	}).toPass();
	await playUci(page, 'e2e4');
	await playUci(page, 'c7c5');
	await expect(page.locator('.opening')).toContainText('Sicilian');
	await page
		.getByRole('button', { name: /Start|toStart|Back to start/ })
		.first()
		.click();
	await expect(page.locator('.node')).toHaveCount(1);
	await expect(page.locator('.node').first()).toContainText('opponent');
});
