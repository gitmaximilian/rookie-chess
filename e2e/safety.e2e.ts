import { expect, test, type Page } from '@playwright/test';

/** eine Blunder-Check-Aufgabe beantworten – egal ob der Zug sicher ist oder nicht */
async function answer(page: Page, which: 'answer-safe' | 'answer-unsafe') {
	await page.getByTestId(which).locator('visible=true').first().click();
	const showMe = page.getByRole('button', { name: 'Show me' }).locator('visible=true').first();
	const next = page.getByTestId('safety-next').locator('visible=true').first();
	await expect(showMe.or(next)).toBeVisible();
	if (await showMe.isVisible()) await showMe.click();
	await expect(next).toBeVisible();
	return next;
}

test('Blunder-Check: Frage, Antwort, Rückmeldung, nächste Aufgabe', async ({ page }) => {
	await page.goto('/puzzles/safety');
	await expect(page.getByRole('heading', { name: 'Is it safe?' })).toBeVisible();
	await expect(
		page
			.getByText(/You plan .+\. Is it safe\?/)
			.locator('visible=true')
			.first()
	).toBeVisible();
	const next = await answer(page, 'answer-unsafe');
	await next.click();
	await expect(page.getByTestId('answer-safe').locator('visible=true').first()).toBeEnabled();
	await (await answer(page, 'answer-safe')).click();
	// Versuche werden gezählt
	await expect(
		page
			.getByText(/\d\/2 right/)
			.locator('visible=true')
			.first()
	).toBeVisible();
});

test('Kontrolltest: 12 Aufgaben ohne Zwischenauswertung, dann Ergebnis und Fortschritt im Coach', async ({
	page
}) => {
	test.setTimeout(90_000);
	await page.goto('/puzzles/safety?test=1');
	await expect(page.getByRole('heading', { name: 'Safety check-up' })).toBeVisible();
	for (let i = 0; i < 12; i++) {
		const next = await answer(page, i % 2 ? 'answer-safe' : 'answer-unsafe');
		await expect(
			page.getByText('Answer saved – results at the end.').locator('visible=true').first()
		).toBeVisible();
		await next.click();
	}
	const summary = page.getByTestId('checkup-summary');
	await expect(summary).toContainText(/of 12 points/);
	await page.goto('/coach');
	const progress = page.getByTestId('progress-check');
	await expect(progress).toContainText('Is your training working?');
	await expect(progress).toContainText('Check-up');
	await expect(progress).toContainText(/next in 14 days|next in 13 days/);
});

test('Tagesplan: Blunder-Check steht vorn und führt zur Übung', async ({ page }) => {
	await page.goto('/');
	const plan = page.locator('.plan');
	const task = plan.getByRole('link', { name: /Blunder check: 6 moves/ });
	await expect(task).toBeVisible();
	await task.click();
	await expect(page).toHaveURL(/puzzles\/safety/);
});
