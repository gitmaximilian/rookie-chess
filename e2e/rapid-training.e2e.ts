import { expect, test, type Page } from '@playwright/test';
import type { GameRow } from '../src/lib/db/db';
import { playUci } from './helpers/board';

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const example: GameRow = {
	id: 7,
	date: 0,
	pgn: '1. f3 e5 2. g4 Qh4# 0-1',
	moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
	startFen,
	result: '0-1',
	myColor: 'white',
	opponent: 'Test fixture',
	source: 'lichess',
	speed: 'rapid',
	rated: true,
	myRating: 1320,
	analysis: {
		depth: 11,
		done: true,
		evals: [
			{ cp: 30, best: 'e2e4' },
			{ cp: -15, best: 'e7e5' },
			{ cp: -15, best: 'e2e4' },
			{ mate: -1, best: 'd8h4' },
			{ cp: -10000 }
		]
	}
};

async function seed(page: Page, settings: Record<string, unknown>, games: GameRow[]) {
	await page.evaluate(
		({ settings, games }) =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('rookie');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction(['settings', 'games'], 'readwrite');
					for (const [key, value] of Object.entries(settings)) {
						tx.objectStore('settings').put({ key, value, t: Date.now() });
					}
					for (const game of games) tx.objectStore('games').put(game);
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
			}),
		{ settings, games }
	);
}

test('Fortgeschrittenes Profil: Schnellschach bleibt bei späteren Blitzpartien stabil, Spieltermin bei 5/15/30 Minuten', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.locator('.plan[aria-busy="false"]')).toBeVisible();
	const oldRapid = { ...example, date: Date.now() - 7 * 86_400_000 };
	const casual: GameRow = {
		...example,
		id: 8,
		date: Date.now() - 86_400_000,
		source: 'chesscom',
		speed: 'blitz',
		rated: false,
		myRating: 830
	};
	await seed(page, { minutesPerDay: 5, dailyPlan: null }, [oldRapid, casual]);
	const tile = page.getByTestId('tile-strength');
	const plan = page.locator('.plan');
	await expect.poll(async () => await plan.getByRole('link', { name: /^Start$/ }).count()).toBe(1);
	await page.reload();
	await expect(tile).toContainText('1320');
	await expect(tile).toContainText('Lichess Rapid');
	await expect(plan.getByRole('link', { name: /Board scan/ })).toHaveCount(0);
	await expect(plan.getByTestId('rapid-slot')).toBeVisible();
	// 5 min Budget: Puzzles bleiben täglich drin (bis zu 5 min darüber)
	await expect(plan).toContainText('about 7 min');
	await seed(page, { minutesPerDay: 15, dailyPlan: null }, []);
	await page.reload();
	await expect(plan.getByRole('link', { name: /Practise one mistake/ })).toBeVisible();
	await expect(plan.getByTestId('rapid-slot')).toBeVisible();
	await seed(page, { minutesPerDay: 30, dailyPlan: null }, []);
	await page.reload();
	await expect(plan.getByTestId('rapid-slot')).toHaveCount(0);
	await plan.getByRole('link', { name: 'Play a rated Rapid game' }).click();
	await expect(page.getByTestId('rapid-plan')).toBeVisible();
	await expect(page.getByRole('link', { name: /Import a finished game/ })).toHaveAttribute(
		'href',
		'/import?rapid=1'
	);
});

test('Ein eigener Fehler wird nach Import vorausgewählt und bleibt nach Auflösung und Neuladen gespeichert', async ({
	page
}) => {
	await page.goto('/');
	const plan = page.locator('.plan');
	await expect(plan.getByRole('link', { name: /^Start$/ })).toBeVisible();
	await seed(page, { minutesPerDay: 30 }, [{ ...example, date: Date.now() }]);
	await page.reload();
	const task = plan.getByRole('link', { name: /Practise one mistake/ });
	await expect(task).toHaveAttribute('href', '/analysis?game=7&practice=1');
	await expect(plan.getByRole('link', { name: /^Continue$/ })).toHaveAttribute(
		'href',
		'/analysis?game=7&practice=1'
	);
	await task.click();
	await expect(
		page
			.getByText(/Mistake 1 of 1/i)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Solution', exact: true })
		.locator('visible=true')
		.first()
		.click();
	await expect(
		page.getByRole('button', { name: 'Finish', exact: true }).locator('visible=true').first()
	).toBeVisible();
	await page.reload();
	await expect(page.getByTestId('quick-result')).toContainText('Saved for spaced review');
	await expect(page.getByTestId('quick-result')).toContainText('Next review:');
	await page
		.getByTestId('quick-result')
		.getByRole('link', { name: 'Back to the daily plan' })
		.click();
	await expect(
		plan.locator('.task.finished').filter({ hasText: 'Practise one mistake' })
	).toBeVisible();
});

for (const withHint of [false, true]) {
	test(`Nachspielen speichert einen ${withHint ? 'unterstützten' : 'selbstständigen'} Treffer`, async ({
		page,
		hasTouch
	}) => {
		await page.goto('/');
		await expect(page.locator('.plan[aria-busy="false"]')).toBeVisible();
		await seed(page, {}, [{ ...example, date: Date.now() }]);
		await page.goto('/analysis?game=7&practice=1');
		await expect(
			page
				.getByText(/Mistake 1 of 1/i)
				.locator('visible=true')
				.first()
		).toBeVisible();
		// erst wird der Partiezug kurz vorgespielt, dann ist das Brett frei
		await expect(page.locator('.board-wrap[data-previewing="0"]')).toBeVisible();
		if (withHint) {
			await page
				.getByRole('button', { name: 'Hint', exact: true })
				.locator('visible=true')
				.first()
				.click();
		}
		await playUci(page, 'e2e4', hasTouch ? 'touch' : 'mouse');
		await expect(
			page
				.getByText(withHint ? 'Found – with a hint.' : 'Well found!', { exact: true })
				.locator('visible=true')
				.first()
		).toBeVisible();
		const records = await page.evaluate(
			() =>
				new Promise<{ solved: boolean; hinted: boolean }[]>((resolve) => {
					const req = indexedDB.open('rookie');
					req.onsuccess = () => {
						const db = req.result;
						const tx = db.transaction('puzzleAttempts');
						const query = tx.objectStore('puzzleAttempts').getAll();
						query.onsuccess = () =>
							resolve(query.result.map(({ solved, hinted }) => ({ solved, hinted })));
						tx.oncomplete = () => db.close();
					};
				})
		);
		expect(records).toEqual([{ solved: true, hinted: withHint }]);
	});
}

test('Rapid-Einstieg und kurze Fehlerübung funktionieren mit vorhandenen Daten offline', async ({
	page,
	context,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'Service Worker im Test nur mit Chromium');
	await page.goto('/');
	await expect(page.locator('.plan[aria-busy="false"]')).toBeVisible();
	await seed(page, {}, [{ ...example, date: Date.now() }]);
	await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
	await page.reload();
	await page.waitForFunction(() => !!navigator.serviceWorker.controller);
	await context.setOffline(true);
	await page.goto('/play?plan=1');
	await expect(page.getByTestId('rapid-plan')).toContainText(
		'You can practise against a bot below'
	);
	await page.goto('/analysis?game=7&practice=1');
	await expect(
		page
			.getByText(/Mistake 1 of 1/i)
			.locator('visible=true')
			.first()
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Solution', exact: true })
		.locator('visible=true')
		.first()
		.click();
	await expect(
		page.getByRole('button', { name: 'Finish', exact: true }).locator('visible=true').first()
	).toBeVisible();
	await page.reload();
	await expect(page.getByTestId('quick-result')).toBeVisible();
});
