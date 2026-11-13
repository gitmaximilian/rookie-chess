import { expect, test } from '@playwright/test';

// Am Handy steht der Kommentar über dem Brett (CommentBar), am Desktop in der Seitenspalte:
// Tests suchen deshalb den sichtbaren Text, egal an welcher Stelle.
import { fen, playUci } from './helpers/board';

test('Coach: lobt gute Züge und bietet bei einem Patzer das Zurücknehmen an', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto('/play');
	// Coach ist für neue Nutzer schon an
	await expect(page.getByRole('switch', { name: /Play with coach/ })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await page
		.getByRole('button', { name: /Start game/ })
		.first()
		.click();
	await expect(
		page
			.getByText(/comment on every move/)
			.locator('visible=true')
			.first()
	).toBeVisible();

	await playUci(page, 'e2e3');
	await expect(
		page.locator('.cb-title:visible, [data-testid="coach-bar"][data-state="judged"]').first()
	).toBeVisible({ timeout: 30_000 });
	// Bot antwortet, dann Läufer nach a6 – hängt
	await expect(
		page.getByText('Your move', { exact: true }).locator('visible=true').first()
	).toBeVisible({
		timeout: 30_000
	});
	const before = await fen(page);
	await playUci(page, 'f1a6');
	await expect(page.getByRole('button', { name: 'Take back' })).toBeVisible({ timeout: 30_000 });
	await page.getByRole('button', { name: 'Take back' }).click();
	await expect.poll(() => fen(page)).toBe(before);
	await expect(
		page.getByText('Your move', { exact: true }).locator('visible=true').first()
	).toBeVisible();
});
