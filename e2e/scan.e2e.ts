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

test('Handy: Board-Scan zeigt nur ganze Zeilen und öffnet den vollständigen Text', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto('/puzzles/scan?mode=opponent');
	const card = page.getByTestId('scan-bar');
	await expect(card).toContainText('What can your opponent do?');
	const more = card.getByRole('button', { name: 'More' });
	await expect(more).toBeVisible();
	const wholeLines = await card.locator('p').evaluateAll((paragraphs) =>
		paragraphs.every((el) => {
			const height = el.getBoundingClientRect().height;
			const line = Number.parseFloat(getComputedStyle(el).lineHeight);
			return height >= line - 1 && Math.abs(height - Math.round(height / line) * line) < 1;
		})
	);
	expect(wholeLines).toBe(true);
	await more.click();
	const sheet = page.getByRole('dialog');
	await expect(sheet).toContainText('What can your opponent do?');
	await expect(sheet).toContainText('This is the blunder check');
});
